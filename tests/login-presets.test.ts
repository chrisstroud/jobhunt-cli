import assert from 'node:assert/strict';
import test from 'node:test';
import { FULL_SCOPES, INTEGRATION_SCOPES, LOGIN_PRESETS, LOGIN_SCOPES, READ_ONLY_SCOPES, loginScopes } from '../cli/src/oauth.ts';
import { PLUGIN_SCOPES } from '../cli/src/plugin.ts';

// What each MCP tool needs for the everyday writes the guides promise (mcp/v2/contract.json securitySchemes).
const EVERYDAY_WRITES = ['write:applications', 'write:tasks', 'write:contacts', 'write:interviews', 'write:documents', 'write:highlights'];
// Writes that change what the person publishes or how the search is organised: opt-in, never in a bare login.
const OPT_IN_WRITES = ['write:profile', 'write:campaigns', 'write:companies'];

test('a bare login asks for the standard set: the reads plus the everyday writes the guides promise', () => {
  assert.deepEqual(loginScopes(), INTEGRATION_SCOPES);
  for (const scope of EVERYDAY_WRITES) assert.ok(INTEGRATION_SCOPES.includes(scope), `standard includes ${scope}`);
  for (const scope of [...OPT_IN_WRITES, 'read:calendar', 'write:calendar', 'read:account-export', 'write:developer', 'write:extensions', 'write:notifications']) {
    assert.ok(!INTEGRATION_SCOPES.includes(scope), `standard leaves ${scope} to an explicit choice`);
  }
  assert.ok(INTEGRATION_SCOPES.includes('read:highlights') && INTEGRATION_SCOPES.includes('read:activity'));
});
test('every permission in every preset is one the login accepts, once', () => {
  for (const [name, scopes] of Object.entries(LOGIN_PRESETS)) {
    assert.ok(scopes.includes('read:profile'), `${name} keeps read:profile`);
    assert.equal(new Set(scopes).size, scopes.length, `${name} has no repeats`);
    assert.ok(scopes.every(scope => LOGIN_SCOPES.includes(scope)), `${name} is inside the accepted set`);
    assert.deepEqual(loginScopes(undefined, name), scopes);
  }
});
test('read-only asks for no write permission and keeps every read of the standard set', () => {
  assert.deepEqual(loginScopes(undefined, 'read-only'), READ_ONLY_SCOPES);
  assert.ok(READ_ONLY_SCOPES.every(scope => scope.startsWith('read:')));
  assert.deepEqual(READ_ONLY_SCOPES, INTEGRATION_SCOPES.filter(scope => scope.startsWith('read:')));
});
test('full is the standard set plus the opt-in writes, and nothing account-level', () => {
  assert.deepEqual(FULL_SCOPES, [...INTEGRATION_SCOPES, ...OPT_IN_WRITES]);
  assert.ok(!FULL_SCOPES.some(scope => /account-export|developer|extensions|notifications|calendar/u.test(scope)));
});
test('a preset and an explicit list never combine, and an unknown preset is refused', () => {
  assert.throws(() => loginScopes('read:profile', 'read-only'), { code: 'invalid_input' });
  assert.throws(() => loginScopes(undefined, 'everything'), { code: 'invalid_input' });
  assert.throws(() => loginScopes(undefined, '__proto__'), { code: 'invalid_input' });
  assert.deepEqual(loginScopes('read:profile,read:tasks'), ['read:profile', 'read:tasks']);
});
test('the plugin commands still need only the ten permissions of the plugin contract, all inside the standard set', () => {
  assert.equal(PLUGIN_SCOPES.length, 10);
  assert.deepEqual(PLUGIN_SCOPES.filter(scope => scope.startsWith('write:')), ['write:applications']);
  assert.ok(PLUGIN_SCOPES.every(scope => INTEGRATION_SCOPES.includes(scope)));
});
