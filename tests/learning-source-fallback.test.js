import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';

const pythonGuide = 'https://docs.python.org/3/tutorial/controlflow.html';
const openedText = 'A for loop visits each item in a sequence. For the names Ada and Lin, print each name on its own line. This fetched example uses two names and produces two lines.';
const input = { goal: 'Python loops for beginners', minutes: 5, language: 'en' };

function response(value) {
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
}

function lesson() {
  return {
    formatVersion: 3, title: 'A loop over names', outcome: 'Print each name from a list.',
    guided: [{
      title: 'Visit every name', sourceId: 0, imageIds: [],
      instruction: 'A for loop repeats its body for every name in a list.',
      task: 'Write a loop that prints Ada and Lin.', criterion: 'The result contains two lines, Ada followed by Lin.',
      practice: { type: 'code', language: 'python', starter: "names = ['Ada', 'Lin']\n" },
      teaching: {
        why: 'Loops save repetition when processing several names.',
        example: { input: "for name in ['Ada', 'Lin']:\n    print(name)", output: 'Ada\nLin', explanation: 'The loop visits both names.' },
        assessment: { type: 'choice', question: 'How many lines are printed?', options: ['Two', 'One', 'Three'], answer: 0, explanation: 'There are two names.' },
        takeaway: 'A loop runs once for each item.',
      },
    }],
    final: { title: 'Your own list', task: 'Write a loop that prints the names Sam, Jo and Lee.', criterion: 'Show three separate output lines in list order.', practice: { type: 'code', language: 'python' } },
  };
}

function provider({ search = 'failure', verifySearch = () => {}, verifyLesson = () => {} } = {}) {
  const state = { searchCalls: 0, lessonCalls: 0 };
  return {
    state,
    fetcher: async (url, options) => {
      const request = JSON.parse(options.body);
      if (url.endsWith('/v1/tools/search')) {
        state.searchCalls += 1;
        if (search === 'failure') return Response.json({ error: { message: 'Search temporarily unavailable' } }, { status: 503 });
        return Response.json({ results: search === 'readable' ? [{ url: 'https://example.org/python-loops', title: 'Python loops', content: openedText }] : [] });
      }
      assert.equal(url, 'https://api.deepseek.com/chat/completions', 'catalog sources are read through the page reader');
      const payload = JSON.parse(request.messages[1].content);
      if (!payload.materials) {
        verifySearch(payload, request.messages[0].content);
        return response({ query: 'Python loops beginner example', githubQuery: 'Python loops tutorial' });
      }
      state.lessonCalls += 1;
      verifyLesson(payload);
      return response(lesson());
    },
  };
}

test('a supported topic survives search failure using actually opened catalog material', async () => {
  const reads = [];
  const fixture = provider({ verifyLesson: payload => {
    assert.deepEqual(payload.materials.map(item => item.url), [pythonGuide]);
    assert.match(payload.materials[0].content, /This fetched example uses two names/);
  } });
  const plan = await generateDeepSeekPlan(input, 'test-only', fixture.fetcher, {
    readPage: async url => {
      reads.push(url);
      return url === pythonGuide ? { url, body: openedText, contentType: 'text/markdown' } : null;
    },
    readRenderedPage: async () => null,
  });
  assert.deepEqual(reads, [pythonGuide]);
  assert.equal(fixture.state.searchCalls, 2);
  assert.equal(fixture.state.lessonCalls, 1);
  assert.equal(plan.steps[0].resource.url, pythonGuide);
  assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), 5);
});

test('empty search results can use opened catalog material too', async () => {
  const emptySearch = provider({ search: 'empty' });
  const plan = await generateDeepSeekPlan(input, 'test-only', emptySearch.fetcher, {
    readPage: async url => ({ url, body: openedText, contentType: 'text/markdown' }),
    readRenderedPage: async () => null,
  });
  assert.equal(plan.steps[0].resource.url, pythonGuide);
  assert.equal(emptySearch.state.lessonCalls, 1);
});

test('catalog titles and URLs alone never trigger composition when all reads fail', async () => {
  for (const search of ['failure', 'empty']) {
    const reads = [];
    const fixture = provider({ search });
    await assert.rejects(generateDeepSeekPlan(input, 'test-only', fixture.fetcher, {
      readPage: async url => { reads.push(url); return null; },
      readRenderedPage: async () => null,
    }), error => search === 'failure' ? error.name === 'ProviderRequest:search' : error.name === 'NoOpenedLessonSources');
    assert.deepEqual(reads, [pythonGuide]);
    assert.equal(fixture.state.lessonCalls, 0);
  }
});

test('an unknown topic preserves search failure without trying unrelated catalog pages', async () => {
  const fixture = provider({ verifySearch: payload => assert.equal(payload.suggestedSources, undefined) });
  let reads = 0;
  await assert.rejects(generateDeepSeekPlan({ ...input, goal: 'Ceramic sculpture from clay' }, 'test-only', fixture.fetcher, {
    readPage: async () => { reads += 1; return null; },
    readRenderedPage: async () => { reads += 1; return null; },
  }), error => error.name === 'ProviderRequest:search' && error.providerStatus === 503);
  assert.equal(reads, 0);
  assert.equal(fixture.state.lessonCalls, 0);
});

test('search prompt receives bounded catalog suggestions without claiming they were retrieved', async () => {
  let checkedPrompt = false;
  const fixture = provider({ verifySearch: (payload, systemPrompt) => {
    checkedPrompt = true;
    assert.equal(payload.suggestedSources.length, 2);
    assert.ok(payload.suggestedSources.some(source => source.url.includes('generative-ai-for-beginners')));
    assert.ok(payload.suggestedSources.some(source => source.url.includes('help.openai.com')));
    for (const source of payload.suggestedSources) {
      assert.equal(typeof source.title, 'string');
      assert.equal(source.content, undefined);
    }
    assert.match(systemPrompt, /not already retrieved evidence/);
  } });
  await assert.rejects(generateDeepSeekPlan({ ...input, goal: 'Prompt engineering basics' }, 'test-only', fixture.fetcher, {
    readPage: async () => null,
    readRenderedPage: async () => null,
  }), error => error.name === 'ProviderRequest:search');
  assert.equal(checkedPrompt, true);
  assert.equal(fixture.state.lessonCalls, 0);
});

test('readable search results prevent unnecessary catalog fallback', async () => {
  const reads = [];
  const fixture = provider({ search: 'readable', verifyLesson: payload => {
    assert.deepEqual(payload.materials.map(item => item.url), ['https://example.org/python-loops']);
  } });
  const plan = await generateDeepSeekPlan(input, 'test-only', fixture.fetcher, {
    readPage: async url => { reads.push(url); return null; },
    readRenderedPage: async () => null,
  });
  assert.deepEqual(reads, ['https://example.org/python-loops']);
  assert.equal(plan.steps[0].resource.url, 'https://example.org/python-loops');
  assert.equal(fixture.state.lessonCalls, 1);
});
