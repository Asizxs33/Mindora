import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { normalizeLessonVisual } from '../core/lesson-visual.js';
import { renderLessonVisual } from '../ui/lesson-visual.js';

const palette = { type: 'palette', background: '#ffffff', foreground: '#000000', accent: '#bc4b00', headline: 'Calm cafe' };
const documentFor = html => parseHTML(`<html><body>${html}</body></html>`).document;

test('visual validator accepts only supported structured examples and bounded labels', () => {
  assert.deepEqual(normalizeLessonVisual({ ...palette, background: ' #FFFFFF ', extra: '<svg/>' }), palette);
  assert.deepEqual(normalizeLessonVisual({ type: 'percent', percent: 12.5, total: 80, label: ' Discount ' }), { type: 'percent', percent: 12.5, total: 80, label: 'Discount' });
  assert.deepEqual(normalizeLessonVisual({ type: 'percent', percent: -0 }), { type: 'percent', percent: 0 });
  for (const raw of [null, {}, { type: 'svg', html: '<svg/>' }, { ...palette, headline: '' }, { ...palette, headline: 'a'.repeat(101) }, { ...palette, foreground: 'red' }, { ...palette, accent: '#fff" onload="alert(1)' }]) {
    assert.equal(normalizeLessonVisual(raw), null);
    assert.equal(renderLessonVisual(raw), '');
  }
});

test('percent visual rejects invalid ranges, nonfinite amounts and coerced strings', () => {
  for (const percent of [-.1, 100.1, NaN, Infinity, '25', null, undefined]) assert.equal(normalizeLessonVisual({ type: 'percent', percent }), null);
  for (const total of [0, -1, NaN, Infinity, '80', null]) assert.equal(normalizeLessonVisual({ type: 'percent', percent: 25, total }), null);
  for (const label of ['', 'a'.repeat(121), 4]) assert.equal(normalizeLessonVisual({ type: 'percent', percent: 25, label }), null);
  assert.ok(normalizeLessonVisual({ type: 'percent', percent: 0 }));
  assert.ok(normalizeLessonVisual({ type: 'percent', percent: 100, total: Number.MAX_VALUE }));
});

test('the 100-square diagram and computed amount match each percentage including fractions and endpoints', () => {
  for (const [percent, total, filled, amount] of [[0, 80, 0, 0], [25, 80, 25, 20], [12.5, 80, 13, 10], [100, 80, 100, 80]]) {
    const doc = documentFor(renderLessonVisual({ type: 'percent', percent, total }, 'en'));
    assert.equal(doc.querySelectorAll('[data-percent-cell]').length, 100);
    assert.equal(doc.querySelectorAll('[data-percent-fill]').length, filled);
    assert.equal(doc.querySelector('[data-percent-amount]').getAttribute('data-percent-amount'), String(amount));
    assert.equal(doc.querySelector('[data-percent-amount]').textContent, String(amount));
    assert.ok(doc.querySelector('[role="img"]').getAttribute('aria-label').includes(`${percent}%`));
    assert.equal(doc.querySelector('svg').getAttribute('aria-hidden'), 'true');
    if (percent === 12.5) assert.equal([...doc.querySelectorAll('[data-percent-fill]')].at(-1).getAttribute('width'), '8');
  }
  const withoutTotal = documentFor(renderLessonVisual({ type: 'percent', percent: 25 }, 'en'));
  assert.equal(withoutTotal.querySelector('[data-percent-amount]'), null);
  const huge = documentFor(renderLessonVisual({ type: 'percent', percent: 50, total: Number.MAX_VALUE }, 'en'));
  assert.ok(Number.isFinite(Number(huge.querySelector('[data-percent-amount]').getAttribute('data-percent-amount'))));
});

test('palette example derives real contrast, distinguishes low contrast, and never trusts result fields', () => {
  const doc = documentFor(renderLessonVisual({ ...palette, contrast: 1 }, 'en'));
  assert.equal(doc.querySelector('[data-palette-contrast]').getAttribute('data-palette-contrast'), '21');
  assert.match(doc.querySelector('[data-palette-preview]').getAttribute('style'), /background:#ffffff;color:#000000/);
  assert.equal(doc.querySelector('.is-low'), null);
  const low = documentFor(renderLessonVisual({ ...palette, foreground: '#ffffff' }, 'en'));
  assert.ok(low.querySelector('.is-low'));
  assert.match(low.querySelector('.is-low').textContent, /increase text contrast/);
  const borderline = documentFor(renderLessonVisual({ ...palette, foreground: '#5a799f' }, 'en'));
  assert.ok(borderline.querySelector('.is-low')); // 4.496:1 must not round up to a pass.
  assert.match(borderline.querySelector('[data-palette-contrast]').textContent, /4.496:1/);
  const math = documentFor(renderLessonVisual({ type: 'percent', percent: 25, total: 80, amount: 999 }, 'en'));
  assert.equal(math.querySelector('[data-percent-amount]').textContent, '20');
});

test('visual labels cannot inject HTML, attributes or SVG nodes', () => {
  const dangerous = '"><script>alert(1)</script><img src=x onerror=alert(1)>';
  for (const raw of [{ ...palette, headline: dangerous }, { type: 'percent', percent: 25, total: 80, label: dangerous }]) {
    const html = renderLessonVisual(raw, 'ru');
    const doc = documentFor(html);
    assert.equal(doc.querySelector('script, img, [onerror], [onload]'), null);
    assert.match(html, /&lt;script&gt;/);
    assert.ok(doc.querySelector('[role="img"]').getAttribute('aria-label').includes(dangerous));
  }
});

test('visual captions and accessible descriptions are localized in all three languages', () => {
  for (const [language, caption, contrast, square] of [
    ['en', 'Visual example', 'Text contrast', 'Each square'],
    ['ru', 'Наглядный пример', 'Контраст текста', 'Каждый квадрат'],
    ['kk', 'Көрнекі мысал', 'Мәтін контрасты', 'Әр шаршы'],
  ]) {
    const colors = documentFor(renderLessonVisual(palette, language));
    assert.equal(colors.querySelector('figure').getAttribute('lang'), language);
    assert.ok(colors.querySelector('figcaption').textContent.includes(caption));
    assert.ok(colors.querySelector('[role="img"]').getAttribute('aria-label').includes(contrast));
    const percent = documentFor(renderLessonVisual({ type: 'percent', percent: 25, total: 80 }, language));
    assert.ok(percent.querySelector('[role="img"]').getAttribute('aria-label').includes(square));
  }
  assert.equal(documentFor(renderLessonVisual(palette, 'unknown')).querySelector('figure').getAttribute('lang'), 'en');
});
