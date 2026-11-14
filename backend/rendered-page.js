import { sourceUrl } from '../core/learning-plan.js';
import { validatePublicUrl } from './public-page.js';

const MAX_BYTES = 300_000;
const TIMEOUT_MS = 8000;

function untilAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error('Rendered page read aborted'));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

// Optional anonymous rendering of one validated public page. The caller owns
// the fallback budget; this adapter never retries or discovers additional URLs.
// API: https://github.com/jina-ai/reader
export async function readRenderedPage(value, {
  signal,
  fetcher = fetch,
  resolver,
  timeoutMs = TIMEOUT_MS,
  maxBytes = MAX_BYTES,
} = {}) {
  if (signal?.aborted || !sourceUrl(value) || !Number.isFinite(timeoutMs) || timeoutMs <= 0
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1) return null;
  maxBytes = Math.min(maxBytes, MAX_BYTES);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(onAbort, Math.min(timeoutMs, TIMEOUT_MS));
  let response;
  let reader;
  try {
    const validated = await validatePublicUrl(value, { signal: controller.signal, resolver });
    if (!validated || controller.signal.aborted) return null;
    response = await untilAbort(fetcher(`https://r.jina.ai/${validated.url}`, {
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'X-Retain-Images': 'all' },
    }), controller.signal);
    const length = response.headers.get('content-length');
    if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300 || response.redirected
      || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')
      || (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) || !response.body) return null;
    reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    for (;;) {
      const { done, value: chunk } = await untilAbort(reader.read(), controller.signal);
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > maxBytes) return null;
      chunks.push(Buffer.from(chunk));
    }
    const { data } = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
    const finalUrl = sourceUrl(data?.finalUrl ?? data?.url);
    if (!Number.isInteger(data?.httpStatus) || data.httpStatus < 200 || data.httpStatus >= 300
      || typeof data.content !== 'string' || !data.content.trim() || !finalUrl
      || new URL(finalUrl).origin !== new URL(validated.url).origin) return null;
    return { url: finalUrl, body: data.content, contentType: 'text/markdown' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    controller.abort();
    // Cancellation is deliberately not awaited: a stalled remote stream must
    // not extend the overall deadline while we release the connection.
    try { (reader ? reader.cancel() : response?.body?.cancel())?.catch(() => {}); } catch { /* Already closed. */ }
  }
}
