/** Lossless native JSON validation shared by private document carriers. */
const unicode = (value: string) => !value.includes('\0') && new TextDecoder('utf-8', { ignoreBOM: true }).decode(new TextEncoder().encode(value)) === value;
export function isNativeJson(value: unknown, seen = new Set<unknown>()): boolean {
  if (typeof value === 'string') return unicode(value);
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value) ? value.every(item => isNativeJson(item, seen))
    : [Object.prototype, null].includes(Object.getPrototypeOf(value))
      && Object.entries(value).every(([key, item]) => unicode(key) && isNativeJson(item, seen));
  seen.delete(value);
  return valid;
}
export function stableJsonValue(value: unknown): unknown {
  return Array.isArray(value) ? value.map(stableJsonValue) : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJsonValue((value as Record<string, unknown>)[key])])) : value;
}
