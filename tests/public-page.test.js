import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readPublicPage } from '../backend/public-page.js';

const url = 'https://docs.example.com/guide';
const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];

function transport(routes = [{}]) {
  const calls = [];
  const request = (target, options, respond) => {
    const spec = routes[calls.length] ?? routes.at(-1);
    const outgoing = new EventEmitter();
    const call = { url: target, options, destroyed: false, response: null };
    calls.push(call);
    outgoing.destroy = () => { call.destroyed = true; };
    outgoing.end = () => queueMicrotask(() => {
      if (call.destroyed) return;
      options.lookup(new URL(target).hostname, {}, (error, address, family) => {
        assert.ifError(error);
        call.address = address;
        call.family = family;
      });
      if (spec.requestError) return outgoing.emit('error', new Error('TLS failure'));
      if (spec.noResponse) return;
      const response = new PassThrough();
      call.response = response;
      response.statusCode = spec.status ?? 200;
      response.headers = { 'content-type': 'text/html; charset=utf-8', ...spec.headers };
      respond(response);
      if (spec.stall || response.destroyed) return;
      for (const chunk of spec.chunks ?? [spec.body ?? '<h1>Readable guide</h1>']) {
        if (!response.destroyed) response.write(chunk);
      }
      if (spec.responseError && !response.destroyed) return response.destroy(new Error('Disconnected'));
      if (!response.destroyed) response.end();
    });
    return outgoing;
  };
  return { calls, request };
}

test('reads public text with a pinned address and no forwarded credentials', async () => {
  const mock = transport();
  let resolutions = 0;
  const result = await readPublicPage(`${url}#section`, {
    request: mock.request,
    resolver: async (_hostname, options) => {
      resolutions++;
      assert.deepEqual(options, { all: true, verbatim: true });
      return publicDns();
    },
  });
  assert.deepEqual(result, { url, body: '<h1>Readable guide</h1>', contentType: 'text/html' });
  assert.equal(resolutions, 1);
  const call = mock.calls[0];
  assert.equal(call.address, '93.184.216.34');
  assert.equal(call.options.agent, false);
  assert.equal(call.options.rejectUnauthorized, true);
  assert.equal(call.options.headers['Accept-Encoding'], 'identity');
  assert.equal(call.options.headers.Authorization, undefined);
  assert.equal(call.options.headers.Cookie, undefined);
  // Repeated socket lookups always use the vetted address without consulting DNS.
  call.options.lookup('docs.example.com', { all: true }, (error, addresses) => {
    assert.ifError(error);
    assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]);
  });
  assert.equal(resolutions, 1);
});

test('rejects unsafe URL forms before DNS or networking', async () => {
  let touchedNetwork = false;
  const forbidden = () => { touchedNetwork = true; throw new Error('Unexpected network'); };
  for (const target of [
    'http://docs.example.com', 'file:///etc/passwd', 'https://user:secret@docs.example.com',
    'https://docs.example.com:8443', 'https://127.0.0.1', 'https://2130706433',
    'https://0x7f000001', 'https://[::1]', 'https://localhost', 'https://service.internal',
    'https://metadata.google.internal', 'https://docs.example.com/' + 'a'.repeat(1000),
  ]) assert.equal(await readPublicPage(target, { resolver: forbidden, request: forbidden }), null, target);
  assert.equal(touchedNetwork, false);
});

test('rejects private, metadata, reserved and transition DNS addresses', async () => {
  const forbiddenAddresses = [
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '100.127.255.254', '127.0.0.2',
    '168.63.129.16', '169.254.169.254', '172.16.0.1', '172.31.255.254', '192.0.0.8', '192.0.2.1',
    '192.31.196.1', '192.52.193.1', '192.88.99.1', '192.168.1.1', '192.175.48.1',
    '198.18.0.1', '198.19.255.254', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1', '100::1',
    '2001::1', '2001:1ff::1', '2001:db8::1', '2002:7f00:1::', '2620:4f:8000::1',
    '3fff:fff::1', '5f00::1', 'fc00::1', 'fd00::1', 'fe80::1', 'fe80::1%eth0', 'ff02::1',
  ];
  for (const address of forbiddenAddresses) {
    const mock = transport();
    assert.equal(await readPublicPage(url, {
      request: mock.request,
      resolver: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
    }), null, address);
    assert.equal(mock.calls.length, 0, address);
  }
});

test('rejects mixed safe/private DNS answers and invalid resolver responses', async () => {
  for (const addresses of [
    [], null, [{ address: 'not-an-ip', family: 4 }], [{ address: '93.184.216.34', family: 6 }],
    [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }],
  ]) {
    const mock = transport();
    assert.equal(await readPublicPage(url, { request: mock.request, resolver: async () => addresses }), null);
    assert.equal(mock.calls.length, 0);
  }
});

