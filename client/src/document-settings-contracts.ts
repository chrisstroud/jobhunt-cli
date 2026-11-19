/** Account document defaults; independent of document content and product palettes. */
import { record } from './protocol.ts';
import { fail, intent, intentKeys, journeyResult, shape, uuid, type MutationIntent } from './journey-contracts.ts';

export type DocumentDefaults = {
  default_download: 'combined' | 'resume' | 'separate';
  default_page_size: 'us-letter' | 'a4';
  default_theme: 'imprecv'; default_view: '50'; show_beta_themes: false;
};
export type DocumentSettingsData = { account_id: string; fingerprint: string; settings: DocumentDefaults };
export type DocumentSettingsWrite = MutationIntent & { expected_account_id: string; expected_fingerprint: string;
  patch: Partial<Pick<DocumentDefaults, 'default_download' | 'default_page_size'>> };
const fingerprint = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const account = (v: unknown) => typeof v === 'string' && v.startsWith('jh_') && uuid(v.slice(3));
function validField(name: string, value: unknown): boolean {
  return typeof value === 'string' && (name === 'default_download'
    ? ['combined', 'resume', 'separate'].includes(value)
    : name === 'default_page_size' && ['us-letter', 'a4'].includes(value));
}
export function documentSettingsInput(v: unknown): DocumentSettingsWrite {
  shape(v, [...intentKeys, 'expected_fingerprint', 'patch']); intent(v);
  if (!account(v.expected_account_id) || !fingerprint(v.expected_fingerprint)) fail();
  shape(v.patch, ['default_download', 'default_page_size']);
  if (!Object.keys(v.patch).length || !Object.entries(v.patch).every(([name, value]) => validField(name, value))) fail();
  return v as DocumentSettingsWrite;
}
function settingsData(v: unknown): v is DocumentSettingsData {
  if (!record(v) || !account(v.account_id) || !fingerprint(v.fingerprint) || !record(v.settings)) return false;
  return validField('default_download', v.settings.default_download) && validField('default_page_size', v.settings.default_page_size)
    && v.settings.default_theme === 'imprecv' && v.settings.default_view === '50' && v.settings.show_beta_themes === false;
}
export const documentSettingsResult = (v: unknown) => journeyResult(v, settingsData);
