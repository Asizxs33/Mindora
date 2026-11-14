import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { normalizeLessonVisual } from '../core/lesson-visual.js';
import { renderLessonVisual } from '../ui/lesson-visual.js';

const dialogue = {
  type: 'dialogue', label: 'Meet a new colleague',
  turns: [{ speaker: 'Alex', text: "Hi, I'm Alex.", translation: 'Привет, я Алекс.' }, { speaker: 'Sam', text: 'Nice to meet you, Alex.' }],
};
const post = {
  type: 'social-post', audience: 'People working near a local cafe', hook: 'A quiet table for your next idea.',
  body: 'Bring your notebook and take a break with fresh coffee.\nOur reading corner is open today.',
  cta: 'Tell us which book you are reading.',
};
const docFor = raw => parseHTML(`<html><body>${raw}</body></html>`).document;

test('dialogue normalization preserves two to four bounded turns and optional translations without mutating input', () => {
  assert.deepEqual(normalizeLessonVisual(dialogue), dialogue);
  const raw = { ...dialogue, label: ' Meet a colleague ', turns: [{ speaker: ' Alex ', text: ' Hello! ', extra: 'ignored' }, { speaker: 'Sam', text: 'Hi!' }] };
  const snapshot = structuredClone(raw);
  const result = normalizeLessonVisual(raw);
  assert.deepEqual(result.turns[0], { speaker: 'Alex', text: 'Hello!' });
  assert.equal(result.label, 'Meet a colleague');
  assert.equal(result.turns[1].translation, undefined);
  assert.deepEqual(raw, snapshot);
  assert.ok(normalizeLessonVisual({ ...dialogue, turns: [...dialogue.turns, ...dialogue.turns] }));
  for (const turns of [[], [dialogue.turns[0]], Array(5).fill(dialogue.turns[0]), null, 'a conversation', [null, dialogue.turns[0]]]) {
    assert.equal(normalizeLessonVisual({ ...dialogue, turns }), null);
  }
  for (const [field, max] of [['speaker', 40], ['text', 180], ['translation', 180]]) {
    for (const value of ['', ' ', 3, 'x'.repeat(max + 1)]) {
      assert.equal(normalizeLessonVisual({ ...dialogue, turns: [{ ...dialogue.turns[0], [field]: value }, dialogue.turns[1]] }), null, field);
    }
    assert.ok(normalizeLessonVisual({ ...dialogue, turns: [{ ...dialogue.turns[0], [field]: 'x'.repeat(max) }, dialogue.turns[1]] }));
  }
  for (const label of ['', 'x'.repeat(121), undefined]) assert.equal(normalizeLessonVisual({ ...dialogue, label }), null);
});

test('social post requires bounded audience, hook, body and call to action', () => {
  assert.deepEqual(normalizeLessonVisual({ ...post, imageUrl: 'https://example.org/fake.png', likes: 900 }), post);
  for (const [field, max] of [['audience', 80], ['hook', 160], ['body', 400], ['cta', 120]]) {
    for (const value of ['', null, undefined, 'x'.repeat(max + 1)]) assert.equal(normalizeLessonVisual({ ...post, [field]: value }), null, field);
    assert.ok(normalizeLessonVisual({ ...post, [field]: 'x'.repeat(max) }));
  }
});

test('dialogue renders actual English turns with separate optional translations and accessible grouping', () => {
  const doc = docFor(renderLessonVisual(dialogue, 'ru'));
  const figure = doc.querySelector('[data-lesson-visual="dialogue"]');
  assert.equal(figure.getAttribute('role'), 'group');
  assert.ok(figure.getAttribute('aria-label').includes(dialogue.label));
  assert.equal(doc.querySelectorAll('[data-dialogue-turn]').length, 2);
  const phrases = [...doc.querySelectorAll('[data-dialogue-text]')];
  assert.deepEqual(phrases.map(node => node.textContent), dialogue.turns.map(turn => turn.text));
  assert.ok(phrases.every(node => node.getAttribute('lang') === 'en'));
  assert.equal(doc.querySelectorAll('[data-dialogue-translation]').length, 1);
  assert.equal(doc.querySelector('[data-dialogue-translation]').getAttribute('lang'), 'ru');
  assert.ok(doc.querySelector('[data-dialogue-translation]').textContent.includes(dialogue.turns[0].translation));
  assert.equal(doc.querySelector('button, audio, iframe, img'), null);
  const noTranslations = { ...dialogue, turns: dialogue.turns.map(({ speaker, text }) => ({ speaker, text })) };
  assert.equal(docFor(renderLessonVisual(noTranslations, 'en')).querySelector('[data-dialogue-translation]'), null);
});

test('social preview displays the original writing and annotations without pretend publishing or metrics', () => {
  const doc = docFor(renderLessonVisual(post, 'en'));
  const figure = doc.querySelector('[data-lesson-visual="social-post"]');
  assert.equal(figure.getAttribute('role'), 'group');
  assert.equal(doc.querySelector('[data-post-hook]').textContent, post.hook);
  assert.equal(doc.querySelector('[data-post-body]').textContent, post.body);
  assert.equal(doc.querySelector('[data-post-cta]').textContent, post.cta);
  assert.equal(doc.querySelectorAll('.instructional-post-annotation').length, 3);
  assert.ok(doc.body.textContent.includes('Example publication'));
  assert.ok(doc.body.textContent.includes(post.audience));
  assert.equal(doc.querySelector('button, input, form, a, img, iframe, [data-likes], [data-publish]'), null);
  assert.doesNotMatch(doc.body.textContent, /\d+\s+(?:likes|views|followers)/i);
});

test('all generated dialogue and post fields stay inert plain text', () => {
  const attack = '"><img src=x onerror=alert(1)>';
  const rawDialogue = { type: 'dialogue', label: attack, turns: [{ speaker: attack, text: attack, translation: attack }, { speaker: 'Sam', text: 'Hello.' }] };
  const rawPost = { type: 'social-post', audience: attack, hook: attack, body: attack, cta: attack };
  for (const raw of [rawDialogue, rawPost]) {
    const html = renderLessonVisual(raw, 'kk');
    const doc = docFor(html);
    assert.ok(html.includes('&lt;img'));
    assert.equal(doc.querySelector('img, script, [onerror], [onload], foreignObject'), null);
    assert.ok(doc.body.textContent.includes(attack));
  }
  assert.equal(renderLessonVisual({ ...post, body: 'x'.repeat(401) }), '');
});

test('English, Russian and Kazakh captions label the same original examples', () => {
  for (const [language, exchange, example, audience] of [
    ['en', 'Follow the exchange', 'Example publication', 'Who it is for'],
    ['ru', 'Проследи за разговором', 'Пример публикации', 'Для кого'],
    ['kk', 'Әңгімені бақыла', 'Жарияланым үлгісі', 'Кімге арналған'],
  ]) {
    const speech = docFor(renderLessonVisual(dialogue, language));
    assert.ok(speech.body.textContent.includes(exchange));
    assert.equal(speech.querySelector('figure').getAttribute('lang'), language);
    assert.equal(speech.querySelector('[data-dialogue-text]').getAttribute('lang'), 'en');
    assert.equal(speech.querySelector('[data-dialogue-translation]').getAttribute('lang'), language);
    const social = docFor(renderLessonVisual(post, language));
    assert.ok(social.body.textContent.includes(example));
    assert.ok(social.body.textContent.includes(audience));
    assert.equal(social.querySelector('[data-post-body]').textContent, post.body);
  }
});
