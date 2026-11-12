export const WAKE_PHRASES = ['hey grim', 'hey grimm'];
export class SpeechEndpoint {
  constructor(silenceMs = 450) { this.silenceMs = silenceMs; this.floor = .0005; this.activeMs = 0; this.quietMs = 0; this.speaking = false; }
  push(level, ms) {
    const threshold = Math.max(.0007, this.floor * 2.6);
    if (level > threshold) { this.activeMs += ms; this.quietMs = 0; if (this.activeMs >= 150) this.speaking = true; }
    else {
      if (!this.speaking) this.floor += (level - this.floor) * .03;
      this.quietMs += ms;
      if (this.speaking && this.quietMs >= this.silenceMs) { this.speaking = false; this.activeMs = 0; this.quietMs = 0; return true; }
      if (!this.speaking && this.quietMs >= this.silenceMs) this.activeMs = 0;
    }
    return false;
  }
}
export function wakeCommand(text, phrases = WAKE_PHRASES) {
  const normalized = String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const phrase of phrases) {
    if (normalized === phrase) return { detected: true, command: '' };
    if (normalized.startsWith(phrase + ' ')) return { detected: true, command: normalized.slice(phrase.length).trim() };
  }
  return { detected: false, command: '' };
}
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return 0;
    dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2;
  }
  return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : 0;
}
export function rms(samples) { return samples.length ? Math.sqrt(samples.reduce((total, x) => total + x * x, 0) / samples.length) : 0; }
export function speechWindow(samples, sampleRate = 16000) {
  const frameSize = Math.round(sampleRate * .02), levels = [];
  for (let at = 0; at + frameSize <= samples.length; at += frameSize) levels.push(rms(samples.subarray(at, at + frameSize)));
  const peakRms = Math.max(0, ...levels), threshold = Math.max(.0005, Math.min(.003, peakRms * .12));
  const active = levels.map((level, index) => level >= threshold ? index : -1).filter(index => index >= 0);
  if (!active.length || active.length * frameSize < sampleRate * .6) throw new Error('Not enough clear speech. Check the selected microphone and record a longer phrase.');
  const padding = Math.round(sampleRate * .15), start = Math.max(0, active[0] * frameSize - padding), end = Math.min(samples.length, (active.at(-1) + 1) * frameSize + padding);
  // Keep internal pauses and consonants intact: concatenating loud frames distorts speaker features.
  return { samples: samples.slice(start, end), peakRms, activeSeconds: active.length * frameSize / sampleRate };
}
export function joinAudio(chunks, maxSamples = 128000) {
  const size = Math.min(chunks.reduce((sum, chunk) => sum + chunk.length, 0), maxSamples);
  const result = new Float32Array(size); let offset = size;
  for (let i = chunks.length - 1; i >= 0 && offset > 0; i--) {
    const chunk = chunks[i], take = Math.min(offset, chunk.length); offset -= take;
    result.set(chunk.subarray(chunk.length - take), offset);
  }
  return result;
}
