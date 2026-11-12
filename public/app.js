/* All personal content is rendered with textContent, never interpreted as HTML. */
const $ = id => document.getElementById(id);
const state = { data: null, page: 'core', screenshot: null, sending: false, recording: null, recorderMode: null, uploadBusy: false, seenReminders: new Set(), messagesVersion: '', fieldsLoaded: false };
let toastTimer, audioPlayer;
window.grimDashboardVisible=!document.hidden;
window.grimDesktop?.onDashboardVisibility?.(visible=>{window.grimDashboardVisible=visible;window.dispatchEvent(new CustomEvent('grim-dashboard-visibility',{detail:visible}))});
const labels = { core: 'Grim companion', chat: 'Conversation', apps: 'Installed apps', identity: 'Face & devices', voice: 'Voice & speech', memory: 'Memory', sources: 'Knowledge', reminders: 'Reminders', images: 'Image studio', activity: 'Activity', settings: 'Settings & connections' };

function node(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'text') element.textContent = value;
    else if (key === 'class') element.className = value;
    else if (key === 'onClick') element.addEventListener('click', value);
    else element.setAttribute(key, value);
  }
  for (const child of children) element.append(child);
  return element;
}
function button(label, onClick, className = 'text-button') { return node('button', { text: label, class: className, type: 'button', onClick: () => perform(onClick) }); }
function empty(message) { return node('div', { class: 'empty-state', text: message }); }
function date(value) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function showToast(message, error = false) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').classList.remove('hidden');
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), error ? 10000 : 5000);
}
async function perform(action) { try { return await action(); } catch (error) { showToast(error.message, true); } }
async function api(url, data, method = 'POST', options = {}) {
  const response = await fetch(url, { method, headers: { 'X-Grim-Client': 'dashboard', ...(!options.raw && { 'Content-Type': 'application/json' }), ...options.headers }, body: method === 'GET' ? undefined : options.raw ? data : JSON.stringify(data || {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
async function chatRequest(data) {
  const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Grim-Client': 'dashboard', Accept: 'application/x-ndjson' }, body: JSON.stringify(data) });
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Request failed.'); return value;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', result;
  const read = line => { if (!line.trim()) return; const event = JSON.parse(line); if (event.type === 'delta') { $('stream-output').textContent += event.text; $('core-response').textContent = $('stream-output').textContent; } if (event.type === 'done') result = event.message; if (event.type === 'error') throw new Error(event.message); };
  try { while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); let at; while ((at = buffer.indexOf('\n')) >= 0) { read(buffer.slice(0, at)); buffer = buffer.slice(at + 1); } } buffer += decoder.decode(); if (buffer.trim()) read(buffer); }
  finally { reader.releaseLock(); }
  if (!result) throw new Error('The connection ended before the response completed.'); return result;
}
function setPage(page) {
  if (!labels[page]) page = 'core';
  state.page = page;
  document.querySelectorAll('.page').forEach(element => element.classList.toggle('hidden', element.id !== `page-${page}`));
  document.querySelectorAll('.nav').forEach(element => element.classList.toggle('active', element.dataset.page === page));
  $('page-title').textContent = labels[page];
  history.replaceState(null, '', `#${page}`);
  window.scrollTo({ top: 0 });
  if (page === 'apps') perform(() => loadApps());
  if (page === 'voice') perform(loadVoices);
}
document.querySelectorAll('[data-page]').forEach(element => element.addEventListener('click', () => setPage(element.dataset.page)));

async function refresh() {
  const next=await api('/api/state', undefined, 'GET');
  if(JSON.stringify(next)===JSON.stringify(state.data))return;
  state.data=next;render();
}
function render() {
  const data = state.data;
  $('setup-banner').classList.toggle('hidden', data.keyConfigured);
  $('connection').textContent=data.provider==='local'?'● LOCAL · '+data.model:data.keyConfigured?'● Gemini configured':'○ Setup needed';
  $('connection').classList.toggle('offline', !data.keyConfigured);
  $('key-status').textContent=data.provider==='local'?'Local mode. No API key required. Test connection checks Ollama on this laptop.':data.geminiKeyConfigured?'Gemini key saved. Use Test connection to check Google access.':'No Gemini key saved yet.';
  $('reminder-count').textContent = data.reminders.filter(item => !item.done).length;
  if (!state.fieldsLoaded) {
    $('ai-provider').value=data.provider||'gemini';$('local-model').value=data.localModel||'qwen3:1.7b';$('model').value = data.cloudModel||data.model;providerFields(); $('roots').value = data.roots.join('\n');
    state.fieldsLoaded = true;
  }
  $('data-dir').textContent = data.dataDir;
  $('voice-status').textContent = 'Change the voice in Grim Systems → Voice & speech. Windows native speech is the default.';
  renderMessages(); renderMemories(); renderReminders(); renderSources(); renderImages(); renderActivity(); renderConnections(); renderPending();
  window.dispatchEvent(new CustomEvent('grim-state', { detail: data }));
  const upcoming = data.reminders.filter(item => !item.done).sort((a, b) => Date.parse(a.due) - Date.parse(b.due)).slice(0, 3);
  $('upcoming').replaceChildren(...(upcoming.length ? upcoming.map(item => node('div', { class: 'connection-row' }, [node('span', { text: item.title }), node('small', { text: date(item.due) })])) : [node('p', { class: 'empty-small', text: 'A little breathing room.\nYour next reminders will appear here.' })]));
  $('context-connections').replaceChildren(...[
    ['Gmail', data.integrations.gmail.connected ? 'Connected' : 'Not connected'],
    ['WhatsApp', data.sources.some(source => source.type === 'whatsapp') ? 'Export imported' : 'Import a chat'],
    ['Screen', state.screenshot ? 'Snapshot attached' : 'Capture on request']
  ].map(([name, status]) => node('div', { class: 'connection-row' }, [node('span', { text: name }), node('small', { text: status })])));
  for (const item of data.reminders.filter(item => item.fired && !item.done)) {
    if (state.seenReminders.has(item.id)) continue;
    state.seenReminders.add(item.id); showToast(`Reminder: ${item.title}`);
    if ('Notification' in window && Notification.permission === 'granted' && !window.grimDesktop) new Notification('Grim reminder', { body: item.title });
  }
}
function safeLink(url, title) {
  try { if (new URL(url, location.origin).protocol !== 'https:') return node('span', { text: title }); } catch { return node('span', { text: title }); }
  return node('a', { href: url, text: title, class: 'source-link', target: '_blank', rel: 'noopener noreferrer' });
}
function renderMessages() {
  const messages = state.data.messages;
  const version = JSON.stringify(messages);
  $('welcome').classList.toggle('hidden', messages.length > 0);
  if (state.messagesVersion === version) return;
  state.messagesVersion = version;
  $('messages').replaceChildren(...messages.map(message => {
    const body = node('div', { class: 'message-body' }, [node('div', { class: 'message-label', text: message.role === 'user' ? 'You' : 'Grim' }), node('div', { class: 'message-text', text: message.text })]);
    if (message.screenshot) body.append(node('div', { class: 'help', text: 'Screen snapshot shared with this request · image not stored' }));
    for (const source of message.sources || []) body.append(safeLink(source.url, source.title));
    for (const event of message.events || []) {
      const result = event.result;
      const card = node('div', { class: 'tool-event' });
      if (result?.error) card.textContent = `${event.tool}: ${result.error}`;
      else if (result?.pending) card.textContent = `Review requested · ${event.tool.replaceAll('_', ' ')}`;
      else if (event.tool === 'generate_image' && result?.url && /^\/media\/[a-f0-9-]+\.(png|jpg|webp)$/.test(result.url)) {
        card.textContent = 'Image saved to your library'; card.append(node('img', { src: result.url, alt: result.prompt || 'Generated image' }));
      } else if (['search_sources', 'search_gmail'].includes(event.tool) && Array.isArray(result)) {
        card.textContent = `${result.length} source${result.length === 1 ? '' : 's'} found`;
        result.forEach(source => {
          card.append(node('div', { class: 'help', text: `${source.title || 'Untitled'} · ${source.id}` }));
          if (event.tool === 'search_sources') card.append(button('View source →', () => viewSource(source.id), 'text-button accent'));
          else if (source.url) card.append(safeLink(source.url, 'Open in Gmail →'));
        });
      } else if (event.tool === 'search_files') {
        card.textContent = `${result?.results?.length || 0} matching file names`;
        for (const file of result?.results || []) card.append(node('div', { class: 'help', text: file.path }));
      } else card.textContent = `${event.tool.replaceAll('_', ' ')} · result received`;
      body.append(card);
    }
    return node('article', { class: `message ${message.role}${message.error ? ' error' : ''}` }, [node('div', { class: 'message-avatar', text: message.role === 'user' ? 'AS' : '✳' }), body]);
  }));
  if (state.page === 'chat' && messages.length) requestAnimationFrame(() => $('messages').lastElementChild?.scrollIntoView({ block: 'nearest' }));
}
function renderMemories() {
  $('memories').replaceChildren(...(state.data.memories.length ? state.data.memories.map(item => node('article', { class: 'content-card' }, [
    node('span', { class: 'tag', text: item.category }), node('p', { text: item.text }), node('div', { class: 'meta', text: date(item.created) }),
    node('div', { class: 'card-actions' }, [button('Edit', () => { $('memory-id').value = item.id; $('memory-category').value = item.category; $('memory-text').value = item.text; $('cancel-memory').classList.remove('hidden'); $('memory-text').focus(); }), button('Forget', async () => { await api(`/api/memories/${item.id}`, {}, 'DELETE'); await refresh(); }, 'text-button danger')])
  ])) : [empty('A fresh start. Add a project, a preference, or something you’d like me to remember.')]));
}
function renderReminders() {
  const items = [...state.data.reminders].sort((a, b) => Number(a.done) - Number(b.done) || Date.parse(a.due) - Date.parse(b.due));
  $('reminders').replaceChildren(...(items.length ? items.map(item => node('div', { class: `list-item${item.done ? ' done' : item.fired ? ' due' : ''}` }, [
    node('span', { text: item.done ? '✓' : item.fired ? '◉' : '◷' }), node('div', {}, [node('span', { text: item.title }), node('small', { text: `${date(item.due)}${item.done ? ' · Complete' : item.fired ? ' · Due' : ''}` })]),
    ...(!item.done ? [button('Done', async () => { await api(`/api/reminders/${item.id}`, {}); await refresh(); })] : []),
    button('Remove', async () => { await api(`/api/reminders/${item.id}`, {}, 'DELETE'); await refresh(); }, 'text-button danger')
  ])) : [empty('Nothing to keep track of yet. Add your first reminder above.')]));
}
function renderSources() {
  $('source-count').textContent = state.data.sources.length;
  $('sources').replaceChildren(...(state.data.sources.length ? state.data.sources.map(item => node('article', { class: 'content-card' }, [
    node('span', { class: 'tag', text: item.type }), node('h3', { text: item.title }), node('div', { class: 'meta', text: `${item.characters.toLocaleString()} characters · ${date(item.created)}` }),
    ...(item.summary ? [node('p', { text: item.summary.slice(0, 220) + (item.summary.length > 220 ? '…' : '') })] : []),
    node('div', { class: 'card-actions' }, [button('Read source →', () => viewSource(item.id), 'text-button accent'), button('Remove', async () => { await api(`/api/sources/${item.id}`, {}, 'DELETE'); await refresh(); }, 'text-button danger')])
  ])) : [empty('Your knowledge library starts here. Import a text source or record a thought.')]));
}
async function viewSource(id) {
  const source = await api(`/api/sources/${encodeURIComponent(id)}`, undefined, 'GET');
  $('source-dialog-title').textContent = source.title; $('source-dialog-text').textContent = source.text;
  $('source-dialog-summary').replaceChildren(node('div', { text: source.summary || '' }));
  if (source.tasks?.length) {
    const tasks = node('div', { class: 'button-row' });
    source.tasks.forEach(task => tasks.append(button(`Remind me: ${task.title}`, () => {
      $('source-dialog').close(); setPage('reminders'); $('reminder-title').value = task.title; $('reminder-due').focus();
    }, 'button secondary')));
    $('source-dialog-summary').append(tasks);
  }
  $('source-dialog').showModal();
}
$('close-source').addEventListener('click', () => $('source-dialog').close());
function renderImages() {
  $('images').replaceChildren(...(state.data.images.length ? state.data.images.map(item => node('figure', { class: 'image-card' }, [
    node('img', { src: item.url, alt: item.prompt, loading: 'lazy' }), node('figcaption', { text: item.prompt }, [node('a', { href: item.url, download: `grim-${item.id}.png`, text: 'Save image ↓' })])
  ])) : [empty('A blank canvas. Describe your first image above.')]));
}
function actionCard(item) {
  const title = item.name === 'delete_file' ? 'Move file to Recycle Bin' : item.name.replaceAll('_', ' ');
  const card = node('div', { class: 'pending-item' }, [node('strong', { text: title }), node('pre', { text: Object.entries(item.args).map(([key, value]) => `${key}: ${value}`).join('\n') })]);
  let clicked = false;
  const controls = node('div', { class: 'button-row' }, [button('Approve', async () => {
    if (clicked) return; clicked = true;
    controls.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { const result = await api(`/api/actions/${item.id}`, { approve: true }); showToast(result.message || 'Saved.'); window.grimDesktop?.setCompanion({phase:'success',message:result.message||'Done.'}); }
    finally { await refresh(); }
  }, 'button'), button('Dismiss', async () => { await api(`/api/actions/${item.id}`, { approve: false }); await refresh(); }, 'button secondary')]);
  card.append(controls); return card;
}
function renderPending() {
  const items = state.data.pending;
  $('pending-dock').classList.toggle('hidden', !items.length);
  $('pending-count').textContent = items.length;
  $('pending-actions').replaceChildren(...items.map(actionCard));
  $('activity-pending').replaceChildren(...items.map(actionCard));
}
function renderActivity() {
  $('activity').replaceChildren(...(state.data.activity.length ? state.data.activity.map(item => node('div', { class: 'list-item' }, [
    node('span', { text: '✓' }), node('div', {}, [node('span', { text: item.action.replaceAll('_', ' ') }), node('small', { text: JSON.stringify(item.args) }), node('small', { text: `${date(item.created)} · ${item.result?.message || 'Saved successfully'}` })])
  ])) : [empty('Approved actions will leave a record here.')]));
}
function renderConnections() {
  const gmail = state.data.integrations.gmail;
  const cards = [
    ['Gmail', gmail.connected ? 'Connected · read only' : gmail.configured ? 'Ready to connect' : 'OAuth setup needed', `Your account: ${state.data.email}. Connect through Google to search messages on request.`, button(gmail.connected ? 'Disconnect' : 'Connect Gmail →', async () => {
      if (gmail.connected) { const result = await api('/api/gmail/disconnect', {}); if (result.warning) showToast(result.warning, true); await refresh(); }
      else { const { url } = await api('/api/gmail/connect', {}); if (window.grimDesktop) await window.grimDesktop.openExternal(url); else { const tab = window.open(url, '_blank', 'noopener,noreferrer'); if (!tab) showToast('If the Google window did not open, allow pop-ups and retry.'); } }
    }, 'text-button accent')],
    ['WhatsApp', 'Export-based access', 'Import a WhatsApp chat export in Knowledge. Live account sync is not connected.', button('Import a chat →', () => setPage('sources'), 'text-button accent')],
    ['Spotify', 'Open & search', 'Ask to open Spotify or search for a song. Personalized playback and listening history need a future account integration.', button('Open Spotify', async () => { await api('/api/actions', { name: 'open_app', args: { name: 'spotify' } }); await refresh(); }, 'text-button accent')],
    ['Screen context', 'Snapshot on request', 'Choose one screen snapshot to include with your next question. Autonomous clicking and typing are planned.', button('Capture a snapshot →', async () => { setPage('chat'); await captureScreen(); }, 'text-button accent')],
    ['Phone companion', 'USB browser preview', 'Use the USB steps below to access the same dashboard. Native Android install and offline sync are planned.', null],
    ['Meetings & calendar', 'Local reminders ready', 'Recording summaries and suggested tasks are supported. Calendar reading, scheduling, and invitations are planned.', button('View reminders →', () => setPage('reminders'), 'text-button accent')]
  ];
  $('connections').replaceChildren(...cards.map(([title, status, description, action]) => node('article', { class: 'content-card' }, [node('span', { class: 'tag', text: status }), node('h3', { text: title }), node('p', { text: description }), ...(action ? [action] : [])])));
}

$('settings-form').addEventListener('submit', event => { event.preventDefault(); perform(async () => {
  const data = {provider:$('ai-provider').value,localModel:$('local-model').value.trim(), model: $('model').value.trim() };
  if ($('api-key').value.trim()) { data.apiKey = $('api-key').value.trim(); data.remember = $('remember-key').checked; }
  await api('/api/settings', data); $('api-key').value = ''; showToast('AI settings saved. Use Test connection to check the selected model.'); await refresh();
}); });
$('test-ai').addEventListener('click', () => perform(async () => {
  const button = $('test-ai'); button.disabled = true; $('key-status').textContent = 'Checking the selected model…';
  try { const result = await api('/api/ai/test', {}); $('key-status').textContent = result.message; showToast(result.message); }
  catch (error) { $('key-status').textContent = `Connection failed: ${error.message}`; throw error; }
  finally { button.disabled = false; }
}));
$('forget-key').addEventListener('click', () => perform(async () => { await api('/api/settings', { forgetKey: true }); $('api-key').value = ''; await refresh(); showToast('Key removed from the running app and encrypted storage.'); }));
$('folders-form').addEventListener('submit', event => { event.preventDefault(); perform(async () => { await api('/api/settings', { roots: $('roots').value.split('\n').map(value => value.trim()).filter(Boolean) }); await refresh(); showToast('Enabled folders updated.'); }); });
$('memory-form').addEventListener('submit', event => { event.preventDefault(); perform(async () => {
  await api('/api/memories', { id: $('memory-id').value || undefined, category: $('memory-category').value, text: $('memory-text').value });
  $('memory-id').value = ''; $('memory-text').value = ''; $('cancel-memory').classList.add('hidden'); await refresh(); showToast('Memory saved.');
}); });
$('cancel-memory').addEventListener('click', () => { $('memory-id').value = ''; $('memory-text').value = ''; $('cancel-memory').classList.add('hidden'); });
$('reminder-form').addEventListener('submit', event => { event.preventDefault(); perform(async () => {
  await api('/api/reminders', { title: $('reminder-title').value, due: new Date($('reminder-due').value).toISOString() });
  $('reminder-title').value = ''; $('reminder-due').value = ''; await refresh(); showToast('Reminder added.');
}); });
$('notification-permission').addEventListener('click', () => perform(async () => { if (!('Notification' in window)) throw new Error('Browser notifications are unavailable.'); const permission = await Notification.requestPermission(); showToast(`Notifications: ${permission}`); }));
$('source-file').addEventListener('change', () => perform(async () => {
  const file = $('source-file').files[0]; if (!file) return;
  if (file.size > 1000000) throw new Error('Import a text file smaller than 1 MB.');
  $('source-text').value = await file.text(); if (!$('source-title').value) $('source-title').value = file.name;
}));
$('source-form').addEventListener('submit', event => { event.preventDefault(); perform(async () => {
  await api('/api/sources', { title: $('source-title').value, type: $('source-type').value, text: $('source-text').value });
  $('source-form').reset(); await refresh(); showToast('Source saved. You can now ask questions about it.');
}); });
$('image-form').addEventListener('submit', event => { event.preventDefault(); perform(async () => {
  $('generate-image').disabled = true; $('generate-image').textContent = 'Creating your image…';
  try { await api('/api/image', { prompt: $('image-prompt').value }); await refresh(); showToast('Image saved to your library.'); }
  finally { $('generate-image').disabled = false; $('generate-image').textContent = 'Generate image ↗'; }
}); });
$('export-data').addEventListener('click', () => perform(async () => {
  const data = await api('/api/export', undefined, 'GET');
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'grim-export.json');
}));
function download(blob, name) { const url = URL.createObjectURL(blob), a = node('a', { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }

$('message').addEventListener('input', () => { $('message').style.height = 'auto'; $('message').style.height = `${Math.min($('message').scrollHeight, 180)}px`; });
$('message').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('chat-form').requestSubmit(); } });
$('chat-form').addEventListener('submit', event => { event.preventDefault(); perform(sendMessage); });
async function sendMessage({ voice = false, messageOverride } = {}) {
  if (state.sending) return;
  const message = (messageOverride ?? $('message').value).trim(); if (!message) return;
  state.sending = true; $('send').disabled = true; $('thinking').classList.remove('hidden'); $('stream-output').textContent = ''; $('core-response').textContent = 'Working on your request…';
  try {
    state.data.messages.push({ role: 'user', text: message, screenshot: !!state.screenshot }); renderMessages();
    const response = await chatRequest({ message, ...(!messageOverride && state.screenshot && { image: state.screenshot }) });
    if (!messageOverride) { $('message').value = ''; $('message').style.height = 'auto'; clearScreenshot(); }
    await refresh();
    $('core-response').textContent = response.text; $('response-timing').textContent = response.local ? `LOCAL ACTION · ${response.elapsedMs || 0} MS` : `RESPONSE · ${((response.elapsedMs || 0) / 1000).toFixed(1)} S`;
    $('stream-output').textContent = '';
    if ($('speak-replies').checked || voice) await speak(response.text);
    return response;
  } catch (error) { $('core-response').textContent = error.message; throw error; }
  finally { state.sending = false; $('send').disabled = false; $('thinking').classList.add('hidden'); await refresh(); }
}
document.querySelectorAll('[data-prompt]').forEach(element => element.addEventListener('click', () => { $('message').value = element.dataset.prompt; $('message').focus(); }));
$('clear-chat').addEventListener('click', () => perform(async () => { if (!confirm('Delete the saved chat history? Memories and sources will remain.')) return; await api('/api/chat', {}, 'DELETE'); await refresh(); }));

async function captureScreen() {
  let image;
  if (window.grimDesktop?.captureScreen) image = await window.grimDesktop.captureScreen();
  else {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen capture is unavailable here. Use the desktop app or a supported desktop browser.');
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    try {
      const video = document.createElement('video'); video.muted = true; video.srcObject = stream; await video.play();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const canvas = document.createElement('canvas'), scale = Math.min(1, 1920 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height); image = canvas.toDataURL('image/jpeg', .8);
      video.srcObject = null;
    } finally { stream.getTracks().forEach(track => track.stop()); }
  }
  if (!image) return;
  state.screenshot = image; $('screenshot-image').src = image; $('screenshot-preview').classList.remove('hidden'); $('capture-status').textContent = 'Snapshot ready · sent with your next message';
  if (!$('message').value) $('message').value = 'Explain what is visible in this screenshot and help me understand it.';
  $('message').focus();
}
function clearScreenshot() { state.screenshot = null; $('screenshot-image').removeAttribute('src'); $('screenshot-preview').classList.add('hidden'); $('capture-status').textContent = 'Your context. At your pace.'; }
$('capture-screen').addEventListener('click', () => perform(captureScreen));
$('screen-prompt').addEventListener('click', () => perform(captureScreen));
$('remove-screenshot').addEventListener('click', clearScreenshot);

async function record(mode) {
  window.dispatchEvent(new Event('grim-pause-wake'));
  if (state.uploadBusy) throw new Error('Wait for the current audio upload.');
  if (state.recording) { state.recording.stop(); return; }
  if (!state.data.keyConfigured) { setPage('settings'); throw new Error('Choose a ready local or cloud model before recording.'); }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Microphone recording is unavailable in this browser. You can upload an audio file instead.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: window.grimMedia?.audioConstraints() || true });
  let recorder;
  try { recorder = new MediaRecorder(stream); }
  catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  state.recording = recorder; state.recorderMode = mode;
  const chunks = []; let length = 0;
  recorder.addEventListener('dataavailable', event => { if (event.data.size) { chunks.push(event.data); length += event.data.size; if (length > 11000000 && recorder.state === 'recording') recorder.stop(); } });
  const started = Date.now();
  function updateRecordingStatus() {
    const seconds = Math.floor((Date.now() - started) / 1000), time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('capture-status').textContent = mode === 'dictation' ? `Recording voice command · ${time} · click to stop` : 'Recording in Knowledge · click ● to stop';
    $('recording-status').textContent = `Recording ${time}. ${state.data.provider==='local'?'Stop to transcribe on this laptop.':'Stop to send this audio to Gemini.'}`;
  }
  const ticker = setInterval(updateRecordingStatus, 1000);
  updateRecordingStatus(); $('dictate').classList.add('recording'); $('record').classList.add('recording'); $('record').textContent = '■ Stop & process';
  recorder.addEventListener('stop', () => {
    clearInterval(ticker); stream.getTracks().forEach(track => track.stop()); state.recording = null;
    $('dictate').classList.remove('recording'); $('record').classList.remove('recording'); $('record').textContent = '● Start recording';
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    perform(() => uploadAudio(blob, mode));
  });
  recorder.addEventListener('error', () => { if (recorder.state !== 'inactive') recorder.stop(); showToast('The microphone stopped unexpectedly.', true); });
  recorder.start(1000);
}
async function uploadAudio(blob, mode = 'meeting') {
  if (blob.size > 12000000) { download(blob, 'grim-recording.webm'); throw new Error('Recording exceeds 12 MB. Saved a copy; split it before uploading.'); }
  state.uploadBusy = true; $('dictate').disabled = true; $('record').disabled = true;
  $('capture-status').textContent = 'Processing audio…'; $('recording-status').textContent = 'Transcribing and preparing your notes…';
  try {
    const fallbackTypes = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm' };
    const type = blob.type || fallbackTypes[blob.name?.split('.').pop().toLowerCase()] || 'audio/webm';
    const result = await api(`/api/transcribe?mode=${mode}`, blob, 'POST', { raw: true, headers: { 'Content-Type': type, 'X-Recording-Title': encodeURIComponent($('recording-title').value || 'Voice capture') } });
    if (mode === 'dictation') { $('message').value = result.text; $('message').focus(); showToast('Voice command transcribed. Review it and press Send.'); }
    else { await refresh(); await viewSource(result.id); showToast(result.warning || 'Transcript and notes saved.', !!result.warning); }
    $('recording-status').textContent = mode === 'dictation' ? 'Voice command ready in the composer.' : 'Saved to your Knowledge library.';
  } catch (error) {
    if (!(blob instanceof File)) download(blob, 'grim-recording.webm');
    $('recording-status').textContent = 'Processing failed. Your original upload is unchanged; microphone recordings are offered as a download.';
    throw error;
  } finally { state.uploadBusy = false; $('dictate').disabled = false; $('record').disabled = false; $('capture-status').textContent = 'Your context. At your pace.'; }
}
$('dictate').addEventListener('click', () => perform(() => record('dictation')));
$('record').addEventListener('click', () => perform(() => record('meeting')));
$('audio-file').addEventListener('change', () => perform(async () => { const file = $('audio-file').files[0]; if (file) await uploadAudio(file); $('audio-file').value = ''; }));
window.addEventListener('beforeunload', event => { if (state.recording || state.uploadBusy) { event.preventDefault(); event.returnValue = ''; } });

