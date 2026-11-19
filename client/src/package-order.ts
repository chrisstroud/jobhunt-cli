/** Package display order; no document content, membership or export changes. */
import { record } from './protocol.ts';
import { fail, intent, intentKeys, journeyResult, shape, uuid, type MutationIntent } from './journey-contracts.ts';
export type PackageOrder = { package_id: string; document_ids: string[]; fingerprint: string };
export type PackageOrderWrite = MutationIntent & { package_id: string; document_ids: string[]; expected_fingerprint: string };
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
function ids(v: unknown, anchor: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.length <= 500 && v.every(uuid) && new Set(v).size === v.length && v.includes(anchor);
}
export function packageOrderWrite(v: unknown): PackageOrderWrite {
  shape(v, [...intentKeys, 'package_id', 'document_ids', 'expected_fingerprint']); intent(v);
  if (!uuid(v.package_id) || !hash(v.expected_fingerprint) || !ids(v.document_ids, v.package_id)) fail();
  return structuredClone(v) as PackageOrderWrite;
}
export function packageOrderRead(v: unknown): {package_id: string} {
  shape(v, ['package_id']); if (!uuid(v.package_id)) fail(); return {package_id:v.package_id as string};
}
export function packageOrderResult(v: unknown, packageId: string) {
  return journeyResult(v, (d): d is PackageOrder => record(d) && d.package_id === packageId && hash(d.fingerprint) && ids(d.document_ids, packageId));
}
