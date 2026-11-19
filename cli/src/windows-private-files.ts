import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { constants } from 'node:fs';
import { lstat, mkdtemp, open, realpath, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve, win32 } from 'node:path';
import { JobHuntError } from '../../client/src/index.ts';

// No credentials or document bytes enter PowerShell, its arguments or output.
// Windows PowerShell supplies the native .NET ACL APIs without a new package.
const aclScript = String.raw`
$ErrorActionPreference = 'Stop'
try {
  $path = $env:JOBHUNT_PRIVATE_PATH
  $action = $env:JOBHUNT_PRIVATE_ACTION
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $trusted = @($sid.Value, 'S-1-5-18', 'S-1-5-32-544')
  $installer = [Security.Principal.NTAccount]::new('NT SERVICE', 'TrustedInstaller')
  $trusted += $installer.Translate([Security.Principal.SecurityIdentifier]).Value
  function Check-Parent([string] $value) {
    while ($value) {
      if (([IO.File]::GetAttributes($value) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'unsafe' }
      $acl = [IO.Directory]::GetAccessControl($value)
      if ($trusted -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value) { throw 'unsafe' }
      foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -ne 'Allow' -or ($rule.PropagationFlags -band 2) -ne 0) { continue }
        # Adding siblings cannot replace an existing protected child. Deleting
        # children or changing an ancestor's ownership/ACL/attributes can.
        $dangerous = 64 -bor 65536 -bor 262144 -bor 524288 -bor 16 -bor 256
        if ($trusted -notcontains $rule.IdentityReference.Value -and ([int]$rule.FileSystemRights -band $dangerous) -ne 0) { throw 'unsafe' }
      }
      $parent = [IO.Directory]::GetParent($value)
      if ($null -eq $parent) { break }
      $value = $parent.FullName
    }
  }
  function File-Security {
    $acl = [Security.AccessControl.FileSecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($sid)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow'))
    return $acl
  }
  if ($action -eq 'parent') { Check-Parent $path }
  elseif ($action -eq 'directory') {
    Check-Parent ([IO.Path]::GetDirectoryName($path))
    if ([IO.Directory]::GetFileSystemEntries($path).Length -ne 0) { throw 'unsafe' }
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($sid)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow'))
    [IO.Directory]::SetAccessControl($path, $acl)
  }
  elseif ($action -eq 'create') {
    Check-Parent ([IO.Path]::GetDirectoryName($path))
    $stream = [IO.FileStream]::new($path, [IO.FileMode]::CreateNew, [Security.AccessControl.FileSystemRights]::FullControl, [IO.FileShare]::None, 4096, [IO.FileOptions]::WriteThrough, (File-Security))
    $stream.Flush($true)
    $stream.Dispose()
  }
  elseif ($action -eq 'file') {
    Check-Parent ([IO.Path]::GetDirectoryName($path))
    if (([IO.File]::GetAttributes($path) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'unsafe' }
    $acl = [IO.File]::GetAccessControl($path)
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'unsafe' }
    $ownRule = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
      if ($rule.AccessControlType -ne 'Allow') { continue }
      if ($rule.IdentityReference.Value -ne $sid.Value) { throw 'unsafe' }
      if (([int]$rule.FileSystemRights -band 2032127) -eq 2032127) { $ownRule = $true }
    }
    if (-not $ownRule) { throw 'unsafe' }
  }
  elseif ($action -eq 'publish') {
    $destination = $env:JOBHUNT_PRIVATE_DESTINATION
    Check-Parent ([IO.Path]::GetDirectoryName($destination))
    # Bind the OS function in memory; do not launch a compiler or cache a DLL.
    $assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly([Reflection.AssemblyName]::new('JobHuntPrivateMove'), [Reflection.Emit.AssemblyBuilderAccess]::Run)
    $module = $assembly.DefineDynamicModule('Native')
    $type = $module.DefineType('JobHuntPrivateMove', [Reflection.TypeAttributes]::Public)
    $attributes = [Reflection.MethodAttributes]::Public -bor [Reflection.MethodAttributes]::Static -bor [Reflection.MethodAttributes]::PinvokeImpl
    $method = $type.DefinePInvokeMethod('MoveFileExW', 'kernel32.dll', 'MoveFileExW', $attributes, [Reflection.CallingConventions]::Standard, [bool], [Type[]]@([string], [string], [uint32]), [Runtime.InteropServices.CallingConvention]::Winapi, [Runtime.InteropServices.CharSet]::Unicode)
    $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
    $import = [Runtime.InteropServices.DllImportAttribute]
    $fields = [Reflection.FieldInfo[]]@($import.GetField('SetLastError'), $import.GetField('ExactSpelling'), $import.GetField('CharSet'), $import.GetField('CallingConvention'), $import.GetField('EntryPoint'), $import.GetField('PreserveSig'))
    $values = [object[]]@($true, $true, [Runtime.InteropServices.CharSet]::Unicode, [Runtime.InteropServices.CallingConvention]::Winapi, 'MoveFileExW', $true)
    $method.SetCustomAttribute([Reflection.Emit.CustomAttributeBuilder]::new($import.GetConstructor([Type[]]@([string])), [object[]]@('kernel32.dll'), $fields, $values))
    $native = $type.CreateType()
    # WRITE_THROUGH, without REPLACE_EXISTING or COPY_ALLOWED: persist the
    # same-volume publication before remote delivery can be acknowledged.
    if (-not $native.GetMethod('MoveFileExW').Invoke($null, [object[]]@($path, $destination, [uint32]8))) {
      # Classify an existing destination from its filesystem state. Reflection
      # and PowerShell can overwrite the native last-error slot before readback.
      $exists = $false
      try { $null = [IO.File]::GetAttributes($destination); $exists = $true } catch {}
      if ($exists) { exit 17 }
      throw 'publish failed'
    }
  }
  else { throw 'unsupported' }
  [Console]::Out.Write('ok')
} catch {
  # Categorical diagnostics only: never echo exception messages, paths or bytes.
  $inner = 'None'
  if ($_.Exception.InnerException) { $inner = $_.Exception.InnerException.GetType().Name }
  [Console]::Error.Write(('{0}:{1}:{2}' -f $_.InvocationInfo.ScriptLineNumber, $_.Exception.GetType().Name, $inner))
  exit 1
}
`;

