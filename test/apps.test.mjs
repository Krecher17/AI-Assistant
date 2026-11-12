import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppCatalog, appIntent, resolveApp } from '../src/apps.mjs';
import { createApp } from '../server.mjs';
import { readGeminiStream } from '../src/stream.mjs';
import { SpeechEndpoint } from '../public/identity-core.mjs';
const base = path.resolve('test-output'); await fs.mkdir(base, { recursive: true }); const dirs = [];
after(async () => { for (const dir of dirs) { assert.ok(dir.startsWith(base + path.sep)); await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } });
const apps = [{ id: '1', name: 'Example Editor', target: 'opaque-app-id' }, { id: '2', name: 'Example Browser', target: 'another-id' }, { id: '3', name: 'Calculator', target: 'calc-id' }];
test('general app discovery is cached and launches only catalog-resolved targets', async () => {
  let discoveries = 0, launched;
  const catalog = new AppCatalog({ discover: async () => { discoveries++; return apps; }, launch: async app => { launched = app; } });
  assert.equal(appIntent('Please open Example Editor'), 'Example Editor');
  assert.equal(appIntent('open C:\\private\\script.exe'), null);
  assert.equal(resolveApp('Example', apps).choices.length, 2);
  assert.equal((await catalog.open('Example Editor')).launched, true); assert.equal(launched.target, 'opaque-app-id');
  await catalog.open('Calculator'); assert.equal(discoveries, 1);
  assert.equal((await catalog.open('missing app')).launched, false);
  await assert.rejects(catalog.openId('untrusted-id'), /not found/);
  await assert.rejects(catalog.open('C:\\script.exe'), /without paths/);
  assert.ok((await catalog.list()).every(item => !Object.hasOwn(item, 'target')));
});
test('opening an app bypasses Gemini and API-key setup; unknown apps get a clear response', async t => {
  const dir = await fs.mkdtemp(path.join(base, 'apps-')); dirs.push(dir); let launches = 0;
  const appCatalog = new AppCatalog({ discover: async () => apps, launch: async () => { launches++; } });
  const app = await createApp({ port: 0, dataDir: dir, appCatalog, requestAI: () => { throw new Error('An app launch must never call Gemini'); } }); t.after(() => app.close());
  const headers = { Origin: app.origin, 'X-Grim-Client': 'dashboard', 'Content-Type': 'application/json' };
  const pair = await fetch(app.origin + '/api/session', { method: 'POST', headers, body: JSON.stringify({ token: app.token }) }); headers.Cookie = pair.headers.get('set-cookie').split(';')[0];
  const result = await (await fetch(app.origin + '/api/chat', { method: 'POST', headers, body: JSON.stringify({ message: 'open Example Editor' }) })).json();
  assert.equal(result.local, true); assert.equal(launches, 1); assert.match(result.text, /Opening Example Editor/);
  const missing = await (await fetch(app.origin + '/api/chat', { method: 'POST', headers, body: JSON.stringify({ message: 'open Missing App' }) })).json();
  assert.match(missing.text, /couldn't find/); assert.equal(launches, 1); assert.equal(app.store.list('activity').length, 2);
  const list = await (await fetch(app.origin + '/api/apps', { headers })).json(); assert.equal(list.length, 3);
});
test('Gemini streaming handles split CRLF, function-call signatures, and incremental text', async () => {
  const events = [
    { candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] },
    { candidates: [{ content: { parts: [{ text: 'Akshay.' }, { functionCall: { name: 'open_app', id: 'call1', args: { name: 'Editor' } }, thoughtSignature: 'keep-this' }] }, finishReason: 'STOP' }] }
  ];
  const wire = events.map(event => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join('');
  const encoder = new TextEncoder();
  const stream = new ReadableStream({ start(controller) { for (let i = 0; i < wire.length; i += 7) controller.enqueue(encoder.encode(wire.slice(i, i + 7))); controller.close(); } });
  let text = ''; const result = await readGeminiStream(new Response(stream), delta => { text += delta; });
  assert.equal(text, 'Hello Akshay.'); assert.equal(result.candidates[0].content.parts.at(-1).thoughtSignature, 'keep-this');
});
test('speech endpoint flushes one utterance after short silence without re-triggering', () => {
  const gate = new SpeechEndpoint();
  assert.equal(gate.push(.01, 256), false); assert.equal(gate.push(.015, 256), false);
  assert.equal(gate.push(.0001, 256), false); assert.equal(gate.push(.0001, 256), true); assert.equal(gate.push(.0001, 256), false);
});

test('HTTP chat streams text and stores the final message', async t => {
  const dir = await fs.mkdtemp(path.join(base, 'stream-')); dirs.push(dir);
  const requestAI = async (_model, _body, _key, options) => {
    options.onText('A closure '); options.onText('remembers its scope.');
    return { candidates: [{ content: { role: 'model', parts: [{ text: 'A closure remembers its scope.' }] } }] };
  };
  const app = await createApp({ port: 0, dataDir: dir, requestAI }); t.after(() => app.close());
  const headers = { Origin: app.origin, 'X-Grim-Client': 'dashboard', 'Content-Type': 'application/json' };
  const pair = await fetch(app.origin + '/api/session', { method: 'POST', headers, body: JSON.stringify({ token: app.token }) }); headers.Cookie = pair.headers.get('set-cookie').split(';')[0];
  await fetch(app.origin + '/api/settings', { method: 'POST', headers, body: JSON.stringify({ apiKey: 'AIza-dummy-streaming-test-key', remember: false }) });
  const response = await fetch(app.origin + '/api/chat', { method: 'POST', headers: { ...headers, Accept: 'application/x-ndjson' }, body: JSON.stringify({ message: 'Explain closures' }) });
  assert.match(response.headers.get('content-type'), /ndjson/);
  const events = (await response.text()).trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.map(e=>e.type), ['delta','delta','done']); assert.equal(events[2].message.text, 'A closure remembers its scope.');
  assert.equal(app.store.list('message')[0].text, 'A closure remembers its scope.');
});
