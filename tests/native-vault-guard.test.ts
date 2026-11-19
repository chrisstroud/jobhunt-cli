import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('native vault smoke refuses local or self-hosted execution before reading an artifact', () => {
  for (const selection of [
    { GITHUB_ACTIONS: 'false', RUNNER_ENVIRONMENT: 'github-hosted', JOBHUNT_TEST_NATIVE_VAULT: '1' },
    { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'self-hosted', JOBHUNT_TEST_NATIVE_VAULT: '1' },
    { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', JOBHUNT_TEST_NATIVE_VAULT: '0' },
  ]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/native-vault-smoke.mjs', import.meta.url))],
      { env: { ...process.env, ...selection }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Native credential check failed at host guard. Private details withheld.\n');
  }
});
