import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { Store } from '../src/store.mjs';
import { Actions, validReminder, toolDefinitions } from '../src/actions.mjs';
import { allowedPath, readText, searchFiles } from '../src/files.mjs';
import { chat, gemini } from '../src/ai.mjs';
import { createApp } from '../server.mjs';
import { normalizeGeminiKey } from '../src/credentials.mjs';
import { protect, unprotect, powershell } from '../src/windows.mjs';

const base = path.resolve('test-output'); await fs.mkdir(base, { recursive: true });
const cleanup = [];
after(async () => { for (const dir of cleanup) { if (!dir.startsWith(base + path.sep)) throw new Error('Unsafe test cleanup path.'); await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } });
async function workspace(t) { const dir = await fs.mkdtemp(path.join(base, 'run-')); cleanup.push(dir); return dir; }
async function database(t) { const dir = await workspace(t); const store = new Store(dir); t.after(() => store.close()); return { dir, store }; }

test('memory and reminder state survives a database restart; source deletion is scoped', async t => {
  const dir = await workspace(t); let store = new Store(dir);
  const memory = store.add('memory', { category: 'project', text: 'Grim' });
  const source = store.add('source', { title: 'Notes', text: 'Private note', type: 'notes' });
  store.add('reminder', { title: 'Study', due: '2030-01-01T00:00:00Z', fired: false });
  store.close(); store = new Store(dir);
  assert.equal(store.get(memory.id, 'memory').text, 'Grim');
  assert.equal(store.list('reminder')[0].title, 'Study');
  store.remove(memory.id, 'source'); assert.equal(store.list('memory').length, 1);
  store.remove(source.id, 'source'); assert.equal(store.list('source').length, 0);
  store.close();
});