$('speak-replies').checked = localStorage.getItem('grim-speak') === 'true';
$('speak-replies').addEventListener('change', () => { localStorage.setItem('grim-speak', $('speak-replies').checked); if (!$('speak-replies').checked) { window.speechSynthesis?.cancel(); audioPlayer?.pause(); } });
async function speak(value) {
  const spoken = value.slice(0, 1000);
  window.dispatchEvent(new CustomEvent('grim-speaking', { detail: true }));
  try {
  let spokenSuccessfully = false;
  if (state.data.voice?.engine === 'elevenlabs') {
    try {
    const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Grim-Client': 'dashboard' }, body: JSON.stringify({ text: spoken }) });
    if (!response.ok) throw new Error('Speech playback failed. Check your ElevenLabs configuration.');
    const url = URL.createObjectURL(await response.blob()); audioPlayer?.pause(); audioPlayer = new Audio(url);
    try { await new Promise((resolve, reject) => { audioPlayer.onended = resolve; audioPlayer.onerror = () => reject(new Error('Voice playback failed.')); audioPlayer.play().catch(reject); }); }
    finally { URL.revokeObjectURL(url); }
    spokenSuccessfully = true;
    } catch { showToast('Cloud voice unavailable. Switching to local speech.'); }
  }
  if (!spokenSuccessfully && state.data.voice?.engine === 'browser' && window.speechSynthesis && speechSynthesis.getVoices().length) {
    try {
    speechSynthesis.cancel();
    await new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.voice = speechSynthesis.getVoices().find(v=>v.name===state.data.voice?.name) || null; utterance.rate=Math.pow(1.15,state.data.voice?.rate||0);utterance.volume=(state.data.voice?.volume??90)/100;
      const timer = setTimeout(() => { speechSynthesis.cancel(); reject(new Error('Browser voice did not start.')); }, 3000);
      utterance.onstart = () => clearTimeout(timer);
      utterance.onend = () => { clearTimeout(timer); resolve(); };
      utterance.onerror = event => { clearTimeout(timer); reject(new Error('Browser speech failed: ' + event.error)); };
      speechSynthesis.speak(utterance);
    });
    spokenSuccessfully = true;
    } catch { /* Windows native speech below does not depend on Chromium voices. */ }
  }
  if (!spokenSuccessfully) await api('/api/speech', { text: spoken });
  } finally { window.dispatchEvent(new CustomEvent('grim-speaking', { detail: false })); }
}

