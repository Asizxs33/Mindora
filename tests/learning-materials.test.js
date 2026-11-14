import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLearningMaterial, enrichLearningMaterials } from '../backend/learning-materials.js';

const url = 'https://docs.python.org/3/tutorial/example.html';
const explanation = 'Select the cells with your monthly expenses, enter a SUM formula, then check the result against the original amounts. ';
const html = `<html><head><title>Learn a useful calculation</title></head><body>
  <nav><a href="/subscribe">UNRELATED NAVIGATION</a></nav>
  <article><h1>Learn a useful calculation</h1><p>${explanation.repeat(4)}</p>
    <pre><code>=SUM(B2:B4)</code></pre>
    <figure><img src="./images/sum.png" alt="The formula bar with SUM" width="640" height="360"><figcaption>A worked example</figcaption></figure>
    <img src="/logo.png" alt="Site logo"><img src="/track.png" width="1" height="1">
    <img src="javascript:alert(1)" alt="Unsafe"><img src="http://localhost/secret" alt="Private">
    <script>UNTRUSTED_SCRIPT()</script><form>ENTER PASSWORD</form>
  </article><footer>UNRELATED FOOTER</footer></body></html>`;

test('rendered fallback recovers real images for at most two public sources', async () => {
  let calls = 0;
  const result = await enrichLearningMaterials(Array.from({ length: 4 }, (_, id) => ({
    url: `https://docs.python.org/lesson-${id}`, title: 'Lesson', content: explanation,
  })), {
    readPage: async () => null,
    readRenderedPage: async url => {
      calls++;
      return { url, contentType: 'text/markdown', body: `${explanation}\n\n![Example screenshot](https://docs.python.org/screenshots/example.png)` };
    },
  });
  assert.equal(calls, 2);
  assert.equal(result[0].images[0].url, 'https://docs.python.org/screenshots/example.png');
  assert.equal(result[0].imageSourceUrl, result[0].url);
  assert.deepEqual(result[2].images, []);
  const fallback = await enrichLearningMaterials([{url, title:'Lesson', content:explanation}], {
    readPage: async () => null, readRenderedPage: async () => { throw new Error('Quota'); },
  });
  assert.match(fallback[0].content, /monthly expenses/);
});

test('Readability preserves lesson/code content and resolves only useful article images', () => {
  const result = extractLearningMaterial(html, url, 'text/html');
  assert.ok(result);
  assert.match(result.content, /monthly expenses/);
  assert.match(result.content, /=SUM\(B2:B4\)/);
  assert.doesNotMatch(result.content, /UNRELATED|UNTRUSTED_SCRIPT|ENTER PASSWORD/);
  assert.deepEqual(result.images, [{ url: 'https://docs.python.org/3/tutorial/images/sum.png', alt: 'The formula bar with SUM' }]);
});

test('Marked reads reference-style GitHub images and ignores image syntax inside code blocks', () => {
  const markdown = `# Lesson\n\n${explanation}\n\n![A formula example][sample]\n\n[sample]: ./assets/example.png\n\n\x60\x60\x60\n![Not an image](https://evil.org/fake.png)\n\x60\x60\x60\n`;
  const result = extractLearningMaterial(markdown, 'https://github.com/team/course/blob/main/lesson/README.md');
  assert.ok(result);
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0].url, 'https://raw.githubusercontent.com/team/course/main/lesson/assets/example.png');
});

test('reader handles broken markup but rejects app shells and access challenges', () => {
  assert.ok(extractLearningMaterial(`<article><p>${explanation.repeat(4)}`, url, 'text/html'));
  assert.equal(extractLearningMaterial('<html><div id="app"></div><script>render()</script></html>', url, 'text/html'), null);
  assert.equal(extractLearningMaterial('<html><title>Just a moment</title><main><p>Verify you are human before accessing this page.</p></main></html>', url, 'text/html'), null);
  assert.equal(extractLearningMaterial('x'.repeat(1_500_001), url), null);
});

