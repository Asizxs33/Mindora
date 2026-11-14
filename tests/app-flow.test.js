import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as engine from '../core/engine.js';
import * as progress from '../core/progress.js';
import * as budget from '../core/budget-session.js';
import * as learningModel from '../core/learning-plan.js';
import { createWorkspaceStorage } from '../core/workspace-storage.js';
import { resumeCursor, needsRecap, certificateEligible, RECAP_AFTER_MS } from '../core/resume.js';
import { recapQuestion } from '../ui/recap.js';

// Run the real controller and its registered event handlers. Only DOM/rendering,
// file download and account identity are ports; curriculum and resume rules stay real.
// vm.Script avoids experimental VM modules or a DOM package for this small harness.
const controller = readFileSync(new URL('../core/app.js', import.meta.url), 'utf8')
  .replace(/^import .+ from .+;\r?$/gm, '');
const planController = readFileSync(new URL('../core/plan-controller.js', import.meta.url), 'utf8')
  .replace(/^import .+ from .+;\r?$/gm, '').replace('export function createPlanController', 'function createPlanController');
const KEY = 'mindora.workspace.v1.test-user';
const NOW = Date.UTC(2026, 10, 14, 12);
const clone = value => JSON.parse(JSON.stringify(value));

function seed(overrides = {}) {
  return {
    version: 1, minutes: 10, active: 'design', goals: {},
    progress: { design: 0, budget: 0 }, drafts: {}, works: {}, notes: {},
    sessions: {}, certificates: {}, practiceCount: 0, studyDays: [], ...overrides,
  };
}

function emitter() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener({ type, preventDefault() {}, ...event });
    },
  };
}

