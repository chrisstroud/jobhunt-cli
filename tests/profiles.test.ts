import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const token = 'synthetic_profile_credential';
const profile = { id, name: 'Synthetic identity', is_default: true, updated_at: '2026-10-19T00:00:00.123456',
  linked_package_count: 0, linked_hunt_page: false, public_use: false, personal_data: { first_name: 'Synthetic' }, usage_revision: 'a'.repeat(64) };
const input = { request_id: id, expected_account_id: 'jh_' + id, name: profile.name, personal_data: profile.personal_data,
  expected_default_profile_id: null, is_default: false, acknowledge_linked_updates: true as const };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const saved = ready({ profile_id: id, profile, default_profile_id: id });
const client = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1]);

test('personal-only edits preserve the original operation and exact input without name/default selection or retries', async () => {
  const value = { id, name: '😀'.repeat(50), personal_data: { first_name: 'Synthetic' }, updated_at: null, public_use: true };
  const intent = { request_id: id, profile_id: id, expected_updated_at: null, personal_data: value.personal_data, acknowledge_linked_updates: true as const };
  let calls = 0;
  const api = client(async (url, init) => {
    calls++;
    if (init?.method === 'POST') {
      assert.ok(String(url).endsWith('/save_contact_profile_v2'));
      assert.deepEqual(JSON.parse(String(init.body)), intent);
    } else assert.ok(String(url).includes('/get_contact_profile_v2?'));
    return Response.json(ready(value));
  });
  assert.deepEqual((await api.getProfilePersonal(id)).data, value);
  assert.deepEqual((await api.saveProfilePersonal(intent)).data, value);
  assert.equal(calls, 2);
  await assert.rejects(client(async () => { calls++; throw new Error('private diagnostics'); }).saveProfilePersonal(intent), /network_error|request_failed/);
  assert.equal(calls, 3);
});

test('personal-only edits require acknowledgment and version and reject broader profile fields before HTTP', async () => {
  let calls = 0;
  const api = client(async () => { calls++; return Response.json(ready({})); });
  const intent = { request_id: id, profile_id: id, expected_updated_at: null, personal_data: {}, acknowledge_linked_updates: true };
  for (const value of [{ ...intent, name: 'Unexpected rename' }, { ...intent, is_default: true },
    { ...intent, expected_updated_at: undefined }, { ...intent, acknowledge_linked_updates: false },
    { ...intent, personal_data: { notes: 'x'.repeat(100001) } }]) {
    await assert.rejects(api.saveProfilePersonal(value as never), /invalid_input/);
  }
  assert.equal(calls, 0);
  await assert.rejects(client(async () => Response.json(ready({ id: '22222222-2222-4222-8222-222222222222',
    name: '', personal_data: {}, updated_at: null, public_use: false }))).getProfilePersonal(id), /invalid_response/);
});

test('portable profile directory and photo upload preserve retained empty names and exact native photo intents', async () => {
  const value = { id, name: '', personal_data: {}, updated_at: null, public_use: false };
  const intent = { request_id: id, profile_id: id, expected_updated_at: null, acknowledge_linked_updates: true as const };
  const api = client(async (url, init) => {
    if (init?.method === 'POST') {
      assert.ok(String(url).endsWith('/upload_profile_photo'));
      assert.deepEqual(JSON.parse(String(init.body)), { ...intent, image_chunks: [png.toString('base64')] });
      return Response.json(ready(value));
    }
    assert.ok(String(url).includes('/list_profile_directory?'));
    return Response.json(ready({ items: [{ id, name: '', updated_at: null, is_default: false,
      linked_package_count: 0, linked_hunt_page: false }], page: 1, total: 1, has_more: false }));
  });
  assert.equal((await api.listProfileDirectory()).data?.items[0].name, '');
  assert.equal((await api.uploadProfilePhoto(intent, png)).data?.name, '');
  await assert.rejects(client(async () => Response.json(ready({ items: [], page: 1, total: 1, has_more: false }))).listProfileDirectory(), /invalid_response/);
});

test('native identity save keeps its original input and binds created output to the accepted receipt', async () => {
  const intent = { request_id: id, name: '😀'.repeat(50), personal_data: {}, is_default: false, acknowledge_linked_updates: true as const };
  const data = { id, name: intent.name, personal_data: {}, is_default: true, updated_at: null,
    public_use: false, linked_hunt_page: false, linked_package_count: 0 };
  const operation = { id, status: 'succeeded', kind: 'save_hunt_profile_v2', resource: { id, kind: 'profile', label: 'Hunt profile', revision: null },
    retry_after_seconds: 0, retry_expires_at: '2026-10-23T00:00:00Z' };
  const api = client(async (url, init) => {
    assert.ok(String(url).endsWith('/save_profile_identity'));
    assert.deepEqual(JSON.parse(String(init?.body)), intent);
    return Response.json({ ...ready(data), operation });
  });
  assert.deepEqual((await api.saveProfileIdentity(intent)).data, data);
  await assert.rejects(client(async () => Response.json({ ...ready({ ...data, id: '22222222-2222-4222-8222-222222222222' }), operation })).saveProfileIdentity(intent), /invalid_response/);
});