test('file boundary rejects traversal, neighboring folders, credentials, overwrite and junction escapes', async t => {
  const dir = await workspace(t), inside = path.join(dir, 'allowed'), neighbor = path.join(dir, 'allowed-other');
  await fs.mkdir(inside); await fs.mkdir(neighbor);
  await fs.writeFile(path.join(inside, 'safe.txt'), 'hello'); await fs.writeFile(path.join(neighbor, 'secret.txt'), 'outside');
  await fs.writeFile(path.join(inside, '.env'), 'OPENAI_API_KEY=secret');
  await assert.rejects(allowedPath(path.join(inside, '..', 'allowed-other', 'secret.txt'), [inside]), /outside/);
  await assert.rejects(readText(path.join(inside, '.env'), [inside]), /Credential/);
  await assert.rejects(allowedPath(path.join(inside, 'safe.txt'), [inside], { destination: true }), /already exists/);
  await fs.symlink(neighbor, path.join(inside, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(readText(path.join(inside, 'escape', 'secret.txt'), [inside]), /outside/);
  assert.equal((await readText(path.join(inside, 'safe.txt'), [inside])).text, 'hello');
  assert.equal((await searchFiles('secret', [inside])).results.length, 0);
});

test('actions require explicit approval, are single-use, and revalidate changed files and enabled roots', async t => {
  const { dir, store } = await database(t), file = path.join(dir, 'sample.txt');
  await fs.writeFile(file, 'hello'); store.set('roots', [dir]);
  let calls = 0;
  const actions = new Actions({ store, platform: { recycleFile: async () => { calls++; } } });
  const pending = await actions.run('delete_file', { path: file });
  assert.equal(calls, 0); assert.ok(pending.pending);
  await actions.approve(pending.pending); assert.equal(calls, 1);
  await assert.rejects(actions.approve(pending.pending), /expired|already/);
  const changed = await actions.run('delete_file', { path: file });
  await fs.writeFile(file, 'changed contents');
  await assert.rejects(actions.approve(changed.pending), /changed/); assert.equal(calls, 1);
  const revoked = await actions.run('delete_file', { path: file }); store.set('roots', []);
  await assert.rejects(actions.approve(revoked.pending), /outside/); assert.equal(calls, 1);
  await assert.rejects(actions.run('open_app', { name: 'powershell.exe -Command evil' }), /Unsupported/);
  assert.throws(() => validReminder('tomorrow'), /valid/);
  assert.throws(() => validReminder('2020-01-01T00:00:00Z'), /future/);
});

test('tool loop preserves tool calls and results; external source text cannot define tools', async () => {
  let count = 0;
  const request = async (model, body) => {
    assert.equal(model, 'test');
    assert.ok(body.tools[0].functionDeclarations.some(fn => fn.name === 'web_search'));
    if (++count === 1) return { candidates: [{ content: { role: 'model', parts: [{ thoughtSignature: 'signature-preserved', functionCall: { name: 'search_sources', id: 'call_1', args: { query: 'meeting' } } }] } }] };
    assert.equal(body.contents.at(-2).parts[0].thoughtSignature, 'signature-preserved');
    assert.equal(body.contents.at(-1).parts[0].functionResponse.id, 'call_1');
    assert.equal(body.contents.at(-1).parts[0].functionResponse.response.result[0].id, 'source1');
    return { candidates: [{ content: { role: 'model', parts: [{ text: 'Found the notes.' }] } }] };
  };
  const result = await chat({ messages: [], memory: [], question: 'Find meeting notes', tools: toolDefinitions, execute: async () => [{ id: 'source1', title: 'Meeting', excerpt: 'Discuss roadmap' }], key: 'test', model: 'test', request });
  assert.equal(count, 2); assert.equal(result.text, 'Found the notes.'); assert.equal(result.events.length, 1);
});

test('HTTP boundary enforces pairing, same-origin requests, secret redaction and durable CRUD', async t => {
  const dir = await workspace(t);
  const app = await createApp({ port: 0, dataDir: dir }); t.after(() => app.close());
  const { origin, token } = app;
  const raw = (route, options = {}) => fetch(origin + route, options);
  let response = await raw('/api/state'); assert.equal(response.status, 401);
  response = await raw('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', 'X-Grim-Client': 'dashboard' }, body: JSON.stringify({ token }) }); assert.equal(response.status, 403);
  response = await raw('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'X-Grim-Client': 'dashboard' }, body: JSON.stringify({ token }) });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0]; assert.ok(response.headers.get('set-cookie').includes('HttpOnly'));
  const call = async (route, data, method = 'POST') => raw(route, { method, headers: { Cookie: cookie, Origin: origin, 'X-Grim-Client': 'dashboard', 'Content-Type': 'application/json' }, ...(method !== 'GET' && { body: JSON.stringify(data) }) });
  response = await call('/api/settings', {provider:'gemini', apiKey: 'AIza-test-only-not-a-real-key', model: 'gemini-test', remember: false }); assert.equal(response.status, 200);
  response = await call('/api/state', null, 'GET'); const initial = await response.json();
  assert.equal(initial.keyConfigured, true); assert.ok(!JSON.stringify(initial).includes('AIza-test-only')); assert.deepEqual(initial.roots, []);
  response = await call('/api/memories', { text: 'Use TypeScript', category: 'preference' }); const memory = await response.json(); assert.ok(memory.id);
  response = await call('/api/sources', { title: 'WhatsApp project', type: 'whatsapp', text: 'Next meeting: architecture review' }); const source = await response.json(); assert.ok(source.id);
  response = await call('/api/actions', { name: 'search_sources', args: { query: 'architecture' } }); const found = await response.json(); assert.equal(found[0].id, source.id);
  response = await call('/api/state', null, 'GET'); const next = await response.json(); assert.equal(next.memories[0].text, 'Use TypeScript'); assert.ok(!Object.hasOwn(next.sources[0], 'text'));
  response = await raw('/api/memories', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(response.status, 403);
  const badHostStatus = await new Promise((resolve, reject) => {
    const req = http.get(origin + '/api/state', { headers: { Cookie: cookie, Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject);
  });
  assert.equal(badHostStatus, 403);
  response = await call('/api/settings', { forgetKey: true }); assert.equal(response.status, 200);
  response = await call('/api/chat', { message: 'hello' }); assert.equal(response.status, 409);
  response = await call(`/api/sources/${source.id}`, {}, 'DELETE'); assert.equal(response.status, 200);
  response = await call(`/api/sources/${source.id}`, null, 'GET'); assert.equal(response.status, 404);
});

test('recording transcript is retained if AI summary fails; dictation does not persist audio or sources', async t => {
  const dir = await workspace(t); let count = 0;
  const mock = async (_model, body) => { count++; if (body.contents?.[0]?.parts?.some(part => part.inlineData)) return { candidates: [{ content: { parts: [{ text: 'We should review the architecture.' }] } }] }; throw new Error('quota exceeded'); };
  const app = await createApp({ port: 0, dataDir: dir, requestAI: mock }); t.after(() => app.close());
  const headers = { Origin: app.origin, 'X-Grim-Client': 'dashboard', 'Content-Type': 'application/json' };
  const paired = await fetch(app.origin + '/api/session', { method: 'POST', headers, body: JSON.stringify({ token: app.token }) }); headers.Cookie = paired.headers.get('set-cookie').split(';')[0];
  const response = await fetch(app.origin + '/api/transcribe', { method: 'POST', headers: { ...headers, 'Content-Type': 'audio/webm' }, body: Buffer.from('mock-audio') });
  const result = await response.json(); assert.equal(response.status, 200); assert.match(result.warning, /Summary failed/); assert.equal(app.store.list('source').length, 1);
  await fetch(app.origin + '/api/transcribe?mode=dictation', { method: 'POST', headers: { ...headers, 'Content-Type': 'audio/webm' }, body: Buffer.from('mock-audio') });
  assert.equal(app.store.list('source').length, 1); assert.equal(count, 3);
});

test('Gemini transport keeps keys out of URLs and reports API and safety failures', async () => {
  const key = 'AIza-not-a-real-key-for-tests';
  const result = await gemini('gemini-test', { contents: [] }, key, { transport: async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    assert.ok(!url.includes(key)); assert.equal(options.headers['x-goog-api-key'], key);
    assert.deepEqual(JSON.parse(options.body), { contents: [] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }));
  } });
  assert.ok(result.candidates);
  await assert.rejects(gemini('gemini-test', {}, '', {}), /Gemini API key/);
  await assert.rejects(gemini('../bad-model', {}, key), /Invalid/);
  await assert.rejects(gemini('gemini-test', {}, key, { transport: async () => new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), { status: 429 }) }), /Quota exceeded/);
  await assert.rejects(gemini('gemini-test', {}, key, { transport: async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })) }), /SAFETY/);
});