function node() {
  const classes = new Set();
  return {
    ...emitter(), value: '', textContent: '', innerHTML: '', dataset: {}, open: false,
    focusCount: 0, focus() { this.focusCount++; }, scrollIntoView() {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
    showModal() { this.open = true; }, close() { this.open = false; },
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
  };
}

function app(initial, { now = NOW, account = { user: { id: 'test-user' }, profile: null }, storage: priorStorage, realPlans = false, failStorageWrites = false, reconcile = Promise.resolve() } = {}) {
  let time = now, current, deck = null, uuidCount = 0, reloads = 0, conflictNotice = false, accountOpens = 0;
  const storage = priorStorage || new Map([[KEY, JSON.stringify(initial)]]);
  const presentation = new Map();
  const elements = new Map(['#main', '#toast', '#modal', '#modal-content', '#checks-container', '#certificate-name'].map(selector => [selector, node()]));
  const document = {
    ...emitter(), hidden: false,
    querySelector(selector) { return selector === '[data-learn-deck]' ? deck : elements.get(selector) || null; },
    getElementById(id) { return elements.get(`#${id}`) || null; },
  };
  const window = { ...emitter(), scrollTo() {}, location: { reload() { reloads++; } } };
  const downloads = [];
  const generations = [];
  const storePort = map => ({
    getItem: key => map.get(key) ?? null,
    setItem(key, value) {
      if (map === storage && failStorageWrites) throw new Error('Storage unavailable');
      map.set(key, String(value));
    },
    removeItem: key => map.delete(key),
  });
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [time])); }
    static now() { return time; }
  }
  const screen = kind => (...args) => ({ kind, args: clone(args) });
  const context = vm.createContext({
    ...engine, ...progress, ...budget, ...learningModel, resumeCursor, certificateEligible, recapQuestion,
    languageCode: value => value || 'en', setLanguage() {}, message: value => value,
    createCloudDrafts: () => ({ render() {}, async init() {} }),
    createPlanController: () => ({ screen: () => ({}), reset() {}, async generate(goal, minutes) { generations.push({ goal, minutes }); } }),
    createLearningLibrary: () => ({ screen: () => ({ user: account.user, courses: [] }), async setUser() { await reconcile; return true; }, changed() {}, async flush() { return true; } }),
    createBuiltinSync: () => ({ screen: () => ({}), async setUser() { return true; }, changed() {}, async flush() { return true; } }),
    learningLibraryView: () => '', learningSyncView: () => '', loginRequiredView: () => '',
    createWorkspaceStorage,
    showWorkspaceConflict() { conflictNotice = true; },
    learningPlanView: screen('learning-plan'),
    needsRecap: (state, id) => needsRecap(state, id, time),
    Date: Clock, console, structuredClone, document, window,
    AbortSignal: { timeout: () => undefined },
    fetch: async () => ({ ok: true, json: async () => ({ review: { observation: 'Your result is complete.', nextAction: 'Try another example.' } }) }),
    localStorage: storePort(storage), sessionStorage: storePort(presentation),
    setTimeout: () => 1, clearTimeout() {},
    crypto: { randomUUID: () => `${String(++uuidCount).padStart(8, '0')}-0000-4000-8000-000000000000` },
    mountShell() {},
    renderShell(view, state, stats, html) {
      conflictNotice = false;
      current = { view, state: clone(state), html };
      deck = view === 'lesson' && html.args[1].step === 0
        ? { dataset: { index: presentation.get(`mindora.reading.${state.active}.v1`) || '0' } } : null;
      if (view === 'certificate') elements.get('#certificate-name').value = html.args[0].name;
    },
    dashboard: screen('dashboard'), coursesPage: screen('courses'), sidePage: screen('side'),
    pathView: screen('path'), lesson: screen('lesson'), result: screen('result'), workView: screen('work'),
    recapView: screen('recap'), certificateView: screen('certificate'),
    refreshCertificatePreview() {},
    courseNames: { design: 'Your first poster', budget: 'Everyday spreadsheets' },
    dialogContent: () => '', resetWorkCheck() {}, refreshPosterPreview() {}, clearBudgetTotal() {},
    // These tests use the real spreadsheet evaluator. Poster layout/export is a separate tested subsystem.
    posterLayout() { throw new Error('Unexpected poster layout call in controller-flow test'); },
    posterSvg() { throw new Error('Unexpected poster download call in controller-flow test'); },
    getAccountState: () => clone(account),
    openAccount() { accountOpens++; }, closeAccount() {}, expireAccountSession() { account.user = null; window.dispatch('mindora:account-changed'); },
    downloadCertificate: data => downloads.push(clone(data)),
  });
  if (realPlans) new vm.Script(planController, { filename: 'core/plan-controller.js' }).runInContext(context);
  new vm.Script(controller, { filename: 'core/app.js' }).runInContext(context);
  return {
    get current() { return current; },
    get lesson() { return current.html.args[1]; },
    get recap() { return current.html.args[1]; },
    get reloads() { return reloads; },
    get conflictNotice() { return conflictNotice; },
    get accountOpens() { return accountOpens; },
    saved: () => JSON.parse(storage.get(KEY)), storage, presentation, downloads,
    generations,
    signIn(user, reason) { account.user = user; window.dispatch('mindora:account-changed', { detail: { reason } }); },
    startGoal(goal, minutes) {
      const input = node(); input.value = goal; elements.set('#goal-input', input);
      const select = node(); select.value = String(minutes); elements.set('#time-select', select);
      document.dispatch('submit', { target: { id: 'goal-form' } });
    },
    element: selector => elements.get(selector),
    advance(ms) { time += ms; },
    click(dataset, { disabled = false, attributes = [] } = {}) {
      const target = { dataset, disabled, closest: () => target, matches: selector => selector === '[data-home]' && attributes.includes('data-home'), hasAttribute: name => attributes.includes(name) };
      document.dispatch('click', { target });
    },
    input(id, value, dataset = {}) {
      const target = elements.get(`#${id}`) || node();
      Object.assign(target, { id, value, dataset, closest: selector => selector === '#main' ? elements.get('#main') : null });
      document.dispatch('input', { target });
    },
    change(id, value) { document.dispatch('change', { target: { id, value } }); },
    answer(value) { document.dispatch('input', { target: { form: { id: 'learning-step-form' }, name: 'answer', value, dataset: {}, closest: () => null } }); },
    submitAnswer(value) { document.dispatch('submit', { target: { id: 'learning-step-form', elements: { answer: { value } } } }); },
    storageChanged(key = KEY) { window.dispatch('storage', { key }); },
    readPage(page, courseId = current.state.active) {
      if (deck) deck.dataset.index = String(page);
      window.dispatch('mindora:learn-page', { detail: { courseId, page } });
    },
    leave() { window.dispatch('pagehide'); },
    visible(value) { document.hidden = !value; document.dispatch('visibilitychange'); },
  };
}

