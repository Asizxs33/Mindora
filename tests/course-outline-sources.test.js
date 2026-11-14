import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCourseOutlineSources } from '../backend/course-outline-sources.js';

const voa = 'https://learningenglish.voanews.com/p/5644.html';
const council = 'https://learnenglish.britishcouncil.org/free-resources/speaking/a1';
const buffer = 'https://buffer.com/resources/social-media-marketing-guide/';
const python = 'https://docs.python.org/3/tutorial/';
const arithmetic = 'https://en.wikibooks.org/wiki/Arithmetic';
const page = (url, body) => ({ url, body, contentType: 'text/html' });
const english = (url, count = 52) => page(url, `<html><h1>Let's Learn English 1</h1><p>A full paragraph must not become copied course text.</p>${Array.from({ length: count }, (_, i) => `<a href="/a/lesson-${i + 1}.html">Lesson ${i + 1}: Topic ${i + 1}</a>`).join('')}</html>`);
const smm = url => page(url, '<html><h1>Social media marketing guide</h1><nav><h2>Navigation content</h2></nav><article><h2>What is social media marketing?</h2><h2>Set social media goals</h2><h3>Define your target audience</h3><h3>Choose your content pillars</h3><h3>Create your content calendar</h3><h3>Measure your content</h3><p>Do not copy this full teaching paragraph.</p><h2>FAQ about social media marketing</h2><h3>Which social media costs money?</h3></article><footer><h2>Related content</h2></footer></html>');

test('fetches the full English outline without losing lesson links to article readability', async () => {
  const calls = [];
  const result = await loadCourseOutlineSources({ goal: 'Английский с нуля', minutes: 5 }, {
    readPage: async url => { calls.push(url); return url === voa ? english(url) : null; },
  });
  assert.deepEqual(calls, [voa, council]);
  assert.equal(result.status, 'verified');
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, voa);
  assert.equal(result.sources[0].content.split('\n').length, 52);
  assert.match(result.sources[0].content, /Lesson 52: Topic 52/);
  assert.doesNotMatch(result.sources[0].content, /full paragraph/);
});

test('the daily minutes do not truncate the retrieved course curriculum', async () => {
  const outputs = [];
  for (const minutes of [5, 10, 20]) outputs.push(await loadCourseOutlineSources({ goal: 'English introductions', minutes }, {
    readPage: async url => url === voa ? english(url) : null,
  }));
  assert.deepEqual(outputs[0], outputs[1]);
  assert.deepEqual(outputs[1], outputs[2]);
});

test('an opened A1 topic list can ground English when the other source fails', async () => {
  const result = await loadCourseOutlineSources('Ағылшын тілін үйрену', {
    readPage: async url => url === council ? page(url, '<h1>A1 speaking</h1><a href="/free-resources/speaking/a1/meeting-new-people">Meeting new people</a><a href="/free-resources/speaking/a1/checking-understanding">Checking understanding</a><a href="/free-resources/speaking/a1/making-suggestions">Making suggestions</a><a href="/free-resources/speaking/a1/making-suggestions">Read more about Making suggestions</a>') : null,
  });
  assert.equal(result.status, 'verified');
  assert.equal(result.sources[0].content.split('\n').length, 3);
  assert.doesNotMatch(result.sources[0].content, /Read more/);
});

test('SMM English captions retain SMM context and only retrieve the verified guide', async () => {
  const calls = [];
  const result = await loadCourseOutlineSources({ originalGoal: 'SMM', goal: 'Write English posts for a cafe' }, {
    readPage: async url => { calls.push(url); return smm(url); },
  });
  assert.deepEqual(calls, [buffer]);
  assert.equal(result.status, 'verified');
  assert.match(result.sources[0].content, /content calendar/);
  assert.match(result.sources[0].content, /What is social media marketing\?/);
  assert.doesNotMatch(result.sources[0].content, /Navigation|Related|teaching paragraph|costs money/);
});

