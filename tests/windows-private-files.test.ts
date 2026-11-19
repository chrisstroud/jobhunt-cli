import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { credentialBytes, newCredentialFile } from '../cli/src/credential-files.ts';
import { privateOutput } from '../cli/src/private-output.ts';
import { windowsPrivateName } from '../cli/src/windows-private-files.ts';
import { assertPrivateFile, privateMode } from './private-file-fixture.ts';

test('Windows private paths exclude remote shares, alternate streams and device aliases', () => {
  assert.equal(windowsPrivateName('C:\\Users\\Synthetic User\\resume.pdf'), true);
  for (const path of ['\\\\server\\share\\file', '\\\\?\\C:\\file', 'C:\\file:secret', 'C:\\NUL.txt', 'C:\\Com1', 'C:\\LPT9.pdf', 'C:\\trailing.\\file', 'C:\\trailing ', 'C:\\line\nfeed']) {
    assert.equal(windowsPrivateName(path), false);
  }
});

test('Windows private publication verifies native ACLs and refuses unsafe state before IO', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jobhunt-windows-private-'));
  try {
    const file = join(directory, 'credential.json'), bytes = Buffer.from('synthetic private bytes');
    await newCredentialFile(file, bytes);
    await assertPrivateFile(file); assert.deepEqual(await credentialBytes(file), bytes);
    await assert.rejects(newCredentialFile(file, Buffer.from('replacement')), /output_exists/);
    assert.deepEqual(await readFile(file), bytes);
    assert.deepEqual(await readdir(directory), ['credential.json']);
    await privateMode(file, 0o644);
    await assert.rejects(credentialBytes(file), /unsafe_credential_permissions/);
    const broad = join(directory, 'broad.json'); await writeFile(broad, 'synthetic');
    await assert.rejects(credentialBytes(broad), /unsafe_credential_permissions/);
    await privateMode(directory, 0o777);
    let reads = 0;
    await assert.rejects(privateOutput(join(directory, 'download.pdf'), async () => { reads++; return { bytes }; }), /unsafe_credential_permissions/);
    assert.equal(reads, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
