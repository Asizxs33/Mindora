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
  try { return await response.json(); }
  catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw Object.assign(new Error('Invalid provider response envelope'), {
      name: `ProviderInvalidJson:${path.split('/').at(-1)}`,
    });
  }
}

function parseObject(content) {
  const output = content.trim().replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/gi, '');
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  try {
    const value = JSON.parse(output);
    if (object(value)) return value;
    throw new Error('Expected object');
  } catch { /* Some responses add an introduction outside the JSON object. */ }
  // Locate one complete top-level object without rewriting any quoted code.
  // Never salvage a nested object from a broken outer response or choose one
  // of several competing objects. Such content requires a fresh generation.
  if (output.startsWith('[')) throw new Error('Expected object');
  let start = -1, depth = 0, quoted = false, escaped = false;
  const objects = [];
  for (let index = 0; index < output.length; index++) {
    const char = output[index];
    if (start < 0) {
      if (char === '{') { start = index; depth = 1; }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      objects.push(output.slice(start, index + 1));
      start = -1;
    }
  }
  if (start >= 0 || objects.length !== 1) throw new Error('Ambiguous or incomplete JSON');
  const value = JSON.parse(objects[0]);
  if (!object(value)) throw new Error('Expected object');
  return value;
}

export async function completeJson(messages, maxTokens, apiKey, fetcher, signal) {
  const body = {
    model: 'deepseek-flash',
    thinking: { type: 'disabled' },
    safety_check: { level: 'high' },
    max_tokens: maxTokens,
    messages,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    let data;
    try { data = await callDeepSeek('/chat/completions', body, apiKey, fetcher, signal); }
    catch (error) {
      if (error.name !== 'ProviderInvalidJson:completions' || attempt > 0) throw error;
      continue;
    }
    const choice = data?.choices?.[0];
    if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string') {
      throw Object.assign(new Error('Incomplete DeepSeek response'), {
        name: choice?.finish_reason === 'length' ? 'DeepSeekOutputLimit' : 'IncompleteDeepSeekOutput',
      });
    }
    try { return parseObject(choice.message.content); }
    catch {
      if (attempt > 0) throw Object.assign(new Error('Invalid DeepSeek JSON object'), { name: 'DeepSeekInvalidJson' });
      // Preserve the original instructions and source evidence. Do not send
      // malformed model content back as instructions or change the deadline.
      body.messages = [...messages, { role: 'user', content: 'The last response could not be parsed as JSON. Generate the requested object again. Output only one valid JSON object, without prose or Markdown fences. Escape quotes, backslashes and line breaks inside strings. Do not omit or change the requested fields.' }];
      console.warn('Mindora retrying malformed DeepSeek JSON', { maxTokens, characters: choice.message.content.length });
    }
  }
}
