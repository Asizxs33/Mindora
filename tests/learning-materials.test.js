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