test('profile writes retain exact reviewed identity, account and request without retries', async () => {
  let calls = 0;
  const api = client(async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/save_contact_profile'));
    assert.deepEqual(JSON.parse(String(init?.body)), input);
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + token);
    return Response.json(saved);
  });
  assert.deepEqual(await api.saveProfile(input), saved); assert.equal(calls, 1);
  const failing = client(async () => { calls++; throw new Error('private diagnostic'); });
  await assert.rejects(failing.saveProfile(input), /network_error|request_failed/); assert.equal(calls, 2);
});

test('unreviewed profile edits, missing versions/defaults and duplicate bulk targets fail before HTTP', async () => {
  let calls = 0; const api = client(async () => { calls++; return Response.json(saved); });
  for (const value of [{ ...input, acknowledge_linked_updates: false }, { ...input, expected_default_profile_id: undefined },
    { ...input, profile_id: id }, { ...input, personal_data: { name: 'x'.repeat(100001) } }])
    await assert.rejects(api.saveProfile(value as never), /invalid_input/);
  await assert.rejects(api.linkProfilePackages({ request_id: id, profile_id: id, expected_profile_updated_at: null,
    acknowledge_linked_updates: true, documents: [{ document_id: id, expected_revision: 1 }, { document_id: id, expected_revision: 1 }] }), /invalid_input/);
  await assert.rejects(api.deleteProfile({ request_id: id, profile_id: id, expected_updated_at: null, expected_default_profile_id: null,
    expected_usage_revision: 'a'.repeat(64), confirm_delete: false, acknowledge_retained_copies: true } as never), /invalid_input/);
  assert.equal(calls, 0);
});

test('profile lists are bounded and cannot be confused with personal data or another saved identity', async () => {
  await assert.rejects(client(async () => Response.json(ready({ items: Array(21).fill(profile), page: 1, total: 21, has_more: false,
    default_profile_id: id }))).listProfiles(), /invalid_response/);
  await assert.rejects(client(async () => Response.json({ ...saved, data: { profile_id: '22222222-2222-4222-8222-222222222222', profile,
    default_profile_id: id } })).saveProfile(input), /invalid_response/);
});

test('photo upload is bounded, has no filename and requires exact reviewed version and acknowledgment', async () => {
  let calls = 0;
  const intent = { request_id: id, profile_id: id, expected_updated_at: profile.updated_at, acknowledge_linked_updates: true as const };
  const api = client(async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/save_profile_photo'));
    assert.deepEqual(JSON.parse(String(init?.body)), { ...intent, image_chunks: [png.toString('base64')] });
    return Response.json(saved);
  });
  await api.saveProfilePhoto(intent, png);
  for (const bytes of [Buffer.from('not an image'), Buffer.alloc(367501), Buffer.from(png).fill(255, 16, 20)])
    await assert.rejects(api.saveProfilePhoto(intent, bytes), /invalid_input/);
  assert.equal(calls, 1);
});

async function cli(args: string[], fetchImpl: typeof fetch) {
  let stdout = ''; let stderr = '';
  const code = await runCLI([...args, '--json', '--non-interactive'], {
    env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]), fetchImpl,
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test');
  return { code, stdout, stderr };
}

test('destructive profile CLI commands require exact target confirmation before any request', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'profile-cli-')); let calls = 0;
  try {
    const file = join(dir, 'intent.json');
    await writeFile(file, JSON.stringify({ request_id: id, profile_id: id, expected_updated_at: profile.updated_at,
      expected_default_profile_id: id, expected_usage_revision: profile.usage_revision, confirm_delete: true, acknowledge_retained_copies: true }));
    const result = await cli(['profiles', 'delete', '--file', file], async () => { calls++; return Response.json(saved); });
    assert.equal(result.code, 2); assert.equal(JSON.parse(result.stderr).error.code, 'confirmation_required');
    assert.equal(result.stdout, ''); assert.equal(calls, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('photo downloads validate PNG bytes, use private permissions and preserve existing files/symlinks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'profile-output-')); let calls = 0;
  const fetchImpl = async () => { calls++; return Response.json(ready({ photo_id: id, image_chunks: ['data:image/png;base64,' + png.toString('base64')] })); };
  try {
    const output = join(dir, 'photo.png');
    const result = await cli(['profiles', 'photo-download', id, '--output', output], fetchImpl);
    assert.equal(result.code, 0); assert.equal(JSON.parse(result.stdout).saved, true);
    assert.deepEqual(await readFile(output), png); await assertPrivateFile(output);
    assert.equal((await cli(['profiles', 'photo-download', id, '--output', output], fetchImpl)).code, 7);
    const link = join(dir, 'link.png'); await symlink(output, link);
    assert.equal((await cli(['profiles', 'photo-download', id, '--output', link], fetchImpl)).code, 7);
    assert.equal(calls, 1);
    const invalid = await cli(['profiles', 'photo-download', id, '--output', join(dir, 'invalid.png')], async () =>
      Response.json(ready({ photo_id: id, image_chunks: ['data:image/svg+xml;base64,PHN2Zz4='] })));
    assert.equal(invalid.code, 7); await assert.rejects(stat(join(dir, 'invalid.png')), { code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
