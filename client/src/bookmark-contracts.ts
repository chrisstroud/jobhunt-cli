/** Wire validation for the existing account-owned bookmark operations. */
import { record } from './protocol.ts';
import { fail, integer, intent, intentKeys, journeyResult, shape, type MutationIntent } from './journey-contracts.ts';

export type HuntBookmark = { id: string; name: string; url: string; note: string };
export type HuntBookmarks = { version: 1; revision: number; items: HuntBookmark[] };
export type BookmarkSaveInput = MutationIntent & { bookmarks: HuntBookmarks; expected_revision: number };
const string = (value: unknown, max: number, min = 0) => typeof value === 'string' &&
  [...value].length >= min && [...value].length <= max;
function bookmark(value: unknown): value is HuntBookmark {
  return record(value) && string(value.id, 80, 1) && string(value.name, 80, 1) &&
    string(value.url, 2048) && string(value.note, 180);
}
function bookmarks(value: unknown): value is HuntBookmarks {
  return record(value) && value.version === 1 && integer(value.revision, 0, 2147483646) &&
    Array.isArray(value.items) && value.items.length <= 50 && value.items.every(bookmark);
}
export function bookmarkSaveInput(value: unknown): BookmarkSaveInput {
  shape(value, [...intentKeys, 'bookmarks', 'expected_revision']); intent(value);
  if (!integer(value.expected_revision, 0, 2147483645) || !bookmarks(value.bookmarks)) fail();
  shape(value.bookmarks, ['version', 'revision', 'items']);
  for (const item of value.bookmarks.items as HuntBookmark[]) shape(item, ['id', 'name', 'url', 'note']);
  // The service owns URL safety, uniqueness and next-revision policy.
  return value as BookmarkSaveInput;
}
export const bookmarkResult = (value: unknown) => journeyResult(value, bookmarks);