test('Gemini key entry accepts evolving auth-key formats and copied env values without exposing secrets', () => {
  const longKey = 'AQ.' + 'x'.repeat(300) + '=suffix';
  assert.equal(normalizeGeminiKey(longKey), longKey);
  assert.equal(normalizeGeminiKey(' GEMINI_API_KEY="AIza-example-key" '), 'AIza-example-key');
  assert.equal(normalizeGeminiKey("'AIza-example-key'"), 'AIza-example-key');
  assert.throws(() => normalizeGeminiKey('sk-other-provider'), /OpenAI key/);
  assert.throws(() => normalizeGeminiKey('key with spaces'), /hidden characters/);
  assert.throws(() => normalizeGeminiKey(''), /key value/);
});

test('Windows credential encryption round-trips despite an incompatible inherited PowerShell module path', { skip: process.platform !== 'win32' }, async () => {
  const before = process.env.PSModulePath;
  process.env.PSModulePath = 'C:\\nonexistent-powershell7-modules';
  try {
    const dummy = 'dummy-credential-for-local-encryption-test';
    const encrypted = await protect(dummy);
    assert.ok(encrypted.startsWith('dpapi-v1:'));
    assert.ok(!encrypted.includes(dummy));
    assert.equal(await unprotect(encrypted), dummy);
    const legacy = await powershell('$s=ConvertTo-SecureString -String $d.text -AsPlainText -Force; ConvertFrom-SecureString -SecureString $s', { text: dummy });
    assert.equal(await unprotect(legacy), dummy);
    await assert.rejects(unprotect('dpapi-v1:invalid'), /could not decrypt/);
  } finally { if (before === undefined) delete process.env.PSModulePath; else process.env.PSModulePath = before; }
});

