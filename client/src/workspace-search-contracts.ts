/** Existing bounded browser search and exact owned location resolution. */
import { record } from './protocol.ts';
import { deadline, fail, journeyResult, shape, uuid } from './journey-contracts.ts';

export type WorkspaceSearchKind = 'Application' | 'Company' | 'Contact' | 'Document' | 'Saved search' | 'Task';
export type WorkspaceSearchInput = { query?: string; kind?: WorkspaceSearchKind | '' };
export type WorkspaceSearchMatch = { href: string; title: string; meta: string | null; type: WorkspaceSearchKind; mark: string; updatedAt: string | null };
export type WorkspaceSearchData = { state?: 'ready'; items: WorkspaceSearchMatch[] };
export type WorkspaceLocationInput = { kind: 'document' | 'search'; identifier: string };
export type WorkspaceLocation = { kind: 'document' | 'search'; id: string };
const paths = { Application: 'applications/id', Company: 'companies', Contact: 'contacts', Document: 'documents', 'Saved search': 'searches', Task: 'tasks' };
const text = (value: unknown, maximum: number): value is string => typeof value === 'string' && !value.includes('\0') && [...value].length <= maximum;
export function workspaceSearchInput(v: unknown): WorkspaceSearchInput {
  shape(v, ['query', 'kind']);
  if ((v.query !== undefined && !text(v.query, 120)) || (v.kind !== undefined &&
      (typeof v.kind !== 'string' || (v.kind !== '' && !Object.hasOwn(paths, v.kind))))) fail();
  return v as WorkspaceSearchInput;
}
export function workspaceLocationInput(v: unknown): WorkspaceLocationInput {
  shape(v, ['kind', 'identifier']);
  if (typeof v.kind !== 'string' || !['document', 'search'].includes(v.kind) || !text(v.identifier, 255) || !v.identifier) fail();
  return v as WorkspaceLocationInput;
}
function match(v: unknown): v is WorkspaceSearchMatch {
  if (!record(v) || typeof v.type !== 'string' || !Object.hasOwn(paths, v.type) || !text(v.href, 8192) ||
      !text(v.title, 100000) || !v.title || !(v.meta === null || text(v.meta, 100000)) ||
      v.mark !== v.type[0] || !(v.updatedAt === null || deadline(v.updatedAt))) return false;
  const prefix = '/app/' + paths[v.type as WorkspaceSearchKind] + '/';
  return v.href.startsWith(prefix) && /^[^\s/?#\\]+$/u.test(v.href.slice(prefix.length));
}
export const workspaceSearchResult = (v: unknown) => journeyResult(v, (v): v is WorkspaceSearchData => record(v) &&
  (v.state === undefined || v.state === 'ready') && Array.isArray(v.items) && v.items.length <= 10 && v.items.every(match));
export const workspaceLocationResult = (v: unknown) => journeyResult(v, (v): v is WorkspaceLocation => record(v) &&
  ['document', 'search'].includes(String(v.kind)) && uuid(v.id));
