/** Account identity is distinct from resume/Hunt Profile content. */
import type { JobHuntClient } from './index.ts';
import { record, type JsonObject } from './protocol.ts';
import { fail, shape, uuid, journeyResult, type OperationReceipt } from './journey-contracts.ts';
export type AccountNameParts = { account_id: string; name: string; email: string; first_name:string; last_name:string };
export type AccountNamePartsWrite = { expected_account_id: string; request_id: string; expected_name:string; name:string; first_name:string; last_name:string; expected_first_name:string; expected_last_name:string };
export type AccountNamePartsCheck = { expected_account_id: string; request_id: string; expected_payload_hash: string };
export type AccountNamePartsResolution = { request_id: string; state: 'closed' | 'recorded' | 'recorded_expired' };
const account = (v: unknown): v is string => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
const exact = (v: unknown, fields: string[]): v is JsonObject => record(v) && Object.keys(v).length === fields.length && Object.keys(v).every(key => fields.includes(key));
const text = (v: unknown): v is string => typeof v === 'string' && new TextDecoder().decode(new TextEncoder().encode(v)) === v;
export function accountNamePartsInput(value: unknown): AccountNamePartsWrite {
  shape(value, ['expected_account_id','request_id','expected_name','name','first_name','last_name','expected_first_name','expected_last_name']);
  if (!account(value.expected_account_id) || !uuid(value.request_id) || !Object.hasOwn(value, 'expected_name') ||
    !text(value.expected_name)||!text(value.name)||!value.name.length||!text(value.first_name)||!text(value.last_name)||!text(value.expected_first_name)||!text(value.expected_last_name)) fail();
  return { ...value, expected_account_id: 'jh_' + value.expected_account_id.slice(3).toLowerCase(), request_id: String(value.request_id).toLowerCase() } as AccountNamePartsWrite;
}
export async function accountNamePartsOriginalHash(original: AccountNamePartsWrite) {
  const input = accountNamePartsInput(original);
  const stable = Object.fromEntries(Object.keys(input).sort().map(key => [key, input[key as keyof AccountNamePartsWrite]]));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable)))), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function accountNamePartsData(value: unknown): value is AccountNameParts {
  return exact(value, ['account_id','name','email','first_name','last_name']) && account(value.account_id) &&
    text(value.name)&&text(value.email)&&text(value.first_name)&&text(value.last_name);
}
function result<T>(value: unknown, parse: (v: unknown) => v is T, expected?: string) {
  if (!record(value) || Object.keys(value).some(key => !['outcome', 'data', 'operation', 'revision', 'next_action', 'website_url', 'error'].includes(key))) fail(true);
  const output = journeyResult(value, parse);
  const operation = output.operation as OperationReceipt | null | undefined;
  if (operation && (operation.kind !== 'save_account_name_parts_v1' || operation.status !== 'succeeded' || operation.resource?.kind !== 'profile' ||
    expected && operation.resource.id !== expected.slice(3))) fail(true);
  return output;
}
export class AccountNamePartsClient {
  private readonly client: Pick<JobHuntClient, 'request'>;
  constructor(client: Pick<JobHuntClient, 'request'>) { this.client = client; }
  async get() { return result(await this.client.request('/api/v1/journey/get_account_name_parts_v1'), accountNamePartsData); }
  async save(input: AccountNamePartsWrite) {
    const args = accountNamePartsInput(input);
    const value = result(await this.client.request('/api/v1/journey/save_account_name_parts_v1', { method: 'POST', body: args }),
      (v): v is AccountNameParts => accountNamePartsData(v) && v.account_id === args.expected_account_id, args.expected_account_id);
    if (!value.operation) fail(true);
    return value;
  }
  async check(input: AccountNamePartsWrite) {
    const args = accountNamePartsInput(input), query = { expected_account_id: args.expected_account_id, request_id: args.request_id,
      expected_payload_hash: await accountNamePartsOriginalHash(args) };
    const value = result(await this.client.request('/api/v1/journey/check_account_name_parts_v1?' + new URLSearchParams({ arguments: JSON.stringify(query) })),
      (v): v is AccountNameParts => accountNamePartsData(v) && v.account_id === args.expected_account_id, args.expected_account_id);
    if (!value.operation) fail(true);
    return value;
  }
  async close(original: AccountNamePartsWrite) {
    const args = accountNamePartsInput(original);
    return result(await this.client.request('/api/v1/journey/close_account_name_parts_v1', { method: 'POST', body: { original: args, confirm_close: true } }),
      (v): v is AccountNamePartsResolution => exact(v, ['request_id', 'state']) && v.request_id === args.request_id &&
        ['closed', 'recorded', 'recorded_expired'].includes(String(v.state)));
  }
}
