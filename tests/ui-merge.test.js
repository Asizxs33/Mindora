import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboard, sidePage } from '../ui/dashboard.js';
import { setLanguage } from '../ui/language.js';
import { budgetSession, createBudgetDraft } from '../core/budget-session.js';
import { recapQuestion, recapView } from '../ui/recap.js';
import { certificateView } from '../ui/certificate.js';

// Rendering these budget screens needs no canvas; poster.js also supports a
// missing 2D context. Skip browser-only stylesheet insertion during import.
globalThis.document = { getElementById: () => true, createElement: () => ({ getContext: () => null }) };
const { lesson, pathView, result } = await import('../ui/views.js');
delete globalThis.document;

const state = (minutes = 10) => ({
  active: 'budget', minutes, progress: { design: 0, budget: 1 },
  goals: { budget: 'Learn spreadsheets' }, works: {}, notes: {}, studyDays: [],
});

test('redesigned quiz finishes the selected 5, 10 or 20 minute question set', () => {
  for (const minutes of [5, 10, 20]) {
    const questions = budgetSession(minutes).questions;
    for (let quizIndex = 0; quizIndex < questions.length; quizIndex++) {
      const question = questions[quizIndex];
      const html = lesson(state(minutes), {
        step: 1, question, questionCount: questions.length, quizIndex,
        quizChoice: question.correctIndex, quizFeedback: true,
      });
      assert.match(html, new RegExp(`Question ${quizIndex + 1} of ${questions.length}`));
      assert.match(html, /<h1>/);
      assert.match(html, /data-action="next-question"/);
      assert.equal(html.includes('Finish this step'), quizIndex === questions.length - 1);
      assert.doesNotMatch(html, /NaN|undefined/);
    }
  }
});

test('redesigned course keeps selected duration, extended budget work and cloud hooks', () => {
  for (const minutes of [5, 10, 20]) {
    const current = state(minutes);
    const path = pathView(current);
    assert.match(path, /class="learning-path course-path"/);
    assert.match(path, new RegExp(`value="${minutes}" selected`));
    assert.match(path, /data-action="resume-course"/);
    const practice = lesson(current, {
      step: 2, questionCount: budgetSession(minutes).questions.length,
      draft: createBudgetDraft(2, minutes), checks: null,
    });
    assert.match(practice, /data-cloud-panel="editor"/);
    assert.equal(practice.includes('id="budget-balance"'), minutes === 20);
    assert.equal(/id="budget-formula"[^>]* readonly/.test(practice), minutes === 5);
  }
  assert.match(sidePage('profile', state()), /data-cloud-panel="profile"/);
  assert.match(sidePage('profile', state()), /data-account-summary/);
});

test('AI resume, account entry and translated course actions coexist', () => {
  globalThis.document = { documentElement: {} };
  try {
    for (const [language, resume] of [['en', 'Resume my lesson'], ['ru', 'Продолжить занятие'], ['kk', 'Сабақты жалғастыру']]) {
      setLanguage(language);
      const current = state(20);
      current.learningPlan = { completed: 0, plan: { title: '<my goal>', steps: [{ task: 'One task' }] } };
      const home = dashboard(current);
      assert.match(home, /&lt;my goal&gt;/);
      assert.ok(home.includes(resume));
      assert.match(home, /id="goal-form"/);
      assert.match(home, /id="time-select"/);
      assert.match(home, /value="20" selected/);
      assert.doesNotMatch(home, /\$\{t\(/);
      const profile = sidePage('profile', current);
      assert.match(profile, /data-account-open="signup"/);
      assert.doesNotMatch(profile, /\$\{t\(/);
      current.progress.budget = 4;
      assert.match(result(current), /data-action="certificate"/);
      assert.match(pathView(current), /data-action="certificate"/);
      const recap = recapView('budget', { phase: 2, choice: recapQuestion('budget', 1).answer, checked: true });
      assert.match(recap, /data-action="recap-next"/);
      assert.doesNotMatch(recap, /\$\{t\(/);
      const certificate = certificateView({ name: '<Learner>', completedAt: '2026-11-14' });
      assert.match(certificate, /&lt;Learner&gt;/);
      assert.ok(certificate.includes(({ en: 'Download certificate', ru: 'Скачать сертификат', kk: 'Сертификатты жүктеу' })[language]));
    }
  } finally {
    setLanguage('en');
    delete globalThis.document;
  }
});
