export async function generate({ messages, schema, model = 'qwen2.5:14b', signal, maxTokens = 420, fetchImpl = fetch }) {
  const combined = AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(90_000)]);
  const response = await fetchImpl('http://127.0.0.1:11434/api/chat', {
    method: 'POST', signal: combined, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, keep_alive: '30m', messages, ...(model.startsWith('qwen3') ? { think: false } : {}), ...(schema ? { format: schema } : {}), options: { num_ctx: 8192, num_predict: maxTokens, temperature: 0.1, seed: 42 } }),
  });
  if (!response.ok) throw new Error('The local model is unavailable.');
  const value = await response.json();
  if (value.done_reason === 'length' || !value.message?.content) throw new Error('The answer was incomplete.');
  return schema ? JSON.parse(value.message.content) : value.message.content;
}
