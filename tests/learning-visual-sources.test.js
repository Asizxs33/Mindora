import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichLearningVisualSources } from '../backend/learning-visual-sources.js';

const percent = 'https://en.wikibooks.org/wiki/Primary_Mathematics/Percentages';
const hsl = 'https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Color_values';
const existing = () => [{ url: 'https://example.org/percent-lesson', title: 'Percent lesson', content: 'An opened lesson explains how to calculate percentages.', images: [] }];
const article = (url, body) => ({ url, body, contentType: 'text/markdown' });
const illustrated = url => article(url, '# Percentages\nA percent expresses a share of one hundred equal units. The diagram shades 25 of 100 cells.\n\n![25 shaded cells out of 100](https://example.org/grid.png)');

test('an opened illustrated fallback remains a separate cited source, without mutating existing evidence', async () => {
  const materials = existing();
  const calls = [];
  const result = await enrichLearningVisualSources(materials, 'Percentages and discounts', {
    readPage: async url => { calls.push(url); return illustrated(url); },
  });
  assert.deepEqual(calls, [percent]);
  assert.equal(result.length, 2);
  assert.equal(result[0], materials[0]);
  assert.deepEqual(materials[0].images, []);
  assert.equal(result[1].url, percent);
  assert.equal(result[1].imageSourceUrl, percent);
  assert.match(result[1].content, /one hundred equal units/);
  assert.deepEqual(result[1].images, [{ url: 'https://example.org/grid.png', alt: '25 shaded cells out of 100' }]);
});

test('existing images, unknown topics and already-read catalog sources avoid extra network work', async () => {
  const neverRead = async () => assert.fail('unexpected extra read');
  for (const [materials, topic] of [
    [[{ ...existing()[0], images: [{ url: 'https://example.org/chart.png', alt: 'A chart' }] }], 'percentages'],
    [existing(), 'Ceramic sculpture'],
    [[{ ...existing()[0], url: percent }], 'percentages'],
    [existing(), 'Python loops'],
  ]) {
    assert.equal(await enrichLearningVisualSources(materials, topic, { readPage: neverRead, readRenderedPage: neverRead }), materials);
  }
});

test('no source content or no actual images leaves the original research intact', async () => {
  for (const page of [null, article(percent, '![An image only](https://example.org/grid.png)'), article(percent, 'This fetched text explains percentages but supplies no illustration.')]) {
    const materials = existing();
    assert.equal(await enrichLearningVisualSources(materials, 'percentages', { readPage: async () => page }), materials);
  }
});

test('only one page is fetched even if it links to more lessons, and the material count stays bounded', async () => {
  const materials = Array.from({ length: 8 }, (_, i) => ({ ...existing()[0], url: `https://example.org/lesson-${i}` }));
  const calls = [];
  const result = await enrichLearningVisualSources(materials, 'percentages', {
    readPage: async url => {
      calls.push(url);
      return article(url, `${illustrated(url).body}\n\n[Another lesson](./Lesson_two)`);
    },
  });
  assert.deepEqual(calls, [percent]);
  assert.equal(result.length, 8);
  assert.equal(result.at(-1).url, percent);
});

test('a rendered reader can supply evidence for the same page but never for another source', async () => {
  const calls = [];
  const result = await enrichLearningVisualSources(existing(), 'percentages', {
    readPage: async () => null,
    readRenderedPage: async url => { calls.push(url); return illustrated(url); },
  });
  assert.deepEqual(calls, [percent]);
  assert.equal(result.at(-1).url, percent);
  assert.equal(result.at(-1).imageSourceUrl, percent);
  const materials = existing();
  assert.equal(await enrichLearningVisualSources(materials, 'percentages', {
    readPage: async () => illustrated('https://en.wikibooks.org/wiki/Unrelated_lesson'),
    readRenderedPage: async () => illustrated('https://example.org/unrelated-lesson'),
  }), materials);
});

test('HSL uses the color-model source without treating every palette goal as HSL', async () => {
  const calls = [];
  const readPage = async url => { calls.push(url); return illustrated(url); };
  await enrichLearningVisualSources(existing(), 'HSL hue and saturation', { readPage });
  await enrichLearningVisualSources(existing(), 'Choose a color palette for a poster', { readPage });
  assert.equal(calls[0], hsl);
  assert.match(calls[1], /adobe\.com.*secondary-colors/);
});

test('deadline and caller cancellation preserve existing materials', async () => {
  const materials = existing();
  const controller = new AbortController();
  controller.abort();
  assert.equal(await enrichLearningVisualSources(materials, 'percentages', {
    signal: controller.signal, readPage: async () => assert.fail('aborted request must not read'),
  }), materials);
  let readSignal;
  const result = await enrichLearningVisualSources(materials, 'percentages', {
    timeoutMs: 5,
    readPage: async (url, { signal }) => { readSignal = signal; return new Promise(() => {}); },
  });
  assert.equal(result, materials);
  assert.equal(readSignal.aborted, true);
});

test('SMM calendar illustration is fetched only for a calendar lesson', async () => {
  const url = 'https://buffer.com/resources/social-media-calendar/';
  const calls = [];
  const result = await enrichLearningVisualSources(existing(), 'SMM: контент-план для кофейни', {
    readPage: async source => {
      calls.push(source);
      return article(source, '# Content calendar\nA social media content calendar organizes upcoming posts by date and channel.\n\n![Scheduled posts in a weekly calendar](https://example.org/calendar.png)');
    },
  });
  assert.deepEqual(calls, [url]);
  assert.equal(result.at(-1).imageSourceUrl, url);
  assert.equal(result.at(-1).images[0].alt, 'Scheduled posts in a weekly calendar');
  for (const topic of ['SMM: пост про скидку 20%', 'English: introduce yourself and favorite colors', 'SMM analytics']) {
    const materials = existing();
    assert.equal(await enrichLearningVisualSources(materials, topic, {
      readPage: async () => assert.fail('unrelated illustration must not be fetched'),
    }), materials);
  }
});
