// Key formats evolve. Only enforce safe HTTP-header characters, not a provider prefix/length guess.
export function normalizeGeminiKey(value) {
  if (typeof value !== 'string') throw new Error('Paste your Gemini API key.');
  let key = value.trim().replace(/^GEMINI_API_KEY\s*=\s*/, '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1).trim();
  if (!key || key.length > 4096) throw new Error('Paste the Gemini key value from Google AI Studio.');
  if (key.startsWith('sk-')) throw new Error('This appears to be an OpenAI key. Use your Gemini key from Google AI Studio.');
  if (!/^[\x21-\x7e]+$/.test(key)) throw new Error('The key contains spaces or hidden characters. Copy the key value again from Google AI Studio.');
  return key;
}
