/** Saved website pipeline view, independent of lifecycle and default Hunt. */
import { record } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, shape, text, uuid, type MutationIntent } from './journey-contracts.ts';
export type HuntSelection = { version: 1; view: 'active' | 'all'; activeIds: string[] };
export type HuntSelectionData = { account_id: string; selection: HuntSelection | null; fingerprint: string;
  hunts: { id: string; slug: string; name: string; revision?: number | null }[] };
export type HuntSelectionSave = MutationIntent & { expected_account_id: string; selection: HuntSelection; expected_fingerprint: string; selected_hunt_ids: string[] };
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
export function isHuntSelection(v: unknown): v is HuntSelection {
  return record(v) && v.version === 1 && ['active', 'all'].includes(String(v.view)) && Array.isArray(v.activeIds) &&
    v.activeIds.length <= 1000 && v.activeIds.every(id => text(id, 200) && !!id) && new Set(v.activeIds).size === v.activeIds.length;
}
export function huntSelectionInput(v: unknown): HuntSelectionSave {
  shape(v, [...intentKeys, 'selection', 'expected_fingerprint', 'selected_hunt_ids']); intent(v);
  if (typeof v.expected_account_id !== 'string' || !v.expected_account_id.startsWith('jh_') || !uuid(v.expected_account_id.slice(3)) || !isHuntSelection(v.selection) || !hash(v.expected_fingerprint) || !Array.isArray(v.selected_hunt_ids) ||
    v.selected_hunt_ids.length !== v.selection.activeIds.length || !v.selected_hunt_ids.every(uuid) ||
    new Set(v.selected_hunt_ids.map(id => String(id).toLowerCase())).size !== v.selected_hunt_ids.length) fail();
  shape(v.selection, ['version', 'view', 'activeIds']); return v as HuntSelectionSave;
}
export function huntSelectionResult(v: unknown) {
  return journeyResult(v, (data): data is HuntSelectionData => record(data) &&
    typeof data.account_id === 'string' && data.account_id.startsWith('jh_') && uuid(data.account_id.slice(3)) &&
    (data.selection === null || isHuntSelection(data.selection)) && hash(data.fingerprint) && Array.isArray(data.hunts) &&
    data.hunts.every(h => record(h) && uuid(h.id) && text(h.slug, 200) && !!h.slug && typeof h.name === 'string' && (h.revision == null || integer(h.revision))) &&
    new Set(data.hunts.map(h => (h as { id: string }).id.toLowerCase())).size === data.hunts.length &&
    new Set(data.hunts.map(h => (h as { slug: string }).slug)).size === data.hunts.length);
}
