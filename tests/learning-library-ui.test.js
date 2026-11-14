import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { learningLibraryView, learningSyncView, loginRequiredView } from '../ui/learning-library.js';
import { setLanguage } from '../ui/language.js';

const course = { id: 'bfa0ca10-bcbc-4d90-8d08-f65d55dd4e55', title: 'A <useful> lesson', goal: 'Learn & practise', minutes: 5, language: 'en', completed: 1, totalSteps: 2 };
const documentFor = html => parseHTML(`<html><body>${html}</body></html>`).document;

test('guest views require an account and do not reveal saved course content', () => {
  const document = documentFor(learningLibraryView({ courses: [course], hasLocalLesson: true }));
  assert.ok(document.querySelector('[data-account-open="signup"]'));
  assert.ok(document.querySelector('[data-account-open="signin"]'));
  assert.equal(document.querySelector('[data-learning-open], [data-learning-import]'), null);
  assert.ok(!document.body.textContent.includes(course.title));
  assert.match(documentFor(loginRequiredView({ available: false })).querySelector('[role="status"]').textContent, /temporarily unavailable/);
});

test('saved lesson cards escape content and expose real progress and course actions', () => {
  const document = documentFor(learningLibraryView({ user: { id: 'user' }, courses: [course, { ...course, id: 'completed-course', completed: 2 }] }));
  const cards = document.querySelectorAll('.learning-library-card');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].querySelector('h3').textContent, course.title);
  assert.equal(cards[0].querySelector('useful'), null);
  assert.equal(cards[0].querySelector('progress').getAttribute('value'), '1');
  assert.equal(cards[0].querySelector('progress').getAttribute('max'), '2');
  assert.equal(cards[0].querySelector('[data-learning-open]').dataset.learningOpen, course.id);
  assert.match(cards[0].querySelector('button').textContent, /Open path/);
  assert.match(cards[1].querySelector('button').textContent, /Open path/);
});

test('a generated roadmap opens its own path and presents progress across lessons', () => {
  const document = documentFor(learningLibraryView({
    user: { id: 'user' }, courses: [course],
    roadmaps: [{ id: 'roadmap-1', title: 'Learn spreadsheets', language: 'en', completed: 2, totalSteps: 4 }],
  }, { primaryHeading: true, showEmpty: false }));
  const roadmap = document.querySelector('[data-learning-roadmap="roadmap-1"]').closest('li');
  assert.equal(roadmap.querySelector('h3').textContent, 'Learn spreadsheets');
  assert.equal(roadmap.querySelector('progress').getAttribute('aria-label'), 'Completed lessons');
  assert.equal(roadmap.querySelector('progress').getAttribute('value'), '2');
  assert.equal(roadmap.querySelector('progress').getAttribute('max'), '4');
  assert.match(roadmap.querySelector('button').textContent, /Open path/);
  assert.ok(document.querySelector('[data-learning-open]'));
});

test('loading and failure states keep retry controls clear and hide backend error details', () => {
  const loading = documentFor(learningLibraryView({ user: {}, loading: true, courses: [course] }));
  assert.equal(loading.querySelector('.learning-library').getAttribute('aria-busy'), 'true');
  assert.equal(loading.querySelector('[data-learning-refresh]').hasAttribute('disabled'), true);
  assert.equal(loading.querySelector('[data-learning-open]').hasAttribute('disabled'), true);
  assert.equal(loading.querySelector('.learning-library-empty'), null);
  const failed = documentFor(learningLibraryView({ user: {}, error: 'database: private diagnostic' }));
  assert.equal(failed.querySelector('[data-learning-refresh]').hasAttribute('disabled'), false);
  assert.ok(!failed.body.textContent.includes('database:'));
  assert.equal(failed.querySelector('.learning-library-empty'), null);
});

test('a browser lesson is offered for explicit import only when the controller flags it', () => {
  assert.equal(documentFor(learningLibraryView({ user: {} })).querySelector('[data-learning-import]'), null);
  const document = documentFor(learningLibraryView({ user: {}, hasLocalLesson: true }));
  assert.ok(document.querySelector('[data-learning-import]'));
  assert.match(document.querySelector('.learning-library-import').textContent, /only on this device/);
});

test('sync statuses offer retry or an explicit choice that keeps both versions', () => {
  assert.equal(learningSyncView({ status: 'idle' }), '');
  for (const status of ['loading', 'saving']) {
    const document = documentFor(learningSyncView({ status, conflict: true }));
    assert.equal(document.querySelector('.learning-sync').getAttribute('aria-busy'), 'true');
    assert.equal(document.querySelector('button'), null);
  }
  const failed = documentFor(learningSyncView({ status: 'offline', error: 'private database message' }));
  assert.ok(failed.querySelector('[data-learning-sync="retry"]'));
  assert.ok(!failed.body.textContent.includes('private database'));
  const conflict = documentFor(learningSyncView({ status: 'conflict' }));
  assert.ok(conflict.querySelector('[data-learning-sync="load-latest"]'));
  assert.ok(conflict.querySelector('[data-learning-sync="save-copy"]'));
  assert.match(conflict.body.textContent, /replaces this browser’s copy/);
  assert.match(conflict.body.textContent, /keeps both versions/);
  assert.equal(documentFor(learningSyncView({ status: 'saved' })).querySelector('button'), null);
});

test('account gates and saved lessons follow English, Russian and Kazakh interface choices', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: {} };
  try {
    for (const [language, signIn, savedTitle, saveCopy] of [
      ['en', 'Sign in', 'Your saved lessons', 'Save my copy'],
      ['ru', 'Войти', 'Сохранённые занятия', 'Сохранить мою копию'],
      ['kk', 'Кіру', 'Сақталған сабақтар', 'Көшірмемді сақтау'],
    ]) {
      setLanguage(language);
      assert.equal(documentFor(loginRequiredView()).querySelector('[data-account-open="signin"]').textContent, signIn);
      assert.equal(documentFor(learningLibraryView({ user: {} })).querySelector('h2').textContent, savedTitle);
      assert.equal(documentFor(learningSyncView({ status: 'conflict' })).querySelector('[data-learning-sync="save-copy"]').textContent, saveCopy);
    }
  } finally {
    setLanguage('en');
    globalThis.document = previousDocument;
  }
});
