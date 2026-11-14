import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';

const source = 'https://docs.python.org/3/tutorial/controlflow.html';
const github = 'https://github.com/python/cpython/blob/main/Doc/tutorial/controlflow.rst';
const input = { goal: 'Learn Python loops', minutes: 5, language: 'en' };
const rejectedMarker = 'STRUCTURAL_RESPONSE_MUST_NOT_BE_REPLAYED';
const valid = {
  formatVersion: 3, title: 'Print a list', outcome: 'Write a loop that prints three names.',
  guided: [{
    title: 'One action per item', instruction: 'A for loop visits each list item. Indent print to run it for every item.',
    task: 'Write a loop over three names.', criterion: 'Print one name on each of three lines.',
    practice: { type: 'code', language: 'python' }, sourceId: 0, imageIds: [],
    teaching: {
      why: 'Repeat a useful action without copying code.',
      example: { input: 'for name in ["Ada", "Lin"]:\n    print(name)', output: 'Ada\nLin', explanation: 'Two list items produce two lines.' },
      assessment: { type: 'choice', question: 'How many lines does this example print?', options: ['Two', 'One', 'Three'], answer: 0, explanation: 'The list contains two names.' },
      takeaway: 'The loop visits each list item once.',
    },
  }],
  final: { title: 'Your own list', task: 'Write a loop that prints three favorite foods.', criterion: 'Each of three foods appears on its own line.', practice: { type: 'code', language: 'python' } },
};
const missingFinal = () => { const { final, ...rest } = structuredClone(valid); return { ...rest, title: rejectedMarker }; };
const completion = (content, finish_reason = 'stop') => Response.json({ choices: [{ finish_reason, message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] });

function fixture(outputs) {
  const requests = { query: [], search: [], fetch: [], compose: [], read: [], rendered: [], signals: [] };
  const fetcher = async (url, options) => {
    requests.signals.push(options.signal);
    const body = JSON.parse(options.body);
    if (url.endsWith('/v1/tools/search')) {
      requests.search.push(body);
      return Response.json({ results: body.query.endsWith('site:github.com')
        ? [{ url: github, title: 'CPython tutorial' }]
        : [{ url: source, title: 'Python tutorial', content: 'A for loop iterates over every item of a sequence and runs its indented body.' }] });
    }
    if (url.endsWith('/v1/tools/fetch')) {
      requests.fetch.push(body);
      assert.equal(body.url, github);
      return Response.json({ content: 'The for statement iterates over the items of a sequence and executes the loop body.' });
    }
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const data = JSON.parse(body.messages[1].content);
    if (!data.materials) {
      requests.query.push(body);
      return completion({ query: 'Python loops beginner guide', githubQuery: 'Python loop tutorial' });
    }
    requests.compose.push(body);
    const output = outputs[requests.compose.length - 1];
    assert.notEqual(output, undefined, 'composition exceeded the specified retry budget');
    return typeof output === 'function' ? output() : completion(output);
  };
  const readers = {
    readPage: async (url, { signal }) => { requests.read.push(url); requests.signals.push(signal); return null; },
    readRenderedPage: async (url, { signal }) => { requests.rendered.push(url); requests.signals.push(signal); return null; },
  };
  return { requests, generate: () => generateDeepSeekPlan(input, 'test-only', fetcher, readers) };
}

function assertResearchOnce(requests) {
  assert.equal(requests.query.length, 1);
  assert.equal(requests.search.length, 2);
  assert.equal(requests.fetch.length, 1);
  assert.equal(requests.read.length, 2);
  assert.equal(requests.rendered.length, 1);
  assert.equal(new Set(requests.signals).size, 1, 'research, reading and every composition attempt share one deadline signal');
  assert.ok(requests.signals[0] instanceof AbortSignal);
}

test('an already complete lesson needs one composition and one research pass', async () => {
  const run = fixture([valid]);
  const plan = await run.generate();
  assert.equal(plan.steps.length, 2);
  assert.equal(plan.steps[1].task, valid.final.task);
  assert.equal(run.requests.compose.length, 1);
  assertResearchOnce(run.requests);
});

test('missing final task regenerates once with the original evidence and a correction, never rejected model content', async () => {
  const run = fixture([missingFinal(), valid]);
  const plan = await run.generate();
  assert.equal(plan.steps.length, 2);
  assert.equal(plan.steps[1].task, valid.final.task);
  assert.equal(run.requests.compose.length, 2);
  assertResearchOnce(run.requests);
  const [initial, retry] = run.requests.compose;
  assert.deepEqual(retry.messages.slice(0, initial.messages.length), initial.messages);
  assert.ok(retry.messages.length > initial.messages.length);
  assert.match(retry.messages.at(-1).content, /json|lesson|guided|final|structure|schema/i);
  assert.ok(!JSON.stringify(retry.messages).includes(rejectedMarker));
  assert.deepEqual(JSON.parse(retry.messages[1].content).materials, JSON.parse(initial.messages[1].content).materials);
  assert.equal(retry.max_tokens, initial.max_tokens);
});

test('two structurally invalid lessons stop after two attempts with LessonContentInvalid', async () => {
  const run = fixture([missingFinal(), missingFinal()]);
  await assert.rejects(run.generate(), { name: 'LessonContentInvalid' });
  assert.equal(run.requests.compose.length, 2);
  assertResearchOnce(run.requests);
});

test('structural regeneration does not retry authentication or rate-limit provider failures', async () => {
  for (const status of [401, 429]) {
    const run = fixture([() => Response.json({ error: { message: 'Request unavailable' } }, { status })]);
    await assert.rejects(run.generate(), error => error.providerStatus === status);
    assert.equal(run.requests.compose.length, 1);
    assertResearchOnce(run.requests);
  }
});

test('content filtering and aborted provider requests never trigger structural regeneration', async () => {
  const filtered = fixture([() => completion(valid, 'content_filter')]);
  await assert.rejects(filtered.generate(), { name: 'IncompleteDeepSeekOutput' });
  assert.equal(filtered.requests.compose.length, 1);
  assertResearchOnce(filtered.requests);
  const aborted = fixture([() => { throw new DOMException('Aborted', 'AbortError'); }]);
  await assert.rejects(aborted.generate(), { name: 'AbortError' });
  assert.equal(aborted.requests.compose.length, 1);
  assertResearchOnce(aborted.requests);
});

test('combined JSON and structural recovery is bounded at four compositions under the original deadline', async () => {
  const malformed = '{"broken":"MALFORMED_RESPONSE_MUST_NOT_BE_REPLAYED';
  const run = fixture([malformed, missingFinal(), malformed, valid]);
  const plan = await run.generate();
  assert.equal(plan.steps[1].task, valid.final.task);
  assert.equal(run.requests.compose.length, 4);
  assertResearchOnce(run.requests);
  const initialMessages = run.requests.compose[0].messages;
  for (const retry of run.requests.compose.slice(1)) {
    assert.deepEqual(retry.messages.slice(0, initialMessages.length), initialMessages);
    assert.ok(!JSON.stringify(retry.messages).includes(rejectedMarker));
    assert.ok(!JSON.stringify(retry.messages).includes('MALFORMED_RESPONSE_MUST_NOT_BE_REPLAYED'));
  }
});