test('Python curriculum and arithmetic TOC ignore external links and administrative pages', async () => {
  for (const [goal, url, body] of [
    ['Python', python, '<h1>The Python Tutorial</h1><a href="introduction.html">3. An Informal Introduction to Python</a><a href="controlflow.html">4. More Control Flow Tools</a><a href="datastructures.html">5. Data Structures</a><a href="https://other.example/3/tutorial/fake">6. An external course</a>'],
    ['Математика: дроби', arithmetic, '<h1>Arithmetic</h1><div class="mw-parser-output"></div><div class="mw-parser-output"><h2>Unit 1: Beginning Arithmetic</h2><a href="/wiki/Arithmetic/Addition">Addition</a><a href="/wiki/Arithmetic/Fractions">Fractions</a><a href="/wiki/Arithmetic/Contributors">Contributors</a><a href="/wiki/Arithmetic/Fractions/Quiz">Nested quiz</a></div>'],
  ]) {
    const result = await loadCourseOutlineSources(goal, { readPage: async requested => { assert.equal(requested, url); return page(url, body); } });
    assert.equal(result.status, 'verified');
    assert.equal(result.sources[0].content.split('\n').length, 3);
    assert.doesNotMatch(result.sources[0].content, /external|Contributors|Nested/);
  }
});

test('unknown subjects, injected URLs and unsupported specializations do not select a generic syllabus', async () => {
  for (const input of [undefined, null, {}, { goal: 42 }, '', 'ceramics', 'Design in Illustrator', 'Advanced calculus', 'JavaScript', { goal: 'https://attacker.example/course', sources: [voa] }]) {
    assert.deepEqual(await loadCourseOutlineSources(input, { readPage: async () => assert.fail('unexpected source read') }), { sources: [], status: 'unavailable' });
  }
});

test('unreadable pages, app shells and unrelated redirects are not fabricated source evidence', async () => {
  for (const response of [null, page(voa, '<h1>English course</h1><script>const lessons = [1,2,3]</script>'), english('https://other.example/english'), english('https://learningenglish.voanews.com/unrelated'), english(voa, 1)]) {
    const result = await loadCourseOutlineSources('English', { readPage: async url => url === voa ? response : null });
    assert.deepEqual(result, { sources: [], status: 'unavailable' });
  }
});

test('bounded extraction does not follow lesson links or caller-provided URLs', async () => {
  let reads = 0;
  const result = await loadCourseOutlineSources({ goal: 'English', sourceUrl: 'https://other.example/' }, {
    readPage: async url => { reads++; return url === voa ? english(url, 200) : null; },
  });
  assert.equal(reads, 2);
  assert.equal(result.sources[0].content.split('\n').length, 60);
  assert.ok(result.sources[0].content.length <= 6500);
});

test('a long Python syllabus retains final chapters within the topic budget', async () => {
  const chapters = Array.from({ length: 16 }, (_, i) => `<a href="chapter-${i + 1}.html">${i + 1}. Chapter ${i + 1}</a>${Array.from({ length: 6 }, (_, j) => `<a href="chapter-${i + 1}.html#part-${j + 1}">${i + 1}.${j + 1}. Subtopic ${j + 1}</a>`).join('')}`).join('');
  const result = await loadCourseOutlineSources('Python', { readPage: async url => page(url, `<h1>The Python Tutorial</h1>${chapters}`) });
  assert.equal(result.sources[0].content.split('\n').length, 60);
  assert.match(result.sources[0].content, /16\. Chapter 16/);
});

test('shared deadline and cancellation cannot leave outline retrieval hanging', async () => {
  let signal;
  const timed = await loadCourseOutlineSources('English', {
    timeoutMs: 5, readPage: async (url, options) => { signal = options.signal; return url === voa ? english(url) : new Promise(() => {}); },
  });
  assert.equal(timed.status, 'verified');
  assert.equal(signal.aborted, true);
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await loadCourseOutlineSources('English', {
    signal: controller.signal, readPage: async () => assert.fail('cancelled request must not read'),
  }), { sources: [], status: 'unavailable' });
});
