import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewWithDeepSeek } from '../backend/task-review-api.js';

const input = {
  goal: 'Introduce myself in English', task: 'Write a greeting and your profession.',
  criterion: 'Use a greeting and a complete sentence with I am.',
  answer: 'PRIVATE_LEARNER_INPUT: Hi, I am a teacher.', language: 'en',
};
const feedback = { observation: 'Your greeting and profession form a complete introduction.', nextAction: 'Write another introduction using a different profession.' };
const completion = (value, finishReason = 'stop') => Response.json({ choices: [{
  finish_reason: finishReason, message: { content: typeof value === 'string' ? value : JSON.stringify(value) },
}] });

test('valid and fenced feedback is accepted on its first request', async () => {
  for (const content of [JSON.stringify(feedback), `\x60\x60\x60json\n${JSON.stringify(feedback)}\n\x60\x60\x60`]) {
    let calls = 0;
    const result = await reviewWithDeepSeek(input, 'test-only', async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(options.redirect, 'error');
      const body = JSON.parse(options.body);
      assert.equal(body.thinking.type, 'enabled');
      assert.equal(body.response_format.type, 'json_object');
      assert.deepEqual(JSON.parse(body.messages[1].content), input);
      return completion(content);
    });
    assert.deepEqual(result, feedback);
    assert.equal(calls, 1);
  }
});

test('malformed, incomplete and oversized feedback retry once with unchanged original input and deadline', async () => {
  const marker = 'FAILED_CONTENT_MUST_NOT_BE_REPLAYED';
  for (const firstResponse of [
    () => completion(`{"observation":"${marker}"}`),
    () => completion({ ...feedback, observation: marker + 'x'.repeat(321) }),
    () => completion('{"broken":'),
    () => completion(feedback, 'length'),
    () => Response.json({ choices: [{ finish_reason: 'stop', message: {} }] }),
    () => Response.json(null),
    () => new Response('broken provider envelope', { status: 200 }),
  ]) {
    const calls = [];
    const result = await reviewWithDeepSeek(input, 'test-only', async (_url, options) => {
      calls.push({ body: JSON.parse(options.body), signal: options.signal });
      return calls.length === 1 ? firstResponse() : completion(feedback);
    });
    assert.deepEqual(result, feedback);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].signal, calls[1].signal);
    assert.deepEqual(calls[1].body.messages.slice(0, calls[0].body.messages.length), calls[0].body.messages);
    assert.match(calls[1].body.messages.at(-1).content, /observation and nextAction/);
    assert.match(calls[1].body.messages.at(-1).content, /320/);
    assert.equal(calls[1].body.max_tokens, calls[0].body.max_tokens);
    assert.equal(JSON.stringify(calls[1].body.messages).includes(marker), false);
  }
});

test('a second invalid reply stops with an identifiable safe error category', async () => {
  for (const [makeResponse, name] of [
    [() => completion({ observation: 'Only one field' }), 'ReviewContentInvalid'],
    [() => completion('{"broken":'), 'ReviewInvalidJson'],
    [() => completion(feedback, 'length'), 'ReviewOutputLimit'],
    [() => Response.json({ choices: [] }), 'ReviewIncompleteOutput'],
    [() => new Response('not JSON', { status: 200 }), 'ReviewProviderInvalidJson'],
  ]) {
    let calls = 0;
    await assert.rejects(reviewWithDeepSeek(input, 'test-only', async () => {
      calls++;
      return makeResponse();
    }), { name });
    assert.equal(calls, 2);
  }
});

test('provider authentication, rate limits, content filters and cancellation are never retried', async () => {
  for (const status of [401, 429, 503]) {
    let calls = 0;
    await assert.rejects(reviewWithDeepSeek(input, 'test-only', async () => {
      calls++;
      return Response.json({ error: 'Unavailable' }, { status });
    }), error => error.name === 'ReviewProviderRequest' && error.providerStatus === status);
    assert.equal(calls, 1);
  }
  let filtered = 0;
  await assert.rejects(reviewWithDeepSeek(input, 'test-only', async () => {
    filtered++;
    return completion(feedback, 'content_filter');
  }), { name: 'ReviewContentFiltered' });
  assert.equal(filtered, 1);
  for (const name of ['AbortError', 'TimeoutError']) {
    let calls = 0;
    await assert.rejects(reviewWithDeepSeek(input, 'test-only', async () => {
      calls++;
      throw new DOMException('Request cancelled', name);
    }), { name });
    assert.equal(calls, 1);
  }
});

test('expiry after an invalid response does not start a fresh deadline or second request', context => {
  const controller = new AbortController();
  let deadlines = 0, calls = 0;
  context.mock.method(AbortSignal, 'timeout', duration => {
    deadlines++;
    assert.equal(duration, 25000);
    return controller.signal;
  });
  return assert.rejects(reviewWithDeepSeek(input, 'test-only', async () => {
    calls++;
    controller.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
    return completion({ observation: 'Incomplete' });
  }), { name: 'TimeoutError' }).then(() => {
    assert.equal(deadlines, 1);
    assert.equal(calls, 1);
  });
});

test('retry diagnostics contain categories without learner or provider content', async context => {
  const entries = [];
  context.mock.method(console, 'warn', (...args) => entries.push(args));
  let calls = 0;
  await reviewWithDeepSeek(input, 'test-only', async () => ++calls === 1
    ? completion({ observation: 'FAILED_PROVIDER_CONTENT' }) : completion(feedback));
  assert.equal(entries.length, 1);
  assert.equal(entries[0][1].reason, 'ReviewContentInvalid');
  const log = JSON.stringify(entries);
  assert.equal(log.includes('PRIVATE_LEARNER_INPUT'), false);
  assert.equal(log.includes('FAILED_PROVIDER_CONTENT'), false);
});
