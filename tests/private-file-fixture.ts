import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

// Independent native fixture/readback: never infer Windows privacy from chmod.
async function acl(path: string, mode: number, verify = false) {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
try {
  $path = $env:JH_FIXTURE_PATH
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl = Get-Acl -LiteralPath $path
  if ($env:JH_FIXTURE_VERIFY -eq '1') {
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'unsafe' }
    $allow = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | Where-Object { $_.AccessControlType -eq 'Allow' })
    if ($allow.Length -ne 1 -or $allow[0].IdentityReference.Value -ne $sid.Value -or [int]$allow[0].FileSystemRights -ne 2032127) { throw 'unsafe' }
  } else {
    $directory = (Get-Item -Force -LiteralPath $path).PSIsContainer
    if ($directory) { $acl = [Security.AccessControl.DirectorySecurity]::new() }
    else { $acl = [Security.AccessControl.FileSecurity]::new() }
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow'))
    if ($env:JH_FIXTURE_MODE -ne '384') {
      $everyone = [Security.Principal.SecurityIdentifier]::new('S-1-1-0')
      $right = 'Read'
      if ($env:JH_FIXTURE_MODE -eq '511') { $right = 'FullControl' }
      $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, $right, 'Allow'))
    }
    Set-Acl -LiteralPath $path -AclObject $acl
  }
  [Console]::Out.Write('ok')
} catch { exit 1 }
`;
  const result = await promisify(execFile)(join(process.env.SystemRoot!, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { env: { ...process.env, JH_FIXTURE_PATH: path, JH_FIXTURE_MODE: String(mode), JH_FIXTURE_VERIFY: verify ? '1' : '0' }, windowsHide: true, timeout: 15000 });
  assert.equal(result.stdout, 'ok');
}

export async function privateFixtureFile(path: string, text: string): Promise<void> {
  await writeFile(path, text, { mode: 0o600 });
  if (process.platform === 'win32') await acl(path, 0o600);
}

export async function privateMode(path: string, mode: number): Promise<void> {
  if (process.platform === 'win32') await acl(path, mode);
  else await chmod(path, mode);
}

export async function assertPrivateFile(path: string): Promise<void> {
  if (process.platform === 'win32') await acl(path, 0o600, true);
  else assert.equal((await stat(path)).mode & 0o777, 0o600);
}
