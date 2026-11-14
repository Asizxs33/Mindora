import test from 'node:test';
import assert from 'node:assert/strict';
import { readRenderedPage } from '../backend/rendered-page.js';

const url = 'https://help.example.com/article';
const resolver = async () => [{ address: '93.184.216.34', family: 4 }];
const body = '# A rendered guide\n\nA useful worked example.\n\n![Original screenshot](https://help.example.com/example.png)';
const payload = overrides => ({ data: { url, finalUrl: url, httpStatus: 200, content: body, ...overrides } });
const json = (data = payload(), options = {}) => new Response(JSON.stringify(data), {
  headers: { 'content-type': 'application/json; charset=utf-8' }, ...options,
});

test('renders one public URL through the fixed anonymous reader and preserves Markdown images', async () => {
  let calls = 0;
  const result = await readRenderedPage(`${url}#section`, { resolver, fetcher: async (target, options) => {
    calls++;
    assert.equal(target, `https://r.jina.ai/${url}`);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(options.headers, { Accept: 'application/json', 'X-Retain-Images': 'all' });
    assert.equal(options.signal.aborted, false);
    return json(payload({ finalUrl: 'https://help.example.com/article/current#section' }));
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result, { url: 'https://help.example.com/article/current', body, contentType: 'text/markdown' });
});

test('rejects private, reserved, malformed and credential-bearing inputs before upstream requests', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return json(); };
  for (const value of ['http://help.example.com/article', 'https://u:p@help.example.com', 'https://127.0.0.1', 'https://help.example.com:8443', 'https://metadata.google.internal']) {
    assert.equal(await readRenderedPage(value, { resolver, fetcher }), null);
  }
  for (const addresses of [
    [{ address: '10.0.0.1', family: 4 }], [{ address: '169.254.169.254', family: 4 }],
    [{ address: '::ffff:7f00:1', family: 6 }],
    [{ address: '93.184.216.34', family: 4 }, { address: '192.168.1.1', family: 4 }],
  ]) assert.equal(await readRenderedPage(url, { resolver: async () => addresses, fetcher }), null);
  assert.equal(calls, 0);
});

test('rejects upstream failures, malformed JSON, bad source status and cross-origin source redirects', async () => {
  const responses = [
    () => json(payload(), { status: 429 }),
    () => json(payload(), { status: 302, headers: { location: 'https://other.org' } }),
    () => new Response('not json', { headers: { 'content-type': 'application/json' } }),
    () => new Response(JSON.stringify(payload()), { headers: { 'content-type': 'text/html' } }),
    () => json({}), () => json(payload({ httpStatus: 403 })), () => json(payload({ httpStatus: '200' })),
    () => json(payload({ content: null })), () => json(payload({ content: '' })),
    () => json(payload({ finalUrl: 'https://other.org/article' })),
    () => json(payload({ finalUrl: 'http://help.example.com/article' })),
    () => json(payload({ finalUrl: 'https://u:p@help.example.com/article' })),
    () => json(payload({ finalUrl: 'https://127.0.0.1/article' })),
    () => { const response = json(); Object.defineProperty(response, 'redirected', { value: true }); return response; },
  ];
  for (const response of responses) assert.equal(await readRenderedPage(url, { resolver, fetcher: async () => response() }), null);
  assert.equal(await readRenderedPage(url, { resolver, fetcher: async () => { throw new Error('Unavailable'); } }), null);
});

test('caps declared and streamed response bytes and cancels oversized bodies', async () => {
  assert.equal(await readRenderedPage(url, { resolver, maxBytes: 100, fetcher: async () => json(payload(), {
    headers: { 'content-type': 'application/json', 'content-length': '101' },
  }) }), null);
  let canceled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('✓'.repeat(34))); },
    cancel() { canceled = true; },
  }), { headers: { 'content-type': 'application/json' } });
  assert.equal(await readRenderedPage(url, { resolver, maxBytes: 100, fetcher: async () => response }), null);
  assert.equal(canceled, true);
  const serialized = JSON.stringify(payload());
  assert.ok(await readRenderedPage(url, { resolver, maxBytes: Buffer.byteLength(serialized), fetcher: async () => json() }));
  assert.equal(await readRenderedPage(url, { resolver, fetcher: async () => json(payload({ content: 'x'.repeat(300_001) })) }), null);
});

test('one deadline includes DNS, upstream response and stream consumption', async () => {
  let calls = 0;
  const started = Date.now();
  assert.equal(await readRenderedPage(url, { timeoutMs: 20, resolver: () => new Promise(() => {}), fetcher: async () => { calls++; return json(); } }), null);
  assert.equal(calls, 0);
  assert.equal(await readRenderedPage(url, { timeoutMs: 20, resolver, fetcher: () => new Promise(() => {}) }), null);
  let canceled = false;
  assert.equal(await readRenderedPage(url, { timeoutMs: 20, resolver, fetcher: async () => new Response(new ReadableStream({
    cancel() { canceled = true; },
  }), { headers: { 'content-type': 'application/json' } }) }), null);
  assert.equal(canceled, true);
  assert.ok(Date.now() - started < 1000);
});

test('parent cancellation aborts active work and already-aborted requests never fetch', async () => {
  const controller = new AbortController();
  let outgoingSignal;
  let calls = 0;
  const fetcher = (_target, options) => { calls++; outgoingSignal = options.signal; return new Promise(() => {}); };
  const pending = readRenderedPage(url, { resolver, fetcher, signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  assert.equal(await pending, null);
  assert.equal(outgoingSignal.aborted, true);
  assert.equal(await readRenderedPage(url, { resolver, fetcher, signal: controller.signal }), null);
  assert.equal(calls, 1);
});