test('Gemini screenshot and grounded web search preserve citations across function responses', async () => {
  let turns = 0;
  const request = async (_model, body) => {
    turns++;
    if (body.tools?.[0]?.googleSearch) return { candidates: [{ content: { parts: [{ text: 'Current fact' }] }, groundingMetadata: { groundingChunks: [{ web: { title: 'Official source', uri: 'https://example.com/fact' } }] } }] };
    if (turns === 1) {
      assert.equal(body.contents.at(-1).parts[1].inlineData.mimeType, 'image/png');
      return { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'web_search', args: { query: 'current fact' } } }] } }] };
    }
    assert.equal(body.contents.at(-1).parts[0].functionResponse.name, 'web_search');
    return { candidates: [{ content: { parts: [{ text: 'Answer with source' }] } }] };
  };
  const result = await chat({ messages: [], memory: [], question: 'What is this?', image: 'data:image/png;base64,AAAA', tools: [], execute: () => { throw new Error('Grounded search must not invoke OS tools'); }, key: 'test', model: 'gemini-test', request });
  assert.equal(turns, 3); assert.equal(result.sources[0].url, 'https://example.com/fact');
});

test('Gemini migration ignores stored OpenAI keys/models and handles image and structured meeting output', async t => {
  const dir = await workspace(t), old = new Store(dir);
  old.set('openaiKey', 'do-not-send-this-to-google'); old.set('model', 'gpt-old'); old.close();
  const mock = async (_model, body) => {
    if (body.generationConfig?.responseModalities) return { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/webp', data: Buffer.from('mock-image').toString('base64') } }] } }] };
    if (body.generationConfig?.responseJsonSchema) return { candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'Discussed design', decisions: [], tasks: [{ title: 'Review architecture', owner: null, due: null }], questions: [] }) }] } }] };
    return { candidates: [{ content: { parts: [{ text: 'Review the architecture.' }] } }] };
  };
  const app = await createApp({ port: 0, dataDir: dir, requestAI: mock }); t.after(() => app.close());
  const headers = { Origin: app.origin, 'X-Grim-Client': 'dashboard', 'Content-Type': 'application/json' };
  const paired = await fetch(app.origin + '/api/session', { method: 'POST', headers, body: JSON.stringify({ token: app.token }) }); headers.Cookie = paired.headers.get('set-cookie').split(';')[0];
  const initial = await (await fetch(app.origin + '/api/state', { headers })).json();
  assert.notEqual(initial.model, 'gpt-old');
  if (!process.env.GEMINI_API_KEY) assert.equal(initial.keyConfigured, false);
  const oldKeyResponse = await fetch(app.origin + '/api/settings', { method: 'POST', headers, body: JSON.stringify({ apiKey: 'sk-OpenAI-key-not-accepted-for-Gemini', remember: false }) }); assert.equal(oldKeyResponse.status, 400);
  const image = await (await fetch(app.origin + '/api/image', { method: 'POST', headers, body: JSON.stringify({ prompt: 'forest' }) })).json();
  assert.match(image.url, /\.webp$/);
  const downloaded = await fetch(app.origin + image.url, { headers }); assert.equal(downloaded.headers.get('content-type'), 'image/webp');
  const transcript = await (await fetch(app.origin + '/api/transcribe', { method: 'POST', headers: { ...headers, 'Content-Type': 'audio/webm' }, body: Buffer.from('mock-audio') })).json();
  assert.equal(transcript.tasks[0].title, 'Review architecture'); assert.match(transcript.summary, /Suggested tasks/);
});