window.grimAssistant = {
  data: () => state.data,
  busy: () => state.sending || !!state.recording || state.uploadBusy,
  speak,
  sendCommand: async text => {
    if (state.sending || state.recording || state.uploadBusy) throw new Error('Finish the current action first.');
    return await sendMessage({ voice: true, messageOverride: text });
  }
};

async function init() {
  const hash = location.hash;
  if (hash.startsWith('#pair=')) { const token = hash.slice(6); history.replaceState(null, '', '/'); await api('/api/session', { token }); }
  try { await refresh(); }
  catch (error) { $('locked').classList.remove('hidden'); throw error; }
  $('shell').classList.remove('hidden'); setPage(hash.startsWith('#pair=') ? 'core' : hash.slice(1));
  setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }, 1000);
  setInterval(() => { if (!document.hidden && window.grimDashboardVisible!==false && !state.recording) refresh().catch(() => { $('connection').textContent = '○ Server disconnected'; $('connection').classList.add('offline'); }); }, 7000);
  if (window.grimDesktop?.onVoiceShortcut) window.grimDesktop.onVoiceShortcut(() => { setPage('chat'); perform(() => record('dictation')); });
}
perform(init);

let appItems = null;
async function loadApps(force = false) {
  if (!appItems || force) { $('app-list-status').textContent = 'Reading installed Windows apps…'; appItems = await api('/api/apps' + (force ? '?refresh=1' : ''), undefined, 'GET'); }
  const query = $('app-search').value.trim().toLowerCase(), items = appItems.filter(item => item.name.toLowerCase().includes(query));
  $('app-list-status').textContent = `${items.length} of ${appItems.length} registered apps · launches run locally`;
  $('installed-apps').replaceChildren(...items.map(item => node('article', { class: 'installed-app' }, [node('span', { class: 'app-monogram', text: item.name.slice(0, 1).toUpperCase() }), node('span', { text: item.name }), button('Open ↗', async () => {
    const result = await api('/api/apps/open', { id: item.id }); $('core-response').textContent = result.message; showToast(result.message); await refresh(); await speak(result.message);
  }, 'button secondary')])));
}
$('app-search').addEventListener('input', () => perform(() => loadApps()));
$('refresh-apps').addEventListener('click', () => perform(() => loadApps(true)));
$('test-speaker').addEventListener('click', () => perform(async () => { await speak('This is Grim’s local voice test. At your service, Akshay.'); showToast('Voice test completed. If you heard nothing, check laptop output and volume.'); }));
$('core-command-form').addEventListener('submit', event => { event.preventDefault(); perform(async () => { const input = $('core-command'); if (!input.value.trim()) return; const command = input.value; input.value = ''; try { await window.grimAssistant.sendCommand(command); } catch (error) { $('core-response').textContent = error.message; showToast(error.message, true); await speak(error.message).catch(() => {}); } }); });