const execute = promisify(execFile);
export async function windowsACL(action: 'parent' | 'directory' | 'create' | 'file' | 'publish', path: string, destination = ''): Promise<void> {
  if (process.platform !== 'win32') throw new JobHuntError('credential_store_unavailable');
  const root = process.env.SystemRoot;
  if (!root || !/^[A-Za-z]:\\/u.test(root)) throw new JobHuntError('credential_store_unavailable');
  const environment: NodeJS.ProcessEnv = {
    SystemRoot: root, WINDIR: root, SystemDrive: root.slice(0, 2),
    PATH: join(root, 'System32'), TEMP: process.env.TEMP, TMP: process.env.TMP,
    USERPROFILE: process.env.USERPROFILE, LOCALAPPDATA: process.env.LOCALAPPDATA,
    APPDATA: process.env.APPDATA, ProgramData: process.env.ProgramData,
    JOBHUNT_PRIVATE_PATH: path, JOBHUNT_PRIVATE_ACTION: action,
    JOBHUNT_PRIVATE_DESTINATION: destination,
  };
  try {
    const result = await execute(join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(aclScript, 'utf16le').toString('base64')],
      { env: environment,
        windowsHide: true, timeout: 15000, maxBuffer: 1024 });
    if (result.stdout !== 'ok') throw new Error();
  } catch (error) {
    if (action === 'publish' && (error as { code?: unknown }).code === 17) throw new JobHuntError('output_exists');
    if ((error as { killed?: boolean }).killed) throw new JobHuntError('credential_store_unavailable');
    const failure = new JobHuntError('unsafe_credential_permissions');
    const diagnostic = (error as { stderr?: unknown }).stderr;
    const match = typeof diagnostic === 'string' && /^(\d{1,4}):([A-Za-z0-9_]+):([A-Za-z0-9_]+)$/u.exec(diagnostic);
    if (match) failure.cause = { operation: action, nativeLine: Number(match[1]), nativeType: match[2], innerType: match[3] };
    throw failure;
  }
}

/** Local NTFS paths only: no alternate streams, device aliases or network paths. */
export function windowsPrivateName(path: string): boolean {
  if (!/^[A-Za-z]:\\/u.test(path)) return false;
  return path.slice(3).split('\\').every(part => part.length > 0 &&
    !/[<>:"/|?*\x00-\x1f]/u.test(part) && !/[ .]$/u.test(part) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part));
}

export async function windowsPrivateTarget(value: string): Promise<string> {
  const absolute = resolve(value);
  if (!windowsPrivateName(absolute)) throw new JobHuntError('invalid_input');
  try {
    const parent = await realpath(dirname(absolute));
    if (!windowsPrivateName(win32.join(parent, basename(absolute)))) throw new Error();
    await windowsACL('parent', parent);
    return join(parent, basename(absolute));
  } catch { throw new JobHuntError('unsafe_credential_permissions'); }
}

/** Atomic, exclusive publication of already-private Windows bytes. */
export async function newWindowsPrivateFile(path: string, bytes: Uint8Array): Promise<void> {
  let scratch: string | undefined;
  try {
    scratch = await mkdtemp(join(dirname(path), '.jobhunt-private-'));
    await windowsACL('directory', scratch);
    const staged = join(scratch, 'private-file');
    // The native CreateNew constructor applies a protected owner-only DACL at
    // creation, before any process can open a handle and before secret bytes.
    await windowsACL('create', staged);
    const before = await lstat(staged, { bigint: true });
    const handle = await open(staged, constants.O_RDWR);
    try {
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || opened.nlink !== 1n || opened.ino !== before.ino || opened.dev !== before.dev) throw new Error();
      await handle.writeFile(bytes); await handle.sync();
      const readback = Buffer.alloc(bytes.byteLength + 1);
      let length = 0;
      while (length < readback.length) {
        const part = await handle.read(readback, length, readback.length - length, length);
        if (!part.bytesRead) break;
        length += part.bytesRead;
      }
      if (length !== bytes.byteLength || !readback.subarray(0, length).equals(bytes)) throw new Error();
    } finally { await handle.close(); }
    await windowsACL('file', staged);
    // Node's link/rename APIs do not request Windows write-through publication.
    // The native move is exclusive and keeps the protected descriptor intact.
    await windowsACL('publish', staged, path);
    const published = await lstat(path, { bigint: true });
    if (published.isSymbolicLink() || published.ino !== before.ino || published.dev !== before.dev || published.nlink !== 1n) throw new Error();
    await windowsACL('file', path);
  } catch (error) {
    if (error instanceof JobHuntError) throw error;
    throw new JobHuntError((error as NodeJS.ErrnoException).code === 'EEXIST' ? 'output_exists' : 'credential_file_unavailable');
  } finally { if (scratch) await rm(scratch, { recursive: true, force: true }).catch(() => {}); }
}
