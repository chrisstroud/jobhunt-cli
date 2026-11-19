/** Account identity is distinct from resume/Hunt Profile content. */
import type { JobHuntClient } from './index.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, shape, uuid, journeyResult, type OperationReceipt } from './journey-contracts.ts';
export type AccountName = { account_id: string; name: string; email: string };
export type AccountNameWrite = { expected_account_id: string; request_id: string; expected_name: string; name: string };
export type AccountNameCheck = { expected_account_id: string; request_id: string; expected_payload_hash: string };
export type AccountNameResolution = { request_id: string; state: 'closed' | 'recorded' | 'recorded_expired' };
const account = (v: unknown): v is string => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const exact = (v: unknown, fields: string[]): v is JsonObject => record(v) && Object.keys(v).length === fields.length && Object.keys(v).every(key => fields.includes(key));
const text = (v: unknown): v is string => typeof v === 'string' && new TextDecoder().decode(new TextEncoder().encode(v)) === v;
export function accountNameInput(value: unknown): AccountNameWrite {
  shape(value, ['expected_account_id', 'request_id', 'expected_name', 'name']);
  if (!account(value.expected_account_id) || !uuid(value.request_id) || !Object.hasOwn(value, 'expected_name') ||
    !text(value.expected_name) || !text(value.name) || !value.name.length) fail();
  return { ...value, expected_account_id: 'jh_' + value.expected_account_id.slice(3).toLowerCase(), request_id: String(value.request_id).toLowerCase() } as AccountNameWrite;
}
export async function accountNameOriginalHash(original: AccountNameWrite) {
  const input = accountNameInput(original);
  const stable = Object.fromEntries(Object.keys(input).sort().map(key => [key, input[key as keyof AccountNameWrite]]));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable)))), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function accountNameData(value: unknown): value is AccountName {
  return exact(value, ['account_id', 'name', 'email']) && account(value.account_id) &&
    text(value.name) && text(value.email);
}
function result<T>(value: unknown, parse: (v: unknown) => v is T, expected?: string) {
  if (!record(value) || Object.keys(value).some(key => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(key))) fail(true);
  const output = journeyResult(value, parse);
  const operation = output.operation as OperationReceipt | null | undefined;
  if (operation && (operation.kind !== 'save_account_display_name' || operation.status !== 'succeeded' || operation.resource?.kind !== 'profile' ||
    expected && operation.resource.id !== expected.slice(3))) fail(true);
  return output;
}
export class AccountNameClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async get() { return result(await this.client.request('/api/v1/journey/get_account_display_name'), accountNameData); }
  async save(input: AccountNameWrite) {
    const args = accountNameInput(input);
    const value = result(await this.client.request('/api/v1/journey/save_account_display_name', { method: 'POST', body: args }),
      (v): v is AccountName => accountNameData(v) && v.account_id === args.expected_account_id, args.expected_account_id);
    if (!value.operation) fail(true);
    return value;
  }
  async check(input: AccountNameWrite) {
    const args = accountNameInput(input), query = { expected_account_id: args.expected_account_id, request_id: args.request_id,
      expected_payload_hash: await accountNameOriginalHash(args) };
    const value = result(await this.client.request('/api/v1/journey/check_account_display_name?' + new URLSearchParams({ arguments: JSON.stringify(query) })),
      (v): v is AccountName => accountNameData(v) && v.account_id === args.expected_account_id, args.expected_account_id);
    if (!value.operation) fail(true);
    return value;
  }
  async close(original: AccountNameWrite) {
    const args = accountNameInput(original);
    return result(await this.client.request('/api/v1/journey/close_account_display_name', { method: 'POST', body: { original: args, confirm_close: true } }),
      (v): v is AccountNameResolution => exact(v, ['request_id', 'state']) && v.request_id === args.request_id &&
        ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)));
  }
}
