import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const packageCommandOptions: Record<string, string[]> = {
  'application-documents get': [], 'application-documents choices': ['query', 'page'],
  'application-documents close-original': ['file'],
  'application-documents select': ['file'], 'application-documents customize': ['file'], 'application-documents letter': ['file'],
  'packages check-original': ['file'], 'packages close-original': ['file'],
  'packages preview': ['file', 'output'], 'packages prepare': ['file'], 'packages get': [], 'packages list': ['before-id'],
  'packages download': ['version-id', 'output'],
};
export const packageCommandTargets = new Set(['application-documents get', 'application-documents choices', 'packages get', 'packages list', 'packages download']);

async function savePDF(client: JobHuntClient, packageId: string, options: Record<string, string | boolean | undefined>) {
  if (typeof options['version-id'] !== 'string') throw new JobHuntError('invalid_input');
  const version = options['version-id'];
  return privateOutput(options.output, () => client.downloadPreparedDocument({ package_id: packageId, version_id: version }));
}

export async function packageCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (command === 'application-documents get') return client.getApplicationDocuments(target!);
  if (command === 'application-documents choices') {
    if (options.page !== undefined && (typeof options.page !== 'string' || !/^\d+$/u.test(options.page))) throw new JobHuntError('invalid_input');
    return client.listApplicationResumeChoices({ app_slug: target!, query: options.query as string | undefined, page: options.page === undefined ? undefined : Number(options.page) });
  }
  if (command === 'packages get') return client.getPreparedPackage(target!);
  if (command === 'packages list') return client.listApplicationPackages({ application_id: target!, before_id: options['before-id'] as string | undefined });
  if (command === 'packages download') return savePDF(client, target!, options);
  const input = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'packages check-original') return client.checkPreparationOriginal(input as Parameters<JobHuntClient['checkPreparationOriginal']>[0]);
  if (command === 'packages close-original') return client.closePreparationOriginal(input as Parameters<JobHuntClient['closePreparationOriginal']>[0]);
  if (command === 'application-documents close-original') return client.closeApplicationDocumentsOriginal(input as Parameters<JobHuntClient['closeApplicationDocumentsOriginal']>[0]);
  if (command === 'application-documents select') return client.selectApplicationDocuments(input as Parameters<JobHuntClient['selectApplicationDocuments']>[0]);
  if (command === 'application-documents customize') return client.customizeApplicationDocuments(input as Parameters<JobHuntClient['customizeApplicationDocuments']>[0]);
  if (command === 'application-documents letter') return client.createCoverLetter(input as Parameters<JobHuntClient['createCoverLetter']>[0]);
  if (command === 'packages preview') return privateOutput(options.output, () => client.downloadPreparedDocumentPreview(input as Parameters<JobHuntClient['downloadPreparedDocumentPreview']>[0]));
  if (command === 'packages prepare') return client.prepareApplicationPackage(input as Parameters<JobHuntClient['prepareApplicationPackage']>[0]);
  throw new JobHuntError('usage_error');
}
