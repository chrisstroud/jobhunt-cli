import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { cleanupWriteInput } from '../client/src/recurring-cleanup-contracts.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = 'abcdefab-1111-4111-8111-111111111111';
const selection = { occurrence_date: '2026-10-18', scope: 'jbr' as const, include_skipped: false };
const input = { ...selection, request_id: id, expected_account_id: 'jh_' + id,
  targets: [{ task_id: id, expected_fingerprint: 'a'.repeat(64) }], confirmed: true as const };
const row = { task_id: id, title: 'Synthetic task', application_id: null, fingerprint: 'a'.repeat(64), eligible_records: 1,
  records: [{ source: 'task', id, status: 'completed', recorded_at: '2026-10-18T12:00:00Z' }] };
const result = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const page = { ...selection, account_id: 'jh_' + id, items: [row], has_more: false, next_after_task_id: null };
const saved = { ...selection, account_id: 'jh_' + id, reopened_task_ids: [id], current: [{ task_id: id, current: { ...row, records: [], eligible_records: 0 } }] };

test('cleanup CLI preserves exact reviewed body and uses cookie-free HTTP', async () => {
  for (const write of [false, true]) {
    let calls = 0, stdout = '', stderr = '';
    const status = await runCLI(['tasks', ...(write ? ['cleanup', '--file', '-', '--confirm', selection.occurrence_date]
      : ['cleanup-preview', '--date', selection.occurrence_date, '--scope', 'jbr']), '--json'], {
      env: { JOBHUNT_TOKEN: 'synthetic-cleanup' }, stdin: Readable.from([JSON.stringify(input)]),
      stdout: new Writable({ write(chunk, _encoding, next) { stdout += chunk; next(); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(init?.credentials, 'omit'); assert.equal(init?.method, write ? 'POST' : 'GET');
        assert.equal(new URL(String(url)).pathname, '/api/v1/journey/' + (write ? 'reopen_recurring_completions_v2' : 'preview_recurring_completion_cleanup_v2'));
        if (write) assert.deepEqual(JSON.parse(String(init?.body)), input);
        else assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!), { occurrence_date: selection.occurrence_date, scope: 'jbr' });
        return Response.json(result(write ? saved : page));
      },
    }, 'test');
    assert.equal(status, 0); assert.equal(calls, 1); assert.equal(stderr, '');
    assert.deepEqual(JSON.parse(stdout).data, write ? saved : page);
  }
});

test('cleanup rejects ambiguous and unconfirmed destructive input before sending', async () => {
  for (const args of [{ ...input, targets: [...input.targets, { ...input.targets[0], task_id: id.toUpperCase() }] },
    { ...input, targets: [] }, { ...input, targets: Array(21).fill(input.targets[0]) },
    { ...input, confirmed: 1 }, { ...input, occurrence_date: '2026-02-30' }, { ...input, include_skipped: 'false' }]) {
    assert.throws(() => cleanupWriteInput(args), { code: 'invalid_input' });
  }
  for (const confirmation of [[], ['--confirm', '2026-10-17']]) {
    let stderr = '';
    const status = await runCLI(['tasks', 'cleanup', '--file', '-', ...confirmation, '--json'], {
      env: { JOBHUNT_TOKEN: 'synthetic-cleanup' }, stdin: Readable.from([JSON.stringify(input)]),
      stdout: new Writable({ write() { assert.fail('No success output'); } }),
      stderr: new Writable({ write(chunk, _encoding, next) { stderr += chunk; next(); } }),
      fetchImpl: async () => { assert.fail('Unconfirmed cleanup must not reach HTTP'); },
    }, 'test');
    assert.equal(status, 2); assert.equal(JSON.parse(stderr).error.code, 'confirmation_required');
  }
});

test('client rejects inconsistent pagination and mismatched saved-state responses', async () => {
  for (const invalid of [{ ...page, next_after_task_id: id }, { ...page, items: [row, row] },
    { ...page, items: [{ ...row, eligible_records: 2 }] }]) {
    const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-cleanup' }, fetchImpl: async () => Response.json(result(invalid)) });
    await assert.rejects(client.previewRecurringCleanup(selection), { code: 'invalid_response' });
  }
  const client = new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token: 'synthetic-cleanup' },
    fetchImpl: async () => Response.json(result({ ...saved, current: [] })) });
  await assert.rejects(client.reopenRecurringCompletions(input), { code: 'invalid_response' });
});