test('accepts ordinary public IPv6 and text content types', async () => {
  for (const contentType of ['text/plain', 'text/markdown', 'text/x-markdown', 'application/xhtml+xml']) {
    const mock = transport([{ headers: { 'content-type': contentType }, body: 'Текст ✓' }]);
    assert.equal((await readPublicPage(url, {
      request: mock.request,
      resolver: async () => [{ address: '2606:4700:4700::1111', family: 6 }],
    }))?.body, 'Текст ✓');
    assert.equal(mock.calls[0].family, 6);
  }
});

test('validates and re-resolves each redirect, allowing at most two', async () => {
  const mock = transport([
    { status: 302, headers: { location: '/next' } },
    { status: 307, headers: { location: 'https://other.example.com/final#part' } },
    { body: 'Final page' },
  ]);
  const hosts = [];
  const result = await readPublicPage(url, {
    request: mock.request,
    resolver: async hostname => { hosts.push(hostname); return publicDns(); },
  });
  assert.deepEqual(hosts, ['docs.example.com', 'docs.example.com', 'other.example.com']);
  assert.equal(result?.url, 'https://other.example.com/final');
  assert.equal(result?.body, 'Final page');
  const loop = transport([{ status: 301, headers: { location: '/loop' } }]);
  assert.equal(await readPublicPage(url, { request: loop.request, resolver: publicDns }), null);
  assert.equal(loop.calls.length, 3);
});

test('blocks redirect SSRF and HTTPS downgrade before requesting the target', async () => {
  for (const location of ['http://docs.example.com', 'https://169.254.169.254', 'https://[::1]', 'https://u:p@docs.example.com']) {
    const mock = transport([{ status: 302, headers: { location } }]);
    assert.equal(await readPublicPage(url, { request: mock.request, resolver: publicDns }), null, location);
    assert.equal(mock.calls.length, 1);
  }
  const mock = transport([{ status: 302, headers: { location: 'https://private.example.com' } }]);
  assert.equal(await readPublicPage(url, {
    request: mock.request,
    resolver: async host => host === 'private.example.com' ? [{ address: '10.0.0.1', family: 4 }] : publicDns(),
  }), null);
  assert.equal(mock.calls.length, 1);
});

test('bounds streaming bytes without Content-Length and rejects compressed or nontext bodies', async () => {
  for (const spec of [
    { chunks: ['1234', '5678', '9'] },
    { body: 'small', headers: { 'content-length': '9' } },
    { body: 'small', headers: { 'content-length': 'not-a-number' } },
    { body: 'small', headers: { 'content-encoding': 'gzip' } },
    { body: 'small', headers: { 'content-type': 'application/json' } },
    { body: 'small', headers: { 'content-type': 'image/svg+xml' } },
    { status: 403 },
    { responseError: true, body: 'small' },
    { requestError: true },
  ]) {
    const mock = transport([spec]);
    assert.equal(await readPublicPage(url, { request: mock.request, resolver: publicDns, maxBytes: 8 }), null);
    assert.equal(mock.calls[0].destroyed, true);
  }
  const exact = transport([{ body: '12345678' }]);
  assert.equal((await readPublicPage(url, { request: exact.request, resolver: publicDns, maxBytes: 8 }))?.body, '12345678');
  const unicode = transport([{ body: '✓✓✓' }]);
  assert.equal(await readPublicPage(url, { request: unicode.request, resolver: publicDns, maxBytes: 8 }), null);
});

test('one deadline bounds DNS, waiting for headers and streaming', async () => {
  const before = Date.now();
  assert.equal(await readPublicPage(url, { resolver: () => new Promise(() => {}), timeoutMs: 20 }), null);
  for (const spec of [{ noResponse: true }, { stall: true }]) {
    const mock = transport([spec]);
    assert.equal(await readPublicPage(url, { request: mock.request, resolver: publicDns, timeoutMs: 20 }), null);
    assert.equal(mock.calls[0].destroyed, true);
    if (mock.calls[0].response) assert.equal(mock.calls[0].response.destroyed, true);
  }
  assert.ok(Date.now() - before < 1000);
});

test('parent cancellation promptly closes an active request', async () => {
  const controller = new AbortController();
  const mock = transport([{ stall: true }]);
  const pending = readPublicPage(url, { request: mock.request, resolver: publicDns, signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  assert.equal(await pending, null);
  assert.equal(mock.calls[0].destroyed, true);
  assert.equal(mock.calls[0].response.destroyed, true);
  assert.equal(await readPublicPage(url, { request: mock.request, resolver: publicDns, signal: controller.signal }), null);
  assert.equal(mock.calls.length, 1);
});