test('enrichment has a bounded page budget and preserves provider text after failures', async () => {
  let calls = 0;
  const materials = Array.from({ length: 9 }, (_, id) => ({ url: `https://docs.python.org/lesson-${id}`, title: 'Lesson', content: explanation }));
  const result = await enrichLearningMaterials(materials, { readPage: async () => { calls++; throw new Error('Unavailable'); } });
  assert.equal(calls, 4);
  assert.equal(result.length, 8);
  assert.match(result[0].content, /monthly expenses/);
  assert.deepEqual(result[0].images, []);
});

test('a page read can recover missing provider text and keeps the final image provenance', async () => {
  const result = await enrichLearningMaterials([{ url, title: 'Search result', content: '' }], {
    readPage: async () => ({ url: 'https://docs.python.org/final/lesson.html', body: html, contentType: 'text/html' }),
  });
  assert.match(result[0].content, /monthly expenses/);
  assert.equal(result[0].imageSourceUrl, 'https://docs.python.org/final/lesson.html');
  assert.equal(result[0].images[0].url, 'https://docs.python.org/final/images/sum.png');
});

test('code indentation survives HTML and Markdown extraction', () => {
  const code = 'for item in items:\n    if item:\n        print(item)';
  const markup = `<html><body><article><p>${explanation}</p><pre><code>${code}</code></pre></article></body></html>`;
  assert.ok(extractLearningMaterial(markup, url, 'text/html').content.includes(code));
  assert.ok(extractLearningMaterial(`${explanation}\n\n\x60\x60\x60python\n${code}\n\x60\x60\x60`, url).content.includes(code));
});

test('repository-root and tree Markdown never guess a relative image base', () => {
  for (const source of ['https://github.com/team/course', 'https://github.com/team/course/tree/main/lesson']) {
    const result = extractLearningMaterial(`${explanation}\n\n![Unknown path](./assets/example.png)\n\n![Known path](https://raw.githubusercontent.com/team/course/main/assets/example.png)`, source);
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0].alt, 'Known path');
  }
});

test('blocked provider text is not revived by the optional-reader fallback', async () => {
  const [result] = await enrichLearningMaterials([{ url, title: 'Protected guide', content: 'Access denied. Verify you are human before accessing this page.' }], { readPage: async () => null });
  assert.equal(result.content, '');
});

test('lesson links stay within a site or GitHub repository and resolve file-relative Markdown', () => {
  const markdown = `# Artificial intelligence course\n\n${explanation}\n\n` + [
    '[Introduction](./lessons/intro.md)',
    '[Python functions](./functions.md)',
    '[Another lesson](/team/course/blob/main/lessons/other.md)',
    '[External lesson](https://other.org/lesson)',
    '[Other repository](https://github.com/team/other/blob/main/lesson.md)',
    '[License](./LICENSE.md)',
    '[Lesson image](./assets/lesson.png)',
    '[Unclear directory](https://github.com/team/course/tree/main/lessons)',
    '[Current section](#lesson)',
  ].join('\n\n');
  const result = extractLearningMaterial(markdown, 'https://github.com/team/course/blob/main/README.md');
  assert.deepEqual(new Set(result.links.map(link => link.url)), new Set([
    'https://raw.githubusercontent.com/team/course/main/lessons/intro.md',
    'https://raw.githubusercontent.com/team/course/main/functions.md',
    'https://github.com/team/course/blob/main/lessons/other.md',
  ]));
  for (const base of ['https://github.com/team/course', 'https://github.com/team/course/tree/main']) {
    assert.deepEqual(extractLearningMaterial(markdown, base).links.map(link => link.url), ['https://github.com/team/course/blob/main/lessons/other.md']);
  }
  const htmlLinks = `<article><p>${explanation.repeat(4)}</p><a href="./lesson.html">A useful lesson</a><a href="https://other.org/lesson">External lesson</a></article>`;
  assert.deepEqual(extractLearningMaterial(htmlLinks, url, 'text/html').links, [{ url: 'https://docs.python.org/3/tutorial/lesson.html', title: 'A useful lesson' }]);
});

test('Markdown uses a real heading after badges and caps extracted lesson links', () => {
  const markdown = `[![Badge](https://shields.io/badge.svg)](https://example.com)\n\n# A useful lesson title\n\n${explanation}\n\n`
    + Array.from({ length: 12 }, (_, id) => `[Lesson ${id}](./lessons/${id}.md)`).join('\n\n');
  const result = extractLearningMaterial(markdown, 'https://raw.githubusercontent.com/team/course/main/README.md');
  assert.equal(result.title, 'A useful lesson title');
  assert.equal(result.links.length, 8);
});

