import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const dir = path.resolve('.local/models'); await fs.mkdir(dir, { recursive: true });
// Give the Emscripten worker its own same-origin URL and CSP instead of inheriting
// the dashboard's stricter policy through a blob URL. Keep the main page free of unsafe-eval.
const voskSource = await fs.readFile('node_modules/vosk-browser/dist/vosk.js', 'utf8');
const embedded = voskSource.match(/var WorkerFactory = createBase64WorkerFactory\('([A-Za-z0-9+/=]+)'/);
if (!embedded || !voskSource.includes('return new Worker(url, options);')) throw new Error('Vosk worker bundle changed; review the worker isolation patch.');
await fs.writeFile(path.join(dir, 'vosk-worker.js'), Buffer.from(embedded[1], 'base64'));
await fs.writeFile(path.join(dir, 'vosk.js'), voskSource.replace('return new Worker(url, options);', "return new Worker('/vendor/vosk-worker.js', options);"));
const models = [
  { name: 'wake-en.tar.gz', url: 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz' },
  { name: 'speaker.onnx', url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/wespeaker_en_voxceleb_resnet34.onnx' }
];
const manifest = [];
for (const model of models) {
  const target = path.join(dir, model.name);
  let bytes;
  try { bytes = await fs.readFile(target); } catch {}
  if (!bytes || bytes.length < 1000000) {
    console.log(`Downloading ${model.name} from ${new URL(model.url).hostname}…`);
    const response = await fetch(model.url, { signal: AbortSignal.timeout(240000) });
    if (!response.ok) throw new Error(`Model download failed: ${response.status} (${model.name})`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000000) throw new Error(`Incomplete model download: ${model.name}`);
    await fs.writeFile(target + '.part', bytes); await fs.rename(target + '.part', target);
  }
  manifest.push({ ...model, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  console.log(`${model.name}: ${(bytes.length / 1048576).toFixed(1)} MB ready`);
}
await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Local wake-word and voice-recognition models are ready. Face models ship with @vladmandic/human.');
