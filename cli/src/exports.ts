import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { cancelExportInput } from '../../client/src/export-contracts.ts';
import { inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const exportOptions: Record<string, string[]> = {
  'exports inspect': ['file'], 'exports inspect-page': ['file'], 'exports prepare': ['file'],
  'exports prepare-page': ['file'], 'exports get': [], 'exports download': ['output'], 'exports cancel': ['file', 'confirm'],
  'bundles inspect': ['file'], 'bundles prepare': ['file'], 'bundles get': [], 'bundles download': ['output'], 'bundles cancel': ['file', 'confirm'],
};
export const exportTargets = new Set(['exports get', 'exports download', 'bundles get', 'bundles download']);
export async function exportCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'exports get') return client.getDocumentExport({ export_id: target! });
  if (command === 'exports download') return privateOutput(options.output, () => client.downloadDocumentExport({ export_id: target! }));
  if (command === 'bundles get') return client.getDocumentBundle({ export_id: target! });
  if (command === 'bundles download') return privateOutput(options.output, () => client.downloadDocumentBundle({ export_id: target! }));
  const input = await inputJSON(options.file as string | undefined, stdin, 16384);
  if (command === 'bundles inspect') return client.getDocumentBundleSource(input as Parameters<JobHuntClient['getDocumentBundleSource']>[0]);
  if (command === 'bundles prepare') return client.prepareDocumentBundle(input as Parameters<JobHuntClient['prepareDocumentBundle']>[0]);
  if (command === 'exports inspect') return client.getDocumentExportSource(input as Parameters<JobHuntClient['getDocumentExportSource']>[0]);
  if (command === 'exports inspect-page') return client.getHuntPageExportSource(input as Parameters<JobHuntClient['getHuntPageExportSource']>[0]);
  if (command === 'exports prepare') return client.prepareDocumentExport(input as Parameters<JobHuntClient['prepareDocumentExport']>[0]);
  if (command === 'exports prepare-page') return client.prepareHuntPageExport(input as Parameters<JobHuntClient['prepareHuntPageExport']>[0]);
  if (command === 'exports cancel' || command === 'bundles cancel') {
    const value = cancelExportInput(input);
    if (options.confirm !== value.expected_account_id) throw new JobHuntError('confirmation_required');
    return command === 'bundles cancel' ? client.cancelDocumentBundle(value) : client.cancelDocumentExport(value);
  }
  throw new JobHuntError('usage_error');
}
