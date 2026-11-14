export async function callDeepSeek(path, body, apiKey, fetcher, signal) {
  const response = await fetcher('https://api.deepseek.com' + path, {
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const reason = String(payload?.error?.message ?? payload?.message ?? '').toLowerCase();
    const category = reason.includes('risk') ? 'ContentRisk'
      : reason.includes('response_format') || reason.includes('json') ? 'ResponseFormat'
      : reason.includes('token') ? 'TokenLimit'
      : reason.includes('query') ? 'SearchQuery'
      : 'ProviderRequest';
    const endpoint = path.split('/').at(-1);
    throw Object.assign(new Error('DeepSeek request failed'), {
      name: `${category}:${endpoint}`, providerStatus: response.status,
    });
  }
  return response.json();
}

export async function completeJson(messages, maxTokens, apiKey, fetcher, signal) {
  const data = await callDeepSeek('/chat/completions', {
    model: 'deepseek-flash',
    thinking: { type: 'disabled' },
    safety_check: { level: 'high' },
    max_tokens: maxTokens,
    messages,
  }, apiKey, fetcher, signal);
  const choice = data.choices?.[0];
  if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string') {
    throw Object.assign(new Error('Incomplete DeepSeek response'), {
      name: choice?.finish_reason === 'length' ? 'DeepSeekOutputLimit' : 'IncompleteDeepSeekOutput',
    });
  }
  const output = choice.message.content.trim().replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/gi, '');
  return JSON.parse(output);
}
