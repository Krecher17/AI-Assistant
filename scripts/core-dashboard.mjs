import fs from 'node:fs';
const file = 'public/index.html'; let html = fs.readFileSync(file, 'utf8');
if (!html.includes('id="page-core"')) {
  const start = html.indexOf('<div class="command-core">'), end = html.indexOf('<div id="welcome"', start);
  if (start < 0 || end < 0) throw new Error('Command core not found');
  const core = html.slice(start, end); html = html.slice(0, start) + html.slice(end);
  const dashboard = `<section id="page-core" class="page reactor-page"><div class="reactor-title"><span class="eyebrow">PERSONAL OPERATING INTELLIGENCE</span><h1>GRIM<span>ONLINE AT YOUR COMMAND</span></h1></div>${core}<div class="core-response-panel"><span id="response-timing" class="tiny-label">LOCAL STANDBY</span><p id="core-response" aria-live="polite">Ready when you are, Akshay.</p></div><form id="core-command-form"><label class="sr-only" for="core-command">Command Grim</label><input id="core-command" placeholder="Or type a command — open any installed app…" maxlength="16000"><button class="button" type="submit">Send command ↗</button></form><div class="core-links"><span id="reactor-renderer">INITIALIZING 3D CORE</span><button class="text-button" data-page="chat">Open conversation →</button><button class="text-button" data-page="apps">Browse installed apps →</button></div></section>`;
  html = html.replace('<section id="page-chat"', dashboard + '<section id="page-chat"');
  html = html.replace('<button data-page="chat" class="nav active">', '<button data-page="core" class="nav active"><span>◎</span>Grim core</button><button data-page="chat" class="nav">').replace('>Command deck<span', '>Conversation<span');
  html = html.replace('<button data-page="identity"', '<button data-page="apps" class="nav"><span>▦</span>Installed apps</button><button data-page="identity"');
}
if (!html.includes('id="page-apps"')) html = html.replace('<section id="page-identity"', '<section id="page-apps" class="page standard hidden"><div class="section-header"><div class="eyebrow">WINDOWS // APP CONTROL</div><h1>Your apps. At your command.</h1><p>Say “Hey Grim, open” followed by an installed app name. Direct app launches run locally without waiting for Gemini.</p></div><div class="inline-form"><input id="app-search" type="search" placeholder="Find an installed app…" aria-label="Search installed apps"><button id="refresh-apps" class="button secondary" type="button">Refresh app list</button></div><p id="app-list-status" class="help">Windows app catalog</p><div id="installed-apps" class="installed-app-grid"></div></section><section id="page-identity"');
if (!html.includes('id="stream-output"')) html = html.replace('<div id="thinking"', '<div id="stream-output" class="stream-output" aria-live="polite"></div><div id="thinking"');
if (!html.includes('/reactor.js')) html = html.replace('<script type="module" src="/identity.js"></script>', '<script type="module" src="/identity.js"></script><script type="module" src="/reactor.js"></script>');
fs.writeFileSync(file, html);
