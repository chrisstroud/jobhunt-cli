import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';

export const workspaceSearchOptions: Record<string, string[]> = {
  'workspace get': ['hunt-id', 'application-id', 'document-id', 'section', 'page', 'hunts-page', 'documents-page', 'status', 'query', 'include-records'],
  'workspace search': ['query', 'kind'],
  'workspace resolve': ['kind', 'identifier'],
};
export function workspaceSearchCommand(command: string, options: Record<string, string | boolean | undefined>, client: JobHuntClient) {
  if (command === 'workspace get') {
    const page = (value: string | boolean | undefined) => {
      if (value === undefined) return undefined;
      if (typeof value !== 'string' || !/^[0-9]+$/u.test(value)) throw new JobHuntError('invalid_input');
      return Number(value);
    };
    return client.getWorkspaceView({ search_id: options['hunt-id'] as string | undefined, application_id: options['application-id'] as string | undefined,
      document_id: options['document-id'] as string | undefined, section: options.section as string | undefined,
      page: page(options.page), hunts_page: page(options['hunts-page']), documents_page: page(options['documents-page']),
      status: options.status as string | undefined, query: options.query as string | undefined,
      include_application_records: options['include-records'] as boolean | undefined });
  }
  if (command === 'workspace search') return client.searchWorkspace({ query: options.query as string | undefined,
    kind: options.kind as NonNullable<Parameters<JobHuntClient['searchWorkspace']>[0]>['kind'] });
  return client.resolveWorkspaceLocation({ kind: options.kind as 'document' | 'search', identifier: options.identifier as string });
}
