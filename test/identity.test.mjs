import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../src/store.mjs';
import { Identity } from '../src/identity.mjs';
import { wakeCommand, joinAudio, cosine, speechWindow } from '../public/identity-core.mjs';
import { preferredDevice, selectableCamera, inputConstraints } from '../public/devices.mjs';
const root = path.resolve('test-output'); await fs.mkdir(root, { recursive: true });
const dirs = []; after(async () => { for (const dir of dirs) { assert.ok(dir.startsWith(root + path.sep)); await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } });
const fakeCrypto = { protect: async text => 'encrypted:' + Buffer.from(text).toString('base64'), unprotect: async text => Buffer.from(text.slice(10), 'base64').toString() };

test('laptop input selection excludes phone and IR cameras and prefers the built-in microphone', () => {
  const devices = [
    { kind: 'videoinput', deviceId: 'phone', label: 'Android phone camera' },
    { kind: 'videoinput', deviceId: 'ir', label: 'Integrated IR Webcam' },
    { kind: 'videoinput', deviceId: 'webcam', label: 'Integrated Webcam' },
    { kind: 'audioinput', deviceId: 'bluetooth', label: "Microphone (Akshay's Nothing Hands-Free HF Audio)" },
    { kind: 'audioinput', deviceId: 'laptop', label: 'Microphone Array on SoundWire Device (Cirrus Logic XU)' }
  ];
  assert.equal(preferredDevice(devices, 'videoinput', 'phone').deviceId, 'webcam');
  assert.equal(preferredDevice(devices, 'audioinput').deviceId, 'laptop');
  assert.equal(selectableCamera(devices[0]), false); assert.equal(selectableCamera(devices[1]), false);
  assert.equal(preferredDevice([devices[0]], 'videoinput'), null);
  assert.deepEqual(inputConstraints('laptop').deviceId, { exact: 'laptop' });
});

test('wake detection needs the wake phrase at the beginning; ordinary conversation cannot become a command', () => {
  assert.deepEqual(wakeCommand('Hey Grim, open Calculator!'), { detected: true, command: 'open calculator' });
  assert.deepEqual(wakeCommand('HEY GRIM'), { detected: true, command: '' });
  assert.equal(wakeCommand('I was talking about hey grim yesterday').detected, false);
  assert.equal(wakeCommand('hey there open calculator').detected, false);
  assert.equal(wakeCommand('hey grimish').detected, false);
  assert.equal(wakeCommand('hey grimm stop listening').command, 'stop listening');
});
test('audio ring keeps only recent samples and similarity rejects invalid or mismatched signatures', () => {
  assert.deepEqual([...joinAudio([Float32Array.from([1,2]), Float32Array.from([3,4,5])], 3)], [3,4,5]);
  assert.deepEqual([...joinAudio([], 100)], []);
  assert.ok(cosine([1,2,3],[1,2,3]) > .999);
  assert.equal(cosine([1,0],[0,1]), 0);
  assert.equal(cosine([NaN],[1]), 0);
  assert.equal(cosine([0,0],[1,1]), 0);
});

test('quiet microphone speech is retained and internal pauses are not spliced out', () => {
  const samples = new Float32Array(48000);
  for (let i = 8000; i < 40000; i++) if (i < 20000 || i > 24000) samples[i] = Math.sin(i * .08) * .003;
  const window = speechWindow(samples);
  assert.ok(window.peakRms < .008); assert.ok(window.activeSeconds > 1);
  assert.ok(window.samples.length > 32000);
  assert.throws(() => speechWindow(new Float32Array(16000)), /clear speech/);
});
test('identity profiles are encrypted, excluded from status, and forgotten independently', async () => {
  const dir = await fs.mkdtemp(path.join(root, 'identity-')); dirs.push(dir); const store = new Store(dir);
  try {
    const id = new Identity(store, process.cwd(), fakeCrypto);
    const face = Array.from({ length: 1024 }, (_, i) => i === 0 ? 1 : 0), other = Array.from({ length: 1024 }, (_, i) => i === 1 ? 1 : 0);
    await id.enrollFace([face, face, face]); assert.equal(id.status().faceSamples, 3);
    assert.equal((await id.verifyFace(face)).matched, true);
    assert.equal((await id.verifyFace(other)).matched, false);
    assert.ok(store.config('identity.face').startsWith('encrypted:'));
    assert.ok(!Object.hasOwn(id.status(), 'vectors'));
    id.forget('face'); assert.equal(id.status().faceSamples, 0);
    await assert.rejects(id.verifyFace(face), /Enroll/);
    id.voiceEmbedding = () => [1,0,0];
    await assert.rejects(id.verifyVoice(Buffer.from('test')), /three voice samples/);
    for (let i = 0; i < 3; i++) await id.enrollVoice(Buffer.from('test'));
    assert.equal((await id.verifyVoice(Buffer.from('test'))).matched, true);
    id.voiceEmbedding = () => [0,1,0]; assert.equal((await id.verifyVoice(Buffer.from('test'))).matched, false);
    await assert.rejects(id.enrollVoice(Buffer.from('test')), /differs/);
    id.forget('voice'); assert.equal(id.status().voiceSamples, 0);
    await assert.rejects(id.enrollFace([[1,2,3]]), /valid face/);
    assert.equal(store.list('memory').length, 0); assert.equal(store.list('source').length, 0);
  } finally { store.close(); }
});
test('native speaker model extracts a finite embedding locally and rejects silence or malformed PCM', async () => {
  const dir = await fs.mkdtemp(path.join(root, 'speaker-')); dirs.push(dir); const store = new Store(dir);
  try {
    const id = new Identity(store, process.cwd(), fakeCrypto);
    if (!id.status().speakerReady) throw new Error('Run npm run setup:identity before this integration test');
    assert.throws(() => id.voiceEmbedding(Buffer.alloc(16000 * 4)), /clear speech/);
    assert.throws(() => id.voiceEmbedding(Buffer.alloc(7)), /Float32/);
    const samples = Buffer.alloc(48000 * 4);
    for (let i = 0; i < 48000; i++) samples.writeFloatLE(Math.sin(i * .08) * .2, i * 4);
    const embedding = id.voiceEmbedding(samples); assert.equal(embedding.length, 256); assert.ok(embedding.every(Number.isFinite));
  } finally { store.close(); }
});

test('forgetting a profile cancels an encryption write already in progress', async () => {
  const dir = await fs.mkdtemp(path.join(root, 'cancel-')); dirs.push(dir); const store = new Store(dir);
  try {
    let finish;
    const crypto = { ...fakeCrypto, protect: () => new Promise(resolve => { finish = resolve; }) };
    const id = new Identity(store, process.cwd(), crypto);
    const save = id.save('face', [Array(1024).fill(1)]);
    id.forget('face'); finish('encrypted-dummy');
    await assert.rejects(save, /cancelled/);
    assert.equal(id.status().faceSamples, 0); assert.equal(store.config('identity.face', null), null);
  } finally { store.close(); }
});
