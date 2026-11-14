import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceSuggestions } from '../backend/learning-source-catalog.js';

test('unknown topics and empty inputs do not invent sources', () => {
  for (const topic of [null, undefined, 42, {}, '', '  ', 'ceramic sculpture', 'Математика', 'маркетинг', 'кесте']) {
    assert.deepEqual(sourceSuggestions(topic), [], String(topic));
  }
});

test('specific subjects and subskills select relevant instructional pages', () => {
  const cases = [
    ['Python с нуля', '/tutorial/introduction.html'],
    ['Python цикл және шарт', '/tutorial/controlflow.html'],
    ['CSS positioning', '/2-intro-to-css/README.md'],
    ['HTML basic page', '/1-intro-to-html/README.md'],
    ['Векторные иллюстрации в Illustrator', '/illustration-techniques'],
    ['Түс үйлесімі және түстер', '/secondary-colors.html'],
    ['Расчёт процентов и скидки', '/6-2-solve-general-applications-of-percent'],
    ['Google Sheets: сумма расходов', '/3093669?hl=en'],
    ['СУММЕСЛИ по категориям', '/3093583?hl=en'],
    ['Technical writing: clear sentences', '/clear-sentences'],
    ['Тема письма для рассылки', '/best-practices-for-email-subject-lines/'],
    ['ChatGPT для начинающих', '/10032626-prompt-engineering-best-practices-for-chatgpt'],
  ];
  for (const [topic, path] of cases) {
    assert.ok(sourceSuggestions(topic)[0]?.url.endsWith(path), topic);
  }
});

test('domain precedence avoids irrelevant material from incidental words', () => {
  assert.match(sourceSuggestions('Python: sum and colors')[0].url, /docs\.python\.org/);
  assert.match(sourceSuggestions('CSS color palette')[0].url, /intro-to-css/);
  for (const topic of ['Excel chart colors', 'Excel SUMIF', 'JavaScript percent calculator', 'Google Sheets chart colors', 'ChatGPT image generation', 'ChatGPT поиск в интернете']) {
    assert.deepEqual(sourceSuggestions(topic), [], topic);
  }
});

test('suggestions are bounded public URLs without fabricated extracted content', () => {
  const results = sourceSuggestions('Prompt engineering');
  assert.equal(results.length, 2);
  for (const source of results) {
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.equal(source.content, '');
    assert.ok(source.title);
  }
  results[0].content = 'caller fetched page';
  results[0].url = 'https://example.com/changed';
  assert.equal(sourceSuggestions('Prompt engineering')[0].content, '');
  assert.notEqual(sourceSuggestions('Prompt engineering')[0].url, results[0].url);
});
