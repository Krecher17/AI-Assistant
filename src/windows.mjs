import { spawn } from 'node:child_process';
import path from 'node:path';

// Script text is fixed by the application. User data travels through stdin, never shell interpolation.
export function powershell(script, data = {}, timeout = 20000) {
  if (process.platform !== 'win32') return Promise.reject(new Error('This action requires Windows.'));
  return new Promise((resolve, reject) => {
    const prelude = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::InputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd() | ConvertFrom-Json; ";
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const shellDir = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0');
    // A PowerShell 7 parent can pass incompatible module paths into Windows PowerShell 5.1.
    // Use the built-in Windows modules for this child only; do not alter system/user settings.
    const env = { ...process.env, PSModulePath: path.join(shellDir, 'Modules') };
    const child = spawn(path.join(shellDir, 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', Buffer.from(prelude + script, 'utf16le').toString('base64')], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Windows action timed out.')); }, timeout);
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `Windows action failed (${code})`)); });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(data));
  });
}

const loadCrypto = "$null=[Reflection.Assembly]::LoadWithPartialName('System.Security'); ";
export async function protect(text) {
  try {
    const encrypted = await powershell(loadCrypto + "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($d.text), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))", { text });
    if (!encrypted || !/^[A-Za-z0-9+/=]+$/.test(encrypted)) throw new Error('Invalid encrypted output');
    return 'dpapi-v1:' + encrypted;
  } catch {
    throw new Error('Windows could not encrypt this credential. Uncheck Remember to use the key for this session, or retry after restarting Grim.');
  }
}
export async function unprotect(text) {
  try {
    if (text.startsWith('dpapi-v1:')) return await powershell(loadCrypto + "[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($d.text), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))", { text: text.slice(9) });
    // Preserve compatibility with credentials written by the initial SecureString implementation.
    return await powershell('$s=ConvertTo-SecureString -String $d.text; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }', { text });
  } catch { throw new Error('Windows could not decrypt this saved credential. Enter it again on this Windows account.'); }
}

export const launchFile = file => powershell('Start-Process -FilePath $d.path', { path: file });
export const recycleFile = file => powershell('Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($d.path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)', { path: file });
export const moveFile = (source, destination) => powershell('Move-Item -LiteralPath $d.source -Destination $d.destination -ErrorAction Stop', { source, destination });

let apps;
export async function launchApp(name) {
  if (!apps) { const { AppCatalog } = await import('./apps.mjs'); apps = new AppCatalog(); }
  return apps.open(name);
}
export function launchUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS web links are supported.');
  return powershell('Start-Process -FilePath $d.target', { target: url.href });
}