test('starting either built-in course requires authentication and does not expose prior account work', () => {
  const run = app(seed({ progress: { design: 4, budget: 4 } }), { account: { user: null, profile: null } });
  run.click({ action: 'resume-course', id: 'design' });
  run.click({ course: 'budget' }, { attributes: ['data-start'] });
  assert.equal(run.current.view, 'discover');
  assert.equal(run.accountOpens, 2);
  assert.deepEqual(run.current.state.progress, { design: 0, budget: 0 });
});

test('a guest goal waits for account restoration, then resumes with the selected time', async () => {
  let ready;
  const reconcile = new Promise(resolve => { ready = resolve; });
  const run = app(seed(), { account: { user: null, profile: null }, reconcile });
  run.startGoal('Learn to use ChatGPT', 20);
  assert.equal(run.accountOpens, 1);
  assert.deepEqual(run.generations, []);
  run.signIn({ id: 'test-user' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.generations, [], 'do not race generation against restoring the old saved lesson');
  ready();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.generations, [{ goal: 'Learn to use ChatGPT', minutes: 20 }]);
  assert.equal(run.current.view, 'learning-plan');
});

test('completed signup opens the signed-in home instead of My Courses', async () => {
  const run = app(seed(), { account: { user: null, profile: null } });
  run.signIn({ id: 'new-learner' }, 'signup-complete');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.view, 'discover');
  assert.deepEqual(run.generations, []);
});

test('a signup started from a goal resumes it only after the signup profile is saved', async () => {
  const run = app(seed(), { account: { user: null, profile: null } });
  const user = { id: 'new-learner' };
  run.startGoal('Learn to use ChatGPT', 20);
  run.signIn(user, 'signup-profile-pending');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.generations, []);
  run.signIn(user, 'signup-complete');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.generations, [{ goal: 'Learn to use ChatGPT', minutes: 20 }]);
  assert.equal(run.current.view, 'learning-plan');
});