test('links beyond the content excerpt remain available and actual lessons precede setup', () => {
  const markdown = `# AI course\n\n[Course setup](./lessons/setup.md)\n\n${explanation.repeat(70)}\n\n[Introduction to AI](./lessons/intro.md)`;
  const result = extractLearningMaterial(markdown, 'https://raw.githubusercontent.com/team/course/main/README.md');
  assert.equal(result.content.length, 6500);
  assert.equal(result.links[0].title, 'Introduction to AI');
  assert.equal(result.links.length, 2);
});

test('enrichment reads only two ranked child lessons, dedupes and preserves child provenance', async () => {
  const root = 'https://github.com/team/course/blob/main/README.md';
  const overview = `# Course overview\n\n${explanation}\n\n[Python lesson](./lessons/python.md)\n\n[Vision lesson](./lessons/vision.md)\n\n[Neural networks lesson](./lessons/neural.md)\n\n[Python duplicate](https://github.com/team/course/blob/main/lessons/python.md)`;
  const materials = [{ url: root, title: 'Course', content: overview }, ...Array.from({ length: 7 }, (_, id) => ({ url: `https://docs.python.org/guide-${id}`, title: 'Guide', content: explanation }))];
  const calls = [];
  const controller = new AbortController();
  const result = await enrichLearningMaterials(materials, { query: 'neural networks vision', signal: controller.signal, readPage: async (target, { signal }) => {
    calls.push(target);
    assert.equal(signal, controller.signal);
    if (!target.includes('/lessons/')) return null;
    return { url: target, contentType: 'text/plain', body: `# ${target.includes('neural') ? 'Neural networks explained' : 'Vision explained'}\n\n${explanation}\n\n![Worked lesson](./example.png)` };
  } });
  assert.equal(calls.length, 6);
  assert.deepEqual(new Set(calls.slice(4)), new Set(['https://raw.githubusercontent.com/team/course/main/lessons/neural.md', 'https://raw.githubusercontent.com/team/course/main/lessons/vision.md']));
  assert.equal(result.length, 8);
  assert.equal(result[0].title, 'Neural networks explained');
  assert.equal(result[0].imageSourceUrl, result[0].url);
  assert.equal(result[0].images[0].url, 'https://raw.githubusercontent.com/team/course/main/lessons/example.png');
  assert.equal(result[1].title, 'Vision explained');
});

test('failed child reads preserve the overview and never follow external redirects', async () => {
  const source = 'https://raw.githubusercontent.com/team/course/main/README.md';
  const content = `# Course\n\n${explanation}\n\n[Lesson one](./lessons/one.md)\n\n[Lesson two](./lessons/two.md)`;
  const result = await enrichLearningMaterials([{ url: source, title: 'Course', content }], { readPage: async target => {
    if (target.endsWith('README.md')) return null;
    if (target.endsWith('one.md')) throw new Error('Unavailable');
    return { url: 'https://other.org/lesson', body: `# External course\n\n${explanation}`, contentType: 'text/markdown' };
  } });
  assert.equal(result.length, 1);
  assert.equal(result[0].url, source);
  assert.match(result[0].content, /monthly expenses/);
});

test('already retrieved child URLs and an aborted parent do not trigger child requests', async () => {
  const root = 'https://github.com/team/course/blob/main/README.md';
  const content = `# Course\n\n${explanation}\n\n[Existing lesson](./lessons/one.md)`;
  let calls = 0;
  const result = await enrichLearningMaterials([{ url: root, title: 'Course', content }, { url: 'https://github.com/team/course/blob/main/lessons/one.md', title: 'Lesson', content: explanation }], { readPage: async () => { calls++; return null; } });
  assert.equal(calls, 2);
  assert.equal(result.length, 2);
  const controller = new AbortController();
  controller.abort();
  calls = 0;
  await enrichLearningMaterials([{ url: root, title: 'Course', content }], { signal: controller.signal, readPage: async () => { calls++; return null; } });
  assert.equal(calls, 1);
});
