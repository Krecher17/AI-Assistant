export async function readGeminiStream(response, onText) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const parts = []; let buffer = '', last = {}, bytes = 0;
  const event = block => {
    const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!data || data === '[DONE]') return;
    const chunk = JSON.parse(data);
    if (chunk.error) throw new Error(chunk.error.message || 'Gemini stream failed.');
    last = { ...last, ...chunk };
    for (const part of chunk.candidates?.[0]?.content?.parts || []) {
      parts.push(part); if (part.text && !part.thought) onText(part.text);
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length; if (bytes > 4000000) throw new Error('Response stream exceeded its size limit.');
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let at; while ((at = buffer.indexOf('\n\n')) >= 0) { event(buffer.slice(0, at)); buffer = buffer.slice(at + 2); }
    }
    buffer += decoder.decode(); if (buffer.trim()) event(buffer);
  } finally { reader.releaseLock(); }
  const candidate = last.candidates?.[0] || {};
  return { ...last, candidates: [{ ...candidate, content: { role: 'model', parts } }] };
}
