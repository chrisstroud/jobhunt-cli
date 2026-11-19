import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { huntAssignmentInput, huntCreateInput, huntCurrentInput, huntDeleteInput, huntSaveInput, pipelineInitializeInput } from '../../client/src/hunt-contracts.ts';
import { inputJSON } from './input.ts';

export const huntOptions: Record<string, string[]> = {
  'hunts directory': ['page'], 'hunts workspace': ['hunts-page', 'companies-page', 'resumes-page'],
  'hunts workspace-save': ['file'], 'hunts remove': ['file', 'confirm'],
  'hunts list': ['page'], 'hunts get': [], 'hunts create': ['file'], 'hunts save': ['file'],
  'hunts summary': [], 'hunts update': ['file'], 'hunts rename': ['file'],
  'hunts set-current': ['file', 'confirm'], 'hunts delete': ['file', 'confirm'],
  'pipeline initialize': ['file'],
  'hunts selection': [], 'hunts selection-save': ['file'],
  'hunts assignment-review': [], 'hunts assign-all': ['file', 'confirm'],
};
export const huntTargets = new Set(['hunts workspace', 'hunts get', 'hunts summary', 'hunts assignment-review']);
export async function huntCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'hunts selection') return client.getHuntSelection();
  if (command === 'hunts workspace') {
    const pages: Record<string, number> = {};
    for (const key of ['hunts-page', 'companies-page', 'resumes-page']) {
      if (options[key] === undefined) continue;
      if (typeof options[key] !== 'string' || !/^\d+$/u.test(options[key] as string)) throw new JobHuntError('invalid_input');
      pages[key.replace('-', '_')] = Number(options[key]);
    }
    return client.getHuntWorkspace({ search_id: target!, ...pages });
  }
  if (command === 'hunts list' || command === 'hunts directory') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page)))
      throw new JobHuntError('invalid_input');
    const args = { page: options.page === undefined ? 1 : Number(options.page) };
    return command === 'hunts directory' ? client.listHuntDirectory(args) : client.listHunts(args);
  }
  if (command === 'hunts assignment-review') return client.getHuntAssignment({ search_id: target! });
  if (command === 'hunts get') return client.getHunt({ search_id: target! });
  if (command === 'hunts summary') return client.getHuntSummary({ search_id: target! });
  const value = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'hunts selection-save') return client.saveHuntSelection(value as Parameters<JobHuntClient['saveHuntSelection']>[0]);
  if (command === 'hunts workspace-save') return client.saveHuntWorkspace(value as Parameters<JobHuntClient['saveHuntWorkspace']>[0]);
  if (command === 'hunts remove') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || options.confirm !== (value as Record<string, unknown>).search_id) throw new JobHuntError('confirmation_required');
    return client.removeHunt(value as Parameters<JobHuntClient['removeHunt']>[0]);
  }
  if (command === 'hunts update') return client.updateHunt(value as Parameters<JobHuntClient['updateHunt']>[0]);
  if (command === 'hunts rename') return client.renameHunt(value as Parameters<JobHuntClient['renameHunt']>[0]);
  if (command === 'hunts assign-all') {
    const input = huntAssignmentInput(value);
    if (options.confirm !== input.search_id) throw new JobHuntError('confirmation_required');
    return client.assignAllHuntApplications(input);
  }
  if (command === 'hunts create') return client.createHunt(huntCreateInput(value));
  if (command === 'hunts save') return client.saveHunt(huntSaveInput(value));
  if (command === 'pipeline initialize') return client.initializePipeline(pipelineInitializeInput(value));
  const input = command === 'hunts set-current' ? huntCurrentInput(value) : huntDeleteInput(value);
  if (options.confirm !== input.search_id) throw new JobHuntError('confirmation_required');
  return command === 'hunts set-current' ? client.setCurrentHunt(input as ReturnType<typeof huntCurrentInput>) :
    client.deleteHunt(input as ReturnType<typeof huntDeleteInput>);
}
