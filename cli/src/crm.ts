import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { crmMutationInput } from '../../client/src/crm-contracts.ts';
import { inputJSON } from './input.ts';

export const crmOptions: Record<string, string[]> = {
  'crm contacts': ['page'], 'crm companies': ['page'],
  'crm contact': ['related-page'], 'crm company': ['related-page'],
  'crm save-contact': ['file', 'confirm'], 'crm save-company': ['file', 'confirm'],
};
export const crmTargets = new Set(['crm contact', 'crm company']);
function page(value: string | boolean | undefined) {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) throw new JobHuntError('invalid_input');
  return Number(value);
}
export async function crmCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  const kind = command.endsWith('companies') || command.endsWith('company') ? 'company' : 'contact';
  if (command === 'crm contacts' || command === 'crm companies')
    return client.listCrm({ kind, page: page(options.page) });
  if (crmTargets.has(command)) return client.getCrm({ kind, entity_id: target!,
    related_page: page(options['related-page']) });
  const input = crmMutationInput(await inputJSON(options.file as string | undefined, stdin, 64 * 1024), kind);
  const confirmation = input.action === 'delete' ? input.entity_id : input.action.endsWith('_delete') ? input.item_id :
    input.action === 'unlink_application' ? input.application_id : null;
  if (confirmation && options.confirm !== confirmation) throw new JobHuntError('confirmation_required');
  return kind === 'contact' ? client.saveCrmContact(input) : client.saveCrmCompany(input);
}
