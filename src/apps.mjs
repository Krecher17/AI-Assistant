import { createHash } from 'node:crypto';
import { powershell } from './windows.mjs';

export const normalizeApp = name => String(name).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
export function appIntent(text) {
  const match = /^(?:please\s+)?(?:open|launch|start|run)\s+(?:the\s+)?([\p{L}\p{N}][\p{L}\p{N} .+()'’-]{0,99}?)(?:\s+(?:app|application))?(?:\s+please)?[.!]?$/iu.exec(text.trim());
  return match ? match[1].trim() : null;
}
export async function discoverApps() {
  const output = await powershell(`$shell=New-Object -ComObject Shell.Application; $folder=$shell.Namespace('shell:AppsFolder'); $items=@(); foreach($item in $folder.Items()){ if($item.Name -and $item.Path){ $items += [pscustomobject]@{name=$item.Name; target=$item.Path} } }; ConvertTo-Json -InputObject @($items) -Compress`, {}, 30000);
  const items = JSON.parse(output || '[]');
  return items.filter(item => typeof item.name === 'string' && typeof item.target === 'string' && item.target && item.name)
    .map(item => ({ id: createHash('sha256').update(item.target).digest('hex').slice(0, 24), name: item.name, target: item.target })).sort((a,b) => a.name.localeCompare(b.name));
}
export async function launchDiscovered(app) {
  // Target comes only from the current Windows AppsFolder catalog, never model-supplied shell text.
  return powershell(`$shell=New-Object -ComObject Shell.Application; $folder=$shell.Namespace('shell:AppsFolder'); $item=$folder.ParseName($d.target); if($null -eq $item){throw 'This app is no longer registered in Windows. Refresh the app list.'}; Start-Process -FilePath (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList @('shell:AppsFolder\\' + $d.target)`, { target: app.target });
}
export function resolveApp(name, apps) {
  const query = normalizeApp(name);
  if (!query || /[\\/:;=\r\n]/.test(name)) throw new Error('Use an installed app name, without paths or command-line arguments.');
  let matches = apps.filter(app => normalizeApp(app.name) === query);
  if (matches.length === 1) return { app: matches[0] };
  const simple = query.replace(/\b(browser|application|app)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!matches.length && simple !== query) matches = apps.filter(app => normalizeApp(app.name).replace(/\b(browser|application|app)\b/g,'').replace(/\s+/g,' ').trim() === simple);
  if (matches.length === 1) return { app: matches[0] };
  if (!matches.length) matches = apps.filter(app => normalizeApp(app.name).startsWith(query + ' ') || normalizeApp(app.name).includes(' ' + query));
  if (matches.length === 1) return { app: matches[0] };
  return { app: null, choices: matches.map(({id,name})=>({id,name})).slice(0, 8) };
}
export class AppCatalog {
  constructor({ discover = discoverApps, launch = launchDiscovered } = {}) { this.discover = discover; this.launch = launch; this.items = []; this.loaded = 0; this.loading = null; }
  async all(force = false) {
    if (!force && this.loaded && Date.now() - this.loaded < 300000) return this.items;
    if (!this.loading) this.loading = this.discover().then(items => { this.items = items; this.loaded = Date.now(); return items; }).finally(() => { this.loading = null; });
    return this.loading;
  }
  async list(force = false) { return (await this.all(force)).map(({id,name})=>({id,name})); }
  async open(name) {
    const { app, choices } = resolveApp(name, await this.all());
    if (!app) return { launched: false, choices, message: choices.length ? `I found more than one match for ${name}. Choose one in Installed apps.` : `I couldn't find ${name} among your registered Windows apps. Refresh Installed apps and check its name.` };
    await this.launch(app);
    return { launched: true, id: app.id, name: app.name, message: `Opening ${app.name}.`, detail: 'Windows accepted the app activation request.' };
  }
  async openId(id) {
    const app = (await this.all()).find(item => item.id === id);
    if (!app) throw new Error('App not found in the current Windows catalog. Refresh Installed apps.');
    await this.launch(app); return { launched: true, id: app.id, name: app.name, message: `Opening ${app.name}.`, detail: 'Windows accepted the app activation request.' };
  }
}