test('switching accounts selects separate local workspaces and signout hides learning', async () => {
  const run = app(seed({ notes: { design: 'First account note' } }));
  run.signIn({ id: 'second-user' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.current.state.notes, {});
  run.input('note', 'Second account note', { note: 'design' });
  assert.equal(run.saved().notes.design, 'First account note');
  assert.equal(JSON.parse(run.storage.get('mindora.workspace.v1.second-user')).notes.design, 'Second account note');
  run.signIn(null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.view, 'discover');
  assert.deepEqual(run.current.state.notes, {});
});

test('automatic budget reload requires the overdue recap and preserves the reading page', () => {
  const run = app(seed({ active: 'budget', budgetActivity: { view: 'lesson', step: 0 }, sessions: { budget: { lastSeen: NOW - RECAP_AFTER_MS - 1, cursor: { step: 0, page: 2 } } } }));
  assert.equal(run.current.view, 'recap');
  assert.equal(run.saved().sessions.budget.cursor.page, 2);
});

test('an older tab cannot overwrite a completed AI task through the real app save path', async () => {
  const url = 'https://docs.python.org/3/tutorial/';
  const plan = learningModel.normalizePlan({
    title: 'Python loops', outcome: 'Write a loop.',
    steps: [0, 1].map(index => ({ title: `Task ${index + 1}`, instruction: 'Visit every name.', task: 'Print three names.', criterion: 'Three names appear.', sourceUrl: url })),
  }, { goal: 'Learn Python loops', minutes: 5, language: 'en' }, new Map([[url, { url, title: 'Python tutorial' }]]));
  const initial = seed({ learningPlanOpen: true, learningPlan: { plan, study: [{ page: 1 }] } });
  const first = app(initial, { realPlans: true });
  const older = app(null, { storage: first.storage, realPlans: true });
  first.answer('Ada, Lin, Sam');
  first.submitAnswer('Ada, Lin, Sam');
  await new Promise(resolve => setImmediate(resolve));
  first.click({ learningStep: 'continue' });
  const newerSave = first.storage.get(KEY);
  assert.equal(first.saved().learningPlan.completed, 1);

  // The browser may not have delivered the storage event before this input.
  older.answer('My unsaved text');
  older.click({ learningPage: 'back' });
  assert.equal(first.storage.get(KEY), newerSave, 'the stale tab must not replace newer answers or completion');
  assert.equal(older.current.state.learningPlan.answers[0], 'My unsaved text', 'retain the conflicting draft in memory');
  assert.equal(older.reloads, 0, 'do not reload or discard the draft automatically');
  assert.equal(older.conflictNotice, true, 'keep the conflict notice visible after navigation rerenders');
  older.click({ action: 'reload-workspace' });
  assert.equal(older.reloads, 1, 'reload only after the learner explicitly chooses it');
  const reloaded = app(null, { storage: first.storage, realPlans: true });
  assert.equal(reloaded.current.state.learningPlan.completed, 1);
  assert.equal(reloaded.current.state.learningPlan.answers[0], 'Ada, Lin, Sam');
  assert.equal(reloaded.conflictNotice, false);
});

test('a storage event pauses the stale tab without redrawing its current input', () => {
  const first = app(seed());
  const older = app(null, { storage: first.storage });
  const currentScreen = older.current;
  first.input('note', 'Newer work', { note: 'design' });
  older.storageChanged('unrelated-key');
  assert.equal(older.conflictNotice, false);
  older.storageChanged();
  assert.equal(older.conflictNotice, true);
  assert.equal(older.current, currentScreen, 'the focused draft is not redrawn');
  older.input('note', 'My conflicting draft', { note: 'design' });
  older.change('profile-minutes', '20');
  assert.equal(first.saved().notes.design, 'Newer work');
  assert.equal(first.saved().minutes, 10);
  assert.equal(older.reloads, 0);
});

test('clearing storage in another tab cannot resurrect an old workspace', () => {
  const run = app(seed({ notes: { design: 'Old private draft' } }));
  run.storage.delete(KEY);
  run.storageChanged(null);
  run.change('profile-minutes', '20');
  assert.equal(run.conflictNotice, true);
  assert.equal(run.storage.has(KEY), false);
});

test('unavailable storage keeps the existing one-time save warning', () => {
  const run = app(seed(), { failStorageWrites: true });
  run.input('note', 'Still in memory', { note: 'design' });
  assert.match(run.element('#toast').textContent, /could not save progress/);
  run.element('#toast').textContent = 'Another notice';
  run.input('note', 'Still editable', { note: 'design' });
  assert.equal(run.element('#toast').textContent, 'Another notice');
  assert.equal(run.conflictNotice, false);
  assert.deepEqual(run.saved().notes, {});
});

test('time modes retain separate quiz positions and finish after one or four questions', () => {
  const run = app(seed({ active: 'budget', minutes: 20, progress: { design: 0, budget: 1 } }));
  run.click({ action: 'resume-course', id: 'budget' });
  for (let index = 0; index < 3; index++) {
    run.click({ choice: String(budget.budgetSession(20).questions[index].correctIndex) });
    run.click({ action: 'check-quiz' });
    run.click({ action: 'next-question' });
  }
  assert.equal(run.lesson.quizIndex, 3);
  assert.equal(run.lesson.questionCount, 4);
  run.change('budget-session-minutes', '5');
  assert.equal(run.lesson.questionCount, 1);
  assert.equal(run.lesson.quizIndex, 0);
  run.change('budget-session-minutes', '20');
  assert.equal(run.lesson.quizIndex, 3);
  run.leave();
  const reloaded = app(null, { storage: run.storage });
  reloaded.click({ action: 'resume-course', id: 'budget' });
  assert.equal(reloaded.lesson.quizIndex, 3);
  reloaded.click({ choice: '0' });
  reloaded.click({ action: 'check-quiz' });
  reloaded.click({ action: 'next-question' });
  assert.equal(reloaded.lesson.step, 2);
  const short = app(seed({ active: 'budget', minutes: 5, progress: { design: 0, budget: 1 } }));
  short.click({ action: 'resume-course', id: 'budget' });
  short.click({ choice: String(budget.budgetSession(5).questions[0].correctIndex) });
  short.click({ action: 'check-quiz' });
  short.click({ action: 'next-question' });
  assert.equal(short.lesson.step, 2);
});

test('a reading card resumes after pagehide and reload, including an older save without additive fields', () => {
  const oldSave = seed();
  delete oldSave.sessions; delete oldSave.certificates;
  const first = app(oldSave);
  first.click({ action: 'resume-course', id: 'design' });
  first.readPage(2);
  first.leave();
  assert.equal(first.saved().sessions.design.cursor.page, 2);
  assert.deepEqual(first.saved().certificates, {});

  const reloaded = app(null, { storage: first.storage });
  reloaded.click({ action: 'resume-course', id: 'design' });
  assert.equal(reloaded.current.view, 'lesson');
  assert.equal(reloaded.lesson.step, 0);
  assert.equal(reloaded.presentation.get('mindora.reading.design.v1'), '2');
  assert.equal(reloaded.saved().progress.design, 0);
});

test('quiz selection, checked feedback and question position survive reload through controller events', () => {
  const first = app(seed({ progress: { design: 1, budget: 0 } }));
  first.click({ action: 'resume-course', id: 'design' });
  first.click({ choice: String(engine.DESIGN_QUIZ[0].correctIndex) });
  first.click({ action: 'check-quiz' });
  first.click({ action: 'next-question' });
  const choice = engine.DESIGN_QUIZ[1].correctIndex;
  first.click({ choice: String(choice) });
  first.click({ action: 'check-quiz' });
  first.leave();

  const reloaded = app(null, { storage: first.storage });
  reloaded.click({ action: 'resume-course', id: 'design' });
  assert.equal(reloaded.current.view, 'lesson');
  assert.equal(reloaded.lesson.step, 1);
  assert.equal(reloaded.lesson.quizIndex, 1);
  assert.equal(reloaded.lesson.quizChoice, choice);
  assert.equal(reloaded.lesson.quizFeedback, true);
  assert.equal(reloaded.saved().progress.design, 1);
});

test('resume offers a recap strictly after 24 hours, and skips it when nothing was learned', () => {
  for (const [elapsed, learned, expected] of [
    [RECAP_AFTER_MS - 1, true, 'lesson'],
    [RECAP_AFTER_MS, true, 'lesson'],
    [RECAP_AFTER_MS + 1, true, 'recap'],
    [RECAP_AFTER_MS * 2, false, 'lesson'],
  ]) {
    const run = app(seed({ sessions: { design: { lastSeen: NOW - elapsed, cursor: { step: 0, page: learned ? 1 : 0 } } } }));
    run.click({ action: 'resume-course', id: 'design' });
    assert.equal(run.current.view, expected, `elapsed=${elapsed}, learned=${learned}`);
  }
});

test('a selected path node wins over a different saved review position, while locked stages stay closed', () => {
  const run = app(seed({
    progress: { design: 2, budget: 0 },
    sessions: { design: { lastSeen: NOW - 1000, cursor: { step: 0, page: 2 } } },
  }));
  run.click({ step: '2' });
  assert.equal(run.current.view, 'lesson');
  assert.equal(run.lesson.step, 2, 'current path node does not reopen an old reading card');
  run.click({ step: '0' });
  assert.equal(run.lesson.step, 0, 'completed node can be revisited');
  assert.equal(run.presentation.get('mindora.reading.design.v1'), '0');
  run.readPage(2);
  run.click({ step: '0' });
  assert.equal(run.presentation.get('mindora.reading.design.v1'), '2', 'same node retains its saved card');
  run.click({ step: '3' });
  assert.equal(run.lesson.step, 0, 'locked future node cannot open');
  assert.match(run.element('#toast').textContent, /unlock the next/);
});

test('a path-node choice survives an overdue recap instead of restoring a different saved stage', () => {
  const run = app(seed({ progress: { design: 2, budget: 0 }, sessions: { design: { lastSeen: NOW - RECAP_AFTER_MS - 1, cursor: { step: 1, quizIndex: 1 } } } }));
  run.click({ step: '0' });
  assert.equal(run.current.view, 'recap');
  run.click({ action: 'recap-next' });
  for (let index = 0; index < 2; index++) {
    run.click({ recapChoice: String(recapQuestion('design', index).answer) });
    run.click({ action: 'recap-check' });
    run.click({ action: 'recap-next' });
  }
  assert.equal(run.current.view, 'lesson');
  assert.equal(run.lesson.step, 0);
  assert.equal(run.presentation.get('mindora.reading.design.v1'), '0');
  assert.equal(run.saved().progress.design, 2);
});

for (const [completed, expectedStep, action] of [[2, 2, 'practice'], [4, 3, 'mix']]) {
  test(`${action} after an overdue reading recap opens and saves a fresh ${expectedStep === 2 ? 'practice' : 'final challenge'}`, () => {
    const key = `budget-${expectedStep === 2 ? 'practice' : 'challenge'}`;
    const oldDraft = { values: [10, 20, 5], formula: '=SUM(B2:B4)', answer: '35', seed: expectedStep === 2 ? 0 : 6 };
    const earned = { name: 'Alex', completedAt: new Date(NOW - RECAP_AFTER_MS * 3).toISOString(), certificateId: 'MD-BUDGET-EARNED' };
    const run = app(seed({
      active: 'budget', progress: { design: 0, budget: completed }, drafts: { [key]: oldDraft },
      certificates: completed === 4 ? { budget: earned } : {},
      sessions: { budget: { lastSeen: NOW - RECAP_AFTER_MS - 1, cursor: { step: 0, page: 2 } } },
    }));
    run.click({ action, id: 'budget' });
    assert.equal(run.current.view, 'recap');
    assert.deepEqual(run.saved().drafts[key], oldDraft, 'keep the old draft until the recap has finished');
    run.click({ action: 'recap-next' });
    for (let index = 0; index < 2; index++) {
      run.click({ recapChoice: String(recapQuestion('budget', index).answer) });
      run.click({ action: 'recap-check' });
      run.click({ action: 'recap-next' });
    }
    assert.equal(run.current.view, 'lesson');
    assert.equal(run.lesson.step, expectedStep, 'the fresh task request wins over the saved reading position');
    const fresh = run.saved().drafts[key];
    assert.ok(fresh.seed > oldDraft.seed, 'a new variant was generated');
    assert.deepEqual(fresh.values, engine.makeBudgetChallenge(fresh.seed));
    assert.equal(fresh.formula, '');
    assert.equal(fresh.answer, '');
    assert.equal(run.saved().progress.budget, completed, 'practice does not reset earned course progress');
    assert.equal(run.saved().sessions.budget.cursor.step, expectedStep, 'reload will resume the fresh task');
    if (completed === 4) assert.deepEqual(run.saved().certificates.budget, earned);
  });
}

test('recap blocks unanswered/wrong checks, then restores the exact saved quiz and draft without advancing the course', () => {
  const cursor = { step: 1, page: 0, quizIndex: 2, quizChoice: 1, quizFeedback: true };
  const drafts = { 'budget-practice': { values: [10, 20, 5], formula: '=SUM(B2:B4)', answer: '35', seed: 0 } };
  const run = app(seed({ active: 'budget', progress: { design: 0, budget: 2 }, drafts, sessions: { budget: { lastSeen: NOW - RECAP_AFTER_MS - 1, cursor } } }));
  run.click({ action: 'resume-course', id: 'budget' });
  assert.equal(run.current.view, 'recap');
  assert.equal(run.recap.phase, 0);
  run.click({ action: 'recap-next' });
  run.click({ action: 'recap-next' });
  assert.equal(run.recap.phase, 1, 'cannot skip an unanswered question');
  run.click({ recapChoice: String((recapQuestion('budget', 0).answer + 1) % 3) });
  run.click({ action: 'recap-check' });
  run.click({ action: 'recap-next' });
  assert.equal(run.recap.phase, 1, 'wrong answer does not advance');
  for (let index = 0; index < 2; index++) {
    run.click({ recapChoice: String(recapQuestion('budget', index).answer) });
    run.click({ action: 'recap-check' });
    run.click({ action: 'recap-next' });
  }
  assert.equal(run.current.view, 'lesson');
  for (const field of ['step', 'quizIndex', 'quizChoice', 'quizFeedback']) assert.equal(run.lesson[field], cursor[field], field);
  assert.equal(run.saved().progress.budget, 2);
  assert.deepEqual(run.saved().drafts, drafts);
  assert.equal(run.saved().sessions.budget.lastSeen, NOW);
  const reloaded = app(null, { storage: run.storage });
  reloaded.click({ action: 'resume-course', id: 'budget' });
  assert.equal(reloaded.current.view, 'lesson', 'completed recap is not repeated on reload');
});

test('returning to a long-hidden lesson triggers recap without losing its reading card', () => {
  const run = app(seed());
  run.click({ action: 'resume-course', id: 'design' });
  run.readPage(1);
  run.visible(false);
  run.advance(RECAP_AFTER_MS + 1);
  run.leave();
  assert.equal(run.saved().sessions.design.lastSeen, NOW, 'pagehide does not turn an old hidden session into fresh activity');
  run.visible(true);
  assert.equal(run.current.view, 'recap');
  assert.equal(run.saved().sessions.design.cursor.page, 1);
});

test('certificate is denied before full completion or without a saved final challenge', () => {
  for (const [completed, challenge] of [[0, false], [3, true], [4, false]]) {
    const run = app(seed({ progress: { design: completed, budget: 0 }, works: { design: { challenge, savedAt: new Date(NOW).toISOString(), data: {} } } }));
    run.click({ action: 'certificate', id: 'design' });
    assert.notEqual(run.current.view, 'certificate');
    assert.deepEqual(run.saved().certificates, {});
    assert.match(run.element('#toast').textContent, /Finish the course/);
  }
});

test('an earned certificate remains available when later guided practice replaces the saved work', () => {
  const earned = { name: 'Alex', completedAt: new Date(NOW - 10000).toISOString(), certificateId: 'MD-DESIGN-EARNED' };
  const run = app(seed({
    progress: { design: 4, budget: 0 }, certificates: { design: earned },
    works: { design: { challenge: false, savedAt: new Date(NOW).toISOString(), data: {} } },
  }));
  run.click({ action: 'certificate', id: 'design' });
  assert.equal(run.current.view, 'certificate');
  assert.deepEqual(run.saved().certificates.design, earned);
  run.click({ action: 'download-certificate' });
  assert.equal(run.downloads[0].certificateId, earned.certificateId);
  assert.equal(run.downloads[0].completedAt, earned.completedAt);
});

test('saving a passing final challenge unlocks a stable, named certificate and downloads only after a name is supplied', () => {
  const run = app(seed({
    active: 'budget', progress: { design: 0, budget: 3 },
    drafts: { 'budget-challenge': { values: [10, 20, 5], formula: '=SUM(B2:B4)', answer: '35', seed: 0 } },
  }));
  run.click({ action: 'resume-course', id: 'budget' });
  assert.equal(run.lesson.step, 3);
  run.click({ action: 'check-work' });
  assert.equal(run.lesson.checks.passed, true);
  assert.equal(run.saved().progress.budget, 3, 'checking is not the final save');
  run.click({ action: 'check-work' });
  assert.equal(run.current.view, 'result');
  assert.equal(run.saved().progress.budget, 4);
  assert.equal(run.saved().works.budget.challenge, true);
  const certificateId = run.saved().certificates.budget.certificateId;
  run.click({ action: 'certificate', id: 'budget' });
  assert.equal(run.current.view, 'certificate');
  run.click({ action: 'download-certificate' });
  assert.equal(run.downloads.length, 0, 'blank name cannot produce the final certificate');
  assert.ok(run.element('#certificate-name').focusCount > 0);
  run.input('certificate-name', 'Alex Learner');
  run.click({ action: 'download-certificate' });
  assert.equal(run.downloads.length, 1);
  assert.equal(run.downloads[0].name, 'Alex Learner');
  assert.equal(run.downloads[0].courseTitle, 'Everyday spreadsheets');

  const reloaded = app(null, { storage: run.storage });
  reloaded.click({ action: 'certificate', id: 'budget' });
  assert.equal(reloaded.current.view, 'certificate');
  assert.equal(reloaded.saved().certificates.budget.certificateId, certificateId);
  assert.equal(reloaded.element('#certificate-name').value, 'Alex Learner');
  assert.equal(reloaded.saved().certificates.budget.completedAt, new Date(NOW).toISOString());
});
