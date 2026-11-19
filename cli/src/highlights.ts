import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { highlightWriteInput } from '../../client/src/highlight-contracts.ts';
import {highlightFileIntent,highlightHostFileInput,MAX_HIGHLIGHT_FIELDS_BYTES} from '../../client/src/highlight-file-contracts.ts';
import { inputBytes, inputJSON } from './input.ts';
import { privateOutput } from './private-output.ts';

export const highlightOptions: Record<string, string[]> = {
  'highlights files':['file','page','per-page','from','to','query','sort'],
  'highlights file-manifest':[], 'highlights download-record':['output'],
  'highlights save-file':['file','fields','confirm'], 'highlights save-host-file':['file','confirm'],
  'highlights list': ['file', 'page', 'per-page', 'from', 'to', 'query', 'sort'],
  'highlights get': [], 'highlights options': [], 'highlights create': ['file'],
  'highlights choices': ['company-page', 'hunt-page', 'role-page', 'per-page'],
  'highlights update': ['file'], 'highlights delete': ['file', 'confirm'],
  'highlights export': ['file', 'output'],
};
export const highlightTargets = new Set(['highlights get','highlights file-manifest','highlights download-record']);
function number(v: unknown): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !/^\d+$/u.test(v)) throw new JobHuntError('invalid_input');
  return Number(v);
}
export async function highlightCommand(command: string, target: string | undefined,
  options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if(command==='highlights file-manifest')return client.getHighlightRecordFile(target!);
  if(command==='highlights download-record')return privateOutput(options.output,()=>client.downloadHighlightRecordFile(target!));
  if(command==='highlights save-file'||command==='highlights save-host-file'){
    const input=await inputJSON(options.file as string|undefined,stdin,128*1024);
    const value=command==='highlights save-file'?highlightFileIntent(input):highlightHostFileInput(input);
    if(options.confirm!==value.expected_account_id)throw new JobHuntError('confirmation_required');
    if(command==='highlights save-host-file')return client.saveHighlightFieldsHostFile(value as Parameters<JobHuntClient['saveHighlightFieldsHostFile']>[0]);
    if(typeof options.fields!=='string'||options.fields==='-')throw new JobHuntError('invalid_input');
    return client.saveHighlightFieldsFile(value,await inputBytes(options.fields,stdin,MAX_HIGHLIGHT_FIELDS_BYTES));
  }
  if (command === 'highlights get') return client.getHighlight(target!);
  if (command === 'highlights options') return client.getHighlightOptions();
  if (command === 'highlights choices') return client.getHighlightChoices({ company_page: number(options['company-page']),
    hunt_page: number(options['hunt-page']), role_page: number(options['role-page']), per_page: number(options['per-page']) });
  if (command === 'highlights list'||command==='highlights files') {
    if (options.file !== undefined && ['page', 'per-page', 'from', 'to', 'query', 'sort'].some(key => options[key] !== undefined)) throw new JobHuntError('invalid_input');
    return (command==='highlights files'?client.listHighlightRecordFiles.bind(client):client.listHighlights.bind(client))(options.file !== undefined ? await inputJSON(options.file as string, stdin, 512 * 1024) as Parameters<JobHuntClient['listHighlights']>[0] :
      { page: number(options.page), per_page: number(options['per-page']), date_from: options.from as string | undefined, date_to: options.to as string | undefined,
        search: options.query as string | undefined, sort: options.sort as NonNullable<Parameters<JobHuntClient['listHighlights']>[0]>['sort'] });
  }
  const input = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
  if (command === 'highlights export') return privateOutput(options.output, () => client.downloadCompleteHighlights(input as Parameters<JobHuntClient['downloadCompleteHighlights']>[0]));
  const value = highlightWriteInput(input);
  if (value.action !== command.slice('highlights '.length)) throw new JobHuntError('invalid_input');
  if (value.action === 'delete' && options.confirm !== value.highlight_id) throw new JobHuntError('confirmation_required');
  return client.saveHighlight(value);
}
