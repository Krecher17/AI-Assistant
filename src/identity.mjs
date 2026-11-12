import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { cosine, speechWindow } from '../public/identity-core.mjs';
import { protect, unprotect } from './windows.mjs';
const require = createRequire(import.meta.url);
export class Identity {
  constructor(store, root, crypto = { protect, unprotect }) {
    this.store = store; this.root = root; this.crypto = crypto; this.extractor = null; this.versions = { voice: 0, face: 0 }; this.templates = new Map();
  }
  status() {
    return {
      name: 'Akshay', voiceSamples: this.store.config('identity.voiceCount', 0), faceSamples: this.store.config('identity.faceCount', 0),
      wakeReady: ['wake-en.tar.gz', 'vosk.js', 'vosk-worker.js'].every(file => fs.existsSync(path.join(this.root, '.local/models', file))),
      speakerReady: fs.existsSync(path.join(this.root, '.local/models/speaker.onnx')),
      voiceThreshold: this.store.config('identity.voiceThreshold', 0.6), faceThreshold: 0.65
    };
  }
  async read(kind) {
    const encrypted = this.store.config(`identity.${kind}`, null); if (!encrypted) return [];
    const cached = this.templates.get(kind); if (cached?.encrypted === encrypted) return cached.vectors;
    const vectors = JSON.parse(await this.crypto.unprotect(encrypted));
    if (this.store.config(`identity.${kind}`, null) !== encrypted) return [];
    this.templates.set(kind, { encrypted, vectors }); return vectors;
  }
  async save(kind, vectors) {
    const version = this.versions[kind], encrypted = await this.crypto.protect(JSON.stringify(vectors));
    if (version !== this.versions[kind]) throw new Error('Enrollment was cancelled because the profile was forgotten.');
    this.store.set(`identity.${kind}`, encrypted);
    this.templates.set(kind, { encrypted, vectors });
    this.store.set(`identity.${kind}Count`, vectors.length);
  }
  forget(kind) {
    if (!['voice', 'face'].includes(kind)) throw new Error('Unknown identity type.');
    this.versions[kind]++;
    this.templates.delete(kind);
    this.store.set(`identity.${kind}`, null); this.store.set(`identity.${kind}Count`, 0);
  }
  voiceEmbedding(bytes) {
    if (!bytes.length || bytes.length % 4 || bytes.length > 16000 * 15 * 4) throw new Error('Provide up to 15 seconds of mono 16 kHz Float32 audio.');
    const samples = new Float32Array(bytes.length / 4);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = bytes.readFloatLE(i * 4);
      if (!Number.isFinite(samples[i]) || Math.abs(samples[i]) > 1.01) throw new Error('Invalid PCM audio.');
    }
    const window = speechWindow(samples), speech = window.samples;
    this.lastVoiceQuality = { peakRms: window.peakRms, activeSeconds: window.activeSeconds };
    if (!this.status().speakerReady) throw new Error('Run npm run setup:identity to download the local speaker model.');
    if (!this.extractor) {
      const { SpeakerEmbeddingExtractor } = require('sherpa-onnx-node');
      this.extractor = new SpeakerEmbeddingExtractor({ model: path.join(this.root, '.local/models/speaker.onnx'), numThreads: 2, debug: false, provider: 'cpu' });
    }
    const stream = this.extractor.createStream();
    stream.acceptWaveform({ samples: speech, sampleRate: 16000 });
    stream.inputFinished();
    if (!this.extractor.isReady(stream)) throw new Error('Record more speech to extract your voice signature.');
    return Array.from(this.extractor.compute(stream, false));
  }
  async enrollVoice(bytes) {
    const vector = this.voiceEmbedding(bytes), existing = await this.read('voice');
    // Avoid silently enrolling a different person as another reference.
    if (existing.length && Math.max(...existing.map(v => cosine(v, vector))) < 0.4) throw new Error('This sample differs from your earlier voice sample. Try again in the same room, or forget the profile and start over.');
    await this.save('voice', [...existing, vector].slice(-3)); return this.status();
  }
  async verifyVoice(bytes) {
    const references = await this.read('voice');
    if (references.length < 3) throw new Error('Enroll three voice samples before enabling wake-word mode.');
    const embedding = this.voiceEmbedding(bytes), score = Math.max(...references.map(v => cosine(v, embedding)));
    return { matched: score >= this.status().voiceThreshold, score, name: score >= this.status().voiceThreshold ? 'Akshay' : null, quality: this.lastVoiceQuality };
  }
  faceVectors(data) {
    if (!Array.isArray(data) || !data.length || data.length > 3 || data.some(v => !Array.isArray(v) || v.length !== 1024 || v.some(x => !Number.isFinite(x) || Math.abs(x) > 100))) throw new Error('Provide valid face descriptors from the local camera model.');
    return data;
  }
  async enrollFace(data) { await this.save('face', this.faceVectors(data)); return this.status(); }
  async verifyFace(vector) {
    this.faceVectors([vector]); const references = await this.read('face');
    if (!references.length) throw new Error('Enroll your face first.');
    const score = Math.max(...references.map(v => cosine(v, vector)));
    return { matched: score >= this.status().faceThreshold, score, name: score >= this.status().faceThreshold ? 'Akshay' : null };
  }
}
