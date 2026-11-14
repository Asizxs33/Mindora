import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as engine from '../core/engine.js';
import * as progress from '../core/progress.js';
import { resumeCursor, needsRecap, certificateEligible, RECAP_AFTER_MS } from '../core/resume.js';
import { recapQuestion } from '../ui/recap.js';

// Run the real controller and its registered event handlers. Only DOM/rendering,
// file download and account identity are ports; curriculum and resume rules stay real.
// vm.Script avoids experimental VM modules or a DOM package for this small harness.
const controller = readFileSync(new URL('../core/app.js', import.meta.url), 'utf8')
  .replace(/^import .+ from .+;\r?$/gm, '');
const KEY = 'mindora.workspace.v1';
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

function app(initial, { now = NOW, account = { user: null, profile: null }, storage: priorStorage } = {}) {
  let time = now, current, deck = null, uuidCount = 0;
  const storage = new Map(priorStorage || [[KEY, JSON.stringify(initial)]]);
  const presentation = new Map();
  const elements = new Map(['#main', '#toast', '#modal', '#modal-content', '#checks-container', '#certificate-name'].map(selector => [selector, node()]));
  const document = {
    ...emitter(), hidden: false,
    querySelector(selector) { return selector === '[data-learn-deck]' ? deck : elements.get(selector) || null; },
  };
  const window = { ...emitter(), scrollTo() {} };
  const downloads = [];
  const storePort = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) });
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [time])); }
    static now() { return time; }
  }
  const screen = kind => (...args) => ({ kind, args: clone(args) });
  const context = vm.createContext({
    ...engine, ...progress, resumeCursor, certificateEligible, recapQuestion,
    needsRecap: (state, id) => needsRecap(state, id, time),
    Date: Clock, console, structuredClone, document, window,
    localStorage: storePort(storage), sessionStorage: storePort(presentation),
    setTimeout: () => 1, clearTimeout() {},
    crypto: { randomUUID: () => `${String(++uuidCount).padStart(8, '0')}-0000-4000-8000-000000000000` },
    mountShell() {},
    renderShell(view, state, stats, html) {
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
    downloadCertificate: data => downloads.push(clone(data)),
  });
  new vm.Script(controller, { filename: 'core/app.js' }).runInContext(context);
  return {
    get current() { return current; },
    get lesson() { return current.html.args[1]; },
    get recap() { return current.html.args[1]; },
    saved: () => JSON.parse(storage.get(KEY)), storage, presentation, downloads,
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
    readPage(page, courseId = current.state.active) {
      if (deck) deck.dataset.index = String(page);
      window.dispatch('mindora:learn-page', { detail: { courseId, page } });
    },
    leave() { window.dispatch('pagehide'); },
    visible(value) { document.hidden = !value; document.dispatch('visibilitychange'); },
  };
}

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