let voiceData;
async function loadVoices(){
  voiceData=await api('/api/voice',undefined,'GET');const settings=voiceData.settings;
  $('speech-engine').value=settings.engine;$('speech-rate').value=settings.rate;$('speech-volume').value=settings.volume;$('eleven-voice').value=settings.elevenlabsVoiceId;
  fillVoices(settings.name);$('voice-provider-status').textContent=voiceData.elevenlabsConfigured?'ElevenLabs key configured. Enter a voice ID to use it.':'Windows speech is ready. ElevenLabs requires ELEVENLABS_API_KEY in the local .env file.';
}
function fillVoices(selected=''){
  const voices=$('speech-engine').value==='browser'?(window.speechSynthesis?.getVoices()||[]).map(v=>({name:v.name,language:v.lang})):voiceData?.voices||[];
  $('speech-voice').replaceChildren(node('option',{value:'',text:'System default'}),...voices.map(v=>node('option',{value:v.name,text:`${v.name} (${v.language})`})));
  $('speech-voice').value=selected;
}
$('speech-engine').addEventListener('change',()=>fillVoices());
$('voice-form').addEventListener('submit',event=>{event.preventDefault();perform(async()=>{await api('/api/voice',{engine:$('speech-engine').value,name:$('speech-voice').value,rate:Number($('speech-rate').value),volume:Number($('speech-volume').value),elevenlabsVoiceId:$('eleven-voice').value.trim()});await refresh();showToast('Grim’s voice saved.');})});
$('preview-voice').addEventListener('click',()=>perform(()=>speak('Hello. I am Grim, your desktop companion. At your service.')));

function providerFields(){const local=$('ai-provider').value==='local';document.querySelectorAll('.cloud-ai-field').forEach(el=>el.classList.toggle('hidden',local));$('local-model-field').classList.toggle('hidden',!local);$('forget-key').classList.toggle('hidden',local)}
$('ai-provider').addEventListener('change',providerFields);
