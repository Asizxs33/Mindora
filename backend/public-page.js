import { lookup as lookupAddress } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { sourceUrl } from '../core/learning-plan.js';

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 4500;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml', 'text/plain', 'text/markdown', 'text/x-markdown']);

// Conservatively exclude special-purpose space, including globally reachable
// anycast exceptions. Registries: https://www.iana.org/assignments/iana-ipv4-special-registry/
// and https://www.iana.org/assignments/iana-ipv6-special-registry/.
function publicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    // Azure's platform virtual IP is public-looking but reaches host services.
    if (address === '168.63.129.16') return false;
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168
        || (b === 0 && (c === 0 || c === 2))
        || (b === 31 && c === 196) || (b === 52 && c === 193)
        || (b === 88 && c === 99) || (b === 175 && c === 48)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113));
  }
  if (family !== 6 || address.includes('%') || address.includes('.')) return false;
  const halves = address.toLowerCase().split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const words = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right].map(word => parseInt(word, 16));
  // Only global unicast 2000::/3, excluding protocol, transition and documentation ranges.
  return (words[0] & 0xe000) === 0x2000
    && !(words[0] === 0x2001 && (words[1] < 0x200 || words[1] === 0xdb8))
    && words[0] !== 0x2002
    && !(words[0] === 0x2620 && words[1] === 0x4f && words[2] === 0x8000)
    && !(words[0] === 0x3fff && words[1] < 0x1000);
}

function untilAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error('Page read aborted'));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

// Callers must supply their request deadline signal. Returning the vetted DNS
// records lets the direct reader pin the connection without another lookup.
export async function validatePublicUrl(value, { signal, resolver = lookupAddress } = {}) {
  const url = sourceUrl(value);
  if (!url || signal?.aborted) return null;
  try {
    const pending = resolver(new URL(url).hostname, { all: true, verbatim: true });
    const addresses = await (signal ? untilAbort(pending, signal) : pending);
    if (!Array.isArray(addresses) || !addresses.length
      || addresses.some(item => !item || !publicAddress(item.address) || isIP(item.address) !== item.family)) return null;
    return { url, addresses };
  } catch { return null; }
}

function readResponse(url, address, { request, signal, maxBytes }) {
  return new Promise(resolve => {
    let outgoing;
    let incoming;
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      incoming?.destroy();
      outgoing?.destroy();
      resolve(value);
    };
    const onAbort = () => finish(null);
    if (signal.aborted) return finish(null);
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      outgoing = request(url, {
        method: 'GET',
        agent: false,
        rejectUnauthorized: true,
        maxHeaderSize: 16_384,
        family: address.family,
        autoSelectFamily: false,
        // Never resolve the hostname again when opening the socket: that would
        // allow DNS rebinding between validation and connection establishment.
        lookup: (_hostname, options, callback) => options?.all
          ? callback(null, [{ ...address }])
          : callback(null, address.address, address.family),
        headers: {
          Accept: 'text/html, application/xhtml+xml, text/plain, text/markdown',
          'Accept-Encoding': 'identity',
          'User-Agent': 'Mindora-Learning/1.0',
        },
      }, response => {
        incoming = response;
        response.on('error', () => finish(null));
        response.once('aborted', () => finish(null));
        response.once('close', () => finish(null));
        if (settled || signal.aborted) return response.destroy();
        if (REDIRECTS.has(response.statusCode)) {
          return finish(typeof response.headers.location === 'string' ? { redirect: response.headers.location } : null);
        }
        const type = response.headers['content-type'];
        const contentType = typeof type === 'string' ? type.split(';', 1)[0].trim().toLowerCase() : '';
        const encoding = response.headers['content-encoding'];
        const length = response.headers['content-length'];
        if (!Number.isInteger(response.statusCode) || response.statusCode < 200 || response.statusCode >= 300 || !CONTENT_TYPES.has(contentType)
          || (encoding !== undefined && (typeof encoding !== 'string' || encoding.trim().toLowerCase() !== 'identity'))
          || (length !== undefined && (typeof length !== 'string' || !/^\d+$/.test(length) || Number(length) > maxBytes))) {
          return finish(null);
        }
        const chunks = [];
        let bytes = 0;
        response.on('data', chunk => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > maxBytes) return finish(null);
          chunks.push(buffer);
        });
        response.once('end', () => finish({ url, body: Buffer.concat(chunks, bytes).toString('utf8'), contentType }));
      });
      outgoing.on('error', () => finish(null));
      outgoing.end();
    } catch {
      finish(null);
    }
  });
}

/** Read a bounded public HTTPS document; failures and unsupported pages return null.
 * Resolver/request injection is for server-side tests only, never request payloads.
 */
export async function readPublicPage(value, {
  signal,
  maxBytes = MAX_BYTES,
  timeoutMs = TIMEOUT_MS,
  resolver = lookupAddress,
  request = httpsRequest,
} = {}) {
  let url = sourceUrl(value);
  if (!url || signal?.aborted || !Number.isSafeInteger(maxBytes) || maxBytes < 1
    || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;
  maxBytes = Math.min(maxBytes, MAX_BYTES);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(onAbort, Math.min(timeoutMs, TIMEOUT_MS));
  try {
    for (let redirects = 0; redirects <= 2; redirects++) {
      const validated = await validatePublicUrl(url, { signal: controller.signal, resolver });
      if (!validated) return null;
      const { addresses } = validated;
      // Prefer IPv4 when available; both families must have passed validation.
      const address = addresses.find(item => item.family === 4) ?? addresses[0];
      const response = await readResponse(url, address, { request, signal: controller.signal, maxBytes });
      if (!response || !Object.hasOwn(response, 'redirect')) return response;
      if (redirects === 2) return null;
      url = sourceUrl(new URL(response.redirect, url).href);
      if (!url) return null;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
