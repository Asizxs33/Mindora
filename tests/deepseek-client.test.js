import test from 'node:test';
import assert from 'node:assert/strict';
import { callDeepSeek, completeJson } from '../backend/deepseek-client.js';

const messages = [
  { role: 'system', content: 'Return only JSON with a Python exercise.' },
  { role: 'user', content: '{"goal":"Practise Python dictionaries"}' },
];
const payload = {
  title: 'Print a small dictionary',
  starter: 'item = {"name": "Ada", "quote": "a \\\"quoted\\\" value", "brace": "}"}\nprint(item["name"])',
  task: 'Print a literal `}` and explain its meaning.',
  example: { output: 'Ada\n}', choices: ['{', '}', '"'] },
};
const completion = (content, finishReason = 'stop') => Response.json({
  choices: [{ finish_reason: finishReason, message: { content } }],
});

test('JSON completion accepts plain, fenced and prose-wrapped objects without changing code strings', async () => {
  const encoded = JSON.stringify(payload);
  for (const content of [encoded, `\n\x60\x60\x60json\n${encoded}\n\x60\x60\x60\n`, `Here is the exercise:\n${encoded}\nEnd of exercise.`]) {
    let calls = 0;
    const signal = new AbortController().signal;
    const result = await completeJson(messages, 3500, 'test-only', async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(options.signal, signal);
      assert.equal(options.redirect, 'error');
      const request = JSON.parse(options.body);
      assert.deepEqual(request.messages, messages);
      assert.equal(request.max_tokens, 3500);
      return completion(content);
    }, signal);
    assert.deepEqual(result, payload);
    assert.equal(calls, 1);
  }
});

test('one invalid stopped completion retries once within the same signal and preserves original instructions', async () => {
  const original = structuredClone(messages);
  const signal = new AbortController().signal;
  const calls = [];
  const result = await completeJson(messages, 3500, 'test-only', async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push(request);
    assert.equal(options.signal, signal);
    assert.equal(request.max_tokens, 3500);
    if (calls.length === 1) return completion('{"starter":"print("not escaped")"}');
    assert.deepEqual(request.messages.slice(0, original.length), original);
    assert.ok(request.messages.length > original.length);
    assert.match(request.messages.at(-1).content, /json/i);
    return completion(JSON.stringify(payload));
  }, signal);
  assert.deepEqual(result, payload);
  assert.equal(calls.length, 2);
  assert.deepEqual(messages, original, 'retries must not mutate the caller’s prompt');
});

test('invalid JSON is never retried more than once and receives a distinct error name', async () => {
  let calls = 0;
  await assert.rejects(completeJson(messages, 900, 'test-only', async () => {
    calls++;
    return completion('{"unfinished":');
  }, new AbortController().signal), { name: 'DeepSeekInvalidJson' });
  assert.equal(calls, 2);
});

test('parser rejects ambiguous objects and never rescues a nested object from broken JSON', async () => {
  for (const content of [
    '{"first":1}\n{"second":2}',
    'First answer: {"first":1}\nAnother answer: {"second":2}',
    '{"outer":{"nested":"valid"}',
    '{"starter":"this has an unescaped newline\nhere"}',
  ]) {
    let calls = 0;
    await assert.rejects(completeJson(messages, 900, 'test-only', async () => {
      calls++;
      return completion(content);
    }, new AbortController().signal), { name: 'DeepSeekInvalidJson' });
    assert.equal(calls, 2);
  }
});

test('a truncated completion is rejected without retry even when its content is parseable', async () => {
  let calls = 0;
  await assert.rejects(completeJson(messages, 900, 'test-only', async () => {
    calls++;
    return completion(JSON.stringify(payload), 'length');
  }, new AbortController().signal), { name: 'DeepSeekOutputLimit' });
  assert.equal(calls, 1);
});

test('authentication and rate-limit responses keep their status and are not retried', async () => {
  for (const status of [401, 429]) {
    let calls = 0;
    await assert.rejects(completeJson(messages, 900, 'test-only', async () => {
      calls++;
      return Response.json({ error: { message: 'Request unavailable' } }, { status });
    }, new AbortController().signal), error => error.providerStatus === status);
    assert.equal(calls, 1);
  }
});

test('an already aborted request makes no provider request', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(completeJson(messages, 900, 'test-only', async () => {
    calls++;
    return completion(JSON.stringify(payload));
  }, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('expiry after an invalid response prevents a fresh retry from extending the deadline', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(completeJson(messages, 900, 'test-only', async () => {
    calls++;
    controller.abort();
    return completion('{"invalid":');
  }, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('an aborted fetch is not retried', async () => {
  let calls = 0;
  await assert.rejects(completeJson(messages, 900, 'test-only', async () => {
    calls++;
    throw new DOMException('Aborted', 'AbortError');
  }, new AbortController().signal), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('malformed provider envelopes have a distinct error and can recover with one JSON retry', async () => {
  const invalidEnvelope = () => new Response('not JSON', { status: 200, headers: { 'content-type': 'application/json' } });
  await assert.rejects(callDeepSeek('/chat/completions', { messages }, 'test-only', async () => invalidEnvelope(), new AbortController().signal), {
    name: 'ProviderInvalidJson:completions',
  });
  const signal = new AbortController().signal;
  let calls = 0;
  const result = await completeJson(messages, 900, 'test-only', async (url, options) => {
    calls++;
    assert.equal(options.signal, signal);
    return calls === 1 ? invalidEnvelope() : completion(JSON.stringify(payload));
  }, signal);
  assert.equal(calls, 2);
  assert.deepEqual(result, payload);
});
