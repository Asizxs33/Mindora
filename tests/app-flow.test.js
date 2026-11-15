import { mentorForTopic } from '../core/subject-mentor.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createGuestCourseRequest, BROWSER_GUEST } from '../core/guest-courses.js';
import * as engine from '../core/engine.js';
import * as progress from '../core/progress.js';
import * as budget from '../core/budget-session.js';
import * as learningModel from '../core/learning-plan.js';
import * as assessments from '../core/lesson-assessment.js';
import * as returnReview from '../core/return-review.js';
import * as roadmapModel from '../core/roadmap-model.js';
import * as rewardsModel from '../core/roadmap-rewards.js';
import { createWorkspaceStorage } from '../core/workspace-storage.js';
import { resumeCursor, needsRecap, certificateEligible, RECAP_AFTER_MS } from '../core/resume.js';
import { recapQuestion, builtinReviewContent } from '../ui/recap.js';
import { startTopics } from '../ui/guided-start.js';
import { getStarterCourse, starterCourses } from '../core/starter-courses.js';
import { createPracticeController } from '../core/practice-controller.js';

// Run the real controller and its registered event handlers. Only DOM/rendering,
// file download and account identity are ports; curriculum and resume rules stay real.
// vm.Script avoids experimental VM modules or a DOM package for this small harness.
const controller = readFileSync(new URL('../core/app.js', import.meta.url), 'utf8')
  .replace(/^import .+ from .+;\r?$/gm, '');
const planController = readFileSync(new URL('../core/plan-controller.js', import.meta.url), 'utf8')
  .replace(/^import .+ from .+;\r?$/gm, '').replace('export function createPlanController', 'function createPlanController');
const reviewController = readFileSync(new URL('../ui/return-review.js', import.meta.url), 'utf8')
  .split('export function mountReturnReview')[1];
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

function savedAiCourse() {
  const url = 'https://docs.python.org/3/tutorial/controlflow.html';
  const plan = learningModel.normalizePlan({
    formatVersion: 3, title: 'Python loops', outcome: 'Print every item in a list.',
    steps: Array.from({ length: 3 }, (_, index) => ({
      title: `Loop idea ${index + 1}`, instruction: 'A loop runs once for each item.',
      task: 'Print the names in your own list.', criterion: 'Every name appears once.', sourceUrl: url,
      teaching: {
        why: 'One loop can repeat a useful action.',
        example: { input: "for name in ['Ada', 'Lin']:\n    print(name)", output: 'Ada\nLin', explanation: 'Two names produce two lines.' },
        assessment: { type: 'choice', question: 'How many lines appear?', options: ['One', 'Two', 'Three'], answer: 1, explanation: 'There are two names in the list.' },
        takeaway: 'A loop visits each item once.',
      },
    })),
  }, { goal: 'Learn Python loops', minutes: 10, language: 'en' }, new Map([[url, { url, title: 'Python tutorial' }]]));
  assert.ok(plan);
  return learningModel.restorePlan({ plan, completed: 1, answers: ['Ada\nLin', 'My current draft'], study: [{ page: 3, response: 1, checked: true }, { page: 1 }] });
}

function savedRoadmap(courseId = null) {
  return roadmapModel.restoreRoadmap({
    goal: 'Learn Python', minutes: 5, language: 'en', title: 'Python foundations',
    outcome: 'Write a small program.', level: 'beginner', levelReason: 'Start with the basics.',
    stages: ['Print a message', 'Store a value', 'Repeat an action', 'Build a program']
      .map(title => ({ title, objective: `${title} independently.` })),
    progress: Array.from({ length: 4 }, (_, index) => ({ courseId: index === 0 ? courseId : null, completed: false })),
  });
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

function app(initial, { now = NOW, account = { user: { id: 'test-user' }, profile: null }, storage: priorStorage, realPlans = false, failStorageWrites = false, reconcile = Promise.resolve(), libraryCourses = [], starterCopy = Promise.resolve(true), starterFlush = Promise.resolve(true), stageGeneration = Promise.resolve(true), roadmapResponse, clarificationResponse } = {}) {
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
  const copiedCourses = [], loadedCourses = [], roadmapRequests = [], clarificationRequests = [];
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
    mentorForTopic, ...engine, ...progress, ...budget, ...learningModel, ...assessments, ...returnReview, ...roadmapModel, ...rewardsModel,
    createGuestCourseRequest, BROWSER_GUEST, resumeCursor, certificateEligible, recapQuestion, builtinReviewContent, startTopics, getStarterCourse, starterCourses, createPracticeController,
    needsReturnReview: (lastSeen, learned) => returnReview.needsReturnReview(lastSeen, learned, time),
    languageCode: value => value || 'en', setLanguage() {}, message: value => value, t: value => value,
    createCloudDrafts: () => ({ render() {}, async init() {} }),
    createPlanController: () => ({ screen: () => ({}), reset() {}, async generate(goal, minutes, details) {
      generations.push(clone({ goal, minutes, ...(details ? { context: details } : {}) }));
      if (details?.roadmapStage) {
        if (!await stageGeneration) return false;
        vm.runInContext("state.learningCourse = { id: '12345678-1234-4000-8000-123456789012' }", context);
        return true;
      }
    } }),
    createLearningLibrary: hooks => ({
      screen: () => ({ user: account.user, courses: libraryCourses }),
      async setUser() { await reconcile; return true; }, changed() {}, async flush() { return starterFlush; },
      async importLocal(saved) {
        const owner = account.user?.id || BROWSER_GUEST;
        copiedCourses.push(clone(saved));
        if (!await starterCopy) return false;
        const course = { id: `ready-${copiedCourses.length}`, revision: 1, updatedAt: new Date(time).toISOString(), saved: clone(saved) };
        hooks.setCurrent(course, owner);
        return true;
      },
      async load(id) {
        loadedCourses.push(id);
        const course = libraryCourses.find(item => item.id === id);
        if (!course?.saved) return false;
        hooks.setCurrent(course, account.user?.id || BROWSER_GUEST);
        return true;
      },
    }),
    createBuiltinSync: () => ({ screen: () => ({}), async setUser() { return true; }, changed() {}, async flush() { return true; } }),
    learningLibraryView: () => '', learningSyncView: () => '', loginRequiredView: () => '',
    createWorkspaceStorage,
    showWorkspaceConflict() { conflictNotice = true; },
    learningPlanView: screen('learning-plan'),
    roadmapView: screen('roadmap'), rewardsView: () => '',
    needsRecap: (state, id) => needsRecap(state, id, time),
    Date: Clock, console, structuredClone, document, window,
    AbortSignal: { timeout: () => undefined },
    FormData: class { constructor(form) { this.fields = form.fields; } get(name) { return this.fields[name] ?? null; } },
    fetch: async (url, options) => {
      if (url === '/api/learning-roadmap') {
        const body = JSON.parse(options.body);
        if (body.action === 'clarify') {
          clarificationRequests.push(body);
          if (clarificationResponse) return clarificationResponse(body);
          return { ok: true, json: async () => ({ clarification: {
            question: 'What would you like to make?',
            directions: [
              { title: 'Use formulas in a report', goal: 'Build a small spreadsheet report', diagnosticQuestion: 'A1 is 2 and A2 is 3. What does SUM(A1:A2) return, and why?' },
              { title: 'Plan a budget', goal: 'Create a monthly spreadsheet budget', diagnosticQuestion: 'A budget is 100 and spending is 30. How much remains, and why?' },
              { title: 'Track a project', goal: 'Track deadlines in a spreadsheet', diagnosticQuestion: 'Why should each task have a date in its own column?' },
            ],
          } }) };
        }
        roadmapRequests.push(body);
        return { ok: true, json: async () => ({ roadmap: roadmapResponse }) };
      }
      return { ok: true, json: async () => ({ review: { observation: 'Your result is complete.', nextAction: 'Try another example.' } }) };
    },
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
    phoneCourseLibrary: screen('course-library'), courseHomeView: screen('course-home'), readyCoursesView: () => '', coursesPage: screen('courses'), sidePage: screen('side'),
    membershipView: screen('membership'), guidedStartView: screen('guided-start'), quietHomeView: screen('quiet-home'), returnReviewView: screen('return-review'),
    pathView: screen('path'), lesson: screen('lesson'), result: screen('result'), workView: screen('work'),
    recapView: screen('recap'), certificateView: screen('certificate'),
    refreshCertificatePreview() {},
    courseNames: { design: 'Your first poster', budget: 'Everyday spreadsheets' },
    lessonNames: { design: ['Design intro', 'Design check', 'Design practice', 'Design project'], budget: ['Formula intro', 'Formula check', 'Formula practice', 'Formula project'] },
    dialogContent: () => '', resetWorkCheck() {}, refreshPosterPreview() {}, clearBudgetTotal() {},
    // These tests use the real spreadsheet evaluator. Poster layout/export is a separate tested subsystem.
    posterLayout() { throw new Error('Unexpected poster layout call in controller-flow test'); },
    posterSvg() { throw new Error('Unexpected poster download call in controller-flow test'); },
    getAccountState: () => clone(account),
    openAccount() { accountOpens++; }, closeAccount() {}, expireAccountSession() { account.user = null; window.dispatch('mindora:account-changed'); },
    downloadCertificate: data => downloads.push(clone(data)),
  });
  new vm.Script(`function mountReturnReview${reviewController}`, { filename: 'ui/return-review.js' }).runInContext(context);
  if (realPlans) new vm.Script(planController, { filename: 'core/plan-controller.js' }).runInContext(context);
  new vm.Script(controller, { filename: 'core/app.js' }).runInContext(context);
  return {
    get current() { return current; },
    get lesson() { return current.html.args[1]; },
    get recap() { return current.html.args[1]; },
    get review() { return current.state.returnReview; },
    get reloads() { return reloads; },
    get conflictNotice() { return conflictNotice; },
    get accountOpens() { return accountOpens; },
    saved: () => JSON.parse(storage.get(KEY)), storage, presentation, downloads,
    generations, copiedCourses, loadedCourses, roadmapRequests, clarificationRequests,
    signIn(user, reason) { account.user = user; window.dispatch('mindora:account-changed', { detail: { reason } }); },
    answerRoadmap(fields) { document.dispatch('submit', { target: { id: 'roadmap-form', fields } }); },
    startGoal(goal, minutes) {
      const input = node(); input.value = goal; elements.set('#goal-input', input);
      const select = node(); select.value = String(minutes); elements.set('#time-select', select);
      document.dispatch('submit', { target: { id: 'goal-form' } });
    },
    element: selector => elements.get(selector),
    advance(ms) { time += ms; },
    click(dataset, { disabled = false, attributes = [] } = {}) {
      const target = { dataset, disabled,
        closest: selector => selector.includes('[data-return-') && !Object.keys(dataset).some(key => key.startsWith('return')) ? null : target,
        matches: selector => selector === '[data-home]' && attributes.includes('data-home'),
        hasAttribute: name => attributes.includes(name) || (name === 'data-return-choice' && dataset.returnChoice !== undefined),
      };
      document.dispatch('click', { target });
    },
    input(id, value, dataset = {}) {
      const target = elements.get(`#${id}`) || node();
      Object.assign(target, { id, value, dataset, closest: selector => selector === '#main' ? elements.get('#main') : null });
      document.dispatch('input', { target });
    },
    change(id, value) { document.dispatch('change', { target: { id, value, dataset: {} } }); },
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

test('guests can start a built-in course without opening an account', () => {
  const run = app(seed({ active: null }), { account: { user: null, profile: null } });
  run.click({ course: 'budget' });
  assert.equal(run.current.view, 'path');
  assert.equal(run.accountOpens, 0);
  assert.equal(run.current.state.guestLearning, true);
  assert.equal(run.current.state.active, 'budget');
});

test('a first visit asks one thing at a time, then clarifies the selected goal before creating a course', async () => {
  const run = app(seed({ active: null }), { account: { user: null, profile: null } });
  assert.equal(run.current.view, 'discover');
  assert.equal(run.current.html.kind, 'guided-start');
  assert.equal(run.current.html.args[0].step, 0);
  run.click({ introAction: 'next' });
  assert.equal(run.current.html.args[0].step, 1);
  run.click({ introAction: 'next' });
  assert.equal(run.current.html.args[0].step, 1, 'the required name cannot be skipped');
  run.input('intro-name', 'Aida');
  run.click({ introAction: 'next' });
  assert.equal(run.current.html.args[0].step, 2);
  run.click({ introTopic: 'design' });
  run.click({ introAction: 'next' });
  assert.equal(run.current.html.args[0].step, 3);
  run.click({ introMinutes: '5' });
  run.click({ introAction: 'start' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.accountOpens, 0);
  assert.equal(run.current.view, 'roadmap', 'welcome choices start personalized course setup');
  assert.equal(run.current.html.kind, 'roadmap');
  assert.equal(run.current.html.args[0].wizard.originalGoal, 'Design a clear poster');
  assert.equal(run.current.html.args[0].wizard.minutes, 5);
  assert.equal(run.current.html.args[0].wizard.directionConfirmed, false);
  assert.equal(run.current.state.minutes, 5);
  assert.deepEqual(run.clarificationRequests, [{ action: 'clarify', goal: 'Design a clear poster', minutes: 5, language: 'en' }]);
  assert.deepEqual(run.roadmapRequests, [], 'the course waits for purpose and experience answers');
  assert.deepEqual(run.copiedCourses, [], 'welcome does not silently substitute a short ready course');
  assert.deepEqual(run.generations, []);
});

test('a ready mini-course creates one account copy and opens its path without AI generation', async () => {
  let finishCopy;
  const starterCopy = new Promise(resolve => { finishCopy = resolve; });
  const run = app(seed({ active: null, language: 'kk' }), { realPlans: true, starterCopy });
  run.click({ starterCourse: 'python-basics' });
  run.click({ starterCourse: 'python-basics' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.copiedCourses.length, 1, 'double clicks cannot create parallel copies');
  assert.deepEqual(run.copiedCourses[0], getStarterCourse('python-basics', 'kk', 10));
  finishCopy(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.generations, []);
  assert.equal(run.current.view, 'course-path');
  assert.equal(run.current.html.kind, 'quiet-home');
  assert.equal(run.current.state.learningPlan.completed, 0);
  assert.equal(run.current.state.learningCourse.ownerId, 'test-user');
  assert.equal(run.current.state.lastLearningType, 'ai');
  run.click({ view: 'profile' });
  run.click({ view: 'my-path' });
  assert.equal(run.current.view, 'course-path');
  assert.equal(run.current.html.kind, 'quiet-home', 'My path reopens the ready course map');
  run.click({ view: 'learning-plan' });
  assert.equal(run.current.view, 'learning-plan');
});

test('catalog built-in cards open the same roadmap and retain the selected pace', () => {
  const run = app(seed({ minutes: 20, learningPlan: savedAiCourse() }));
  run.click({ course: 'budget' }, { attributes: ['data-course-path'] });
  assert.equal(run.current.view, 'builtin-path');
  assert.equal(run.current.html.kind, 'quiet-home');
  assert.equal(run.current.state.active, 'budget');
  assert.equal(run.current.state.lastLearningType, 'builtin');
  assert.equal(run.current.state.pathKind, 'builtin');
  assert.equal(run.current.state.minutes, 20);
  assert.ok(run.current.state.learningPlan, 'the previous AI course remains saved');
});

test('choosing an existing ready mini-course loads the saved copy without clearing progress or draft', async () => {
  const saved = getStarterCourse('clear-writing', 'en');
  saved.completed = 1;
  saved.answers = ['My completed first exercise.', 'My unfinished independent draft.'];
  const course = { id: 'my-writing-course', revision: 3, updatedAt: new Date(NOW).toISOString(), saved,
    title: saved.plan.title, goal: saved.plan.goal, language: saved.plan.language, minutes: saved.plan.minutes };
  const run = app(seed({ active: null, minutes: 5 }), { realPlans: true, libraryCourses: [course] });
  run.click({ starterCourse: 'clear-writing' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.copiedCourses, []);
  assert.deepEqual(run.loadedCourses, ['my-writing-course']);
  assert.equal(run.current.view, 'course-path');
  assert.equal(run.current.state.learningPlan.completed, 1);
  assert.equal(run.current.state.learningPlan.answers[1], saved.answers[1]);
});

test('duration selection creates distinct mini-courses and resumes the matching saved duration', async () => {
  for (const minutes of [5, 10, 20]) {
    const saved = getStarterCourse('python-basics', 'en', minutes);
    saved.completed = 1;
    saved.answers[0] = 'print("My completed exercise")';
    saved.answers[1] = 'My unfinished task';
    saved.study[1].page = minutes === 5 ? 0 : 1;
    const shorter = getStarterCourse('python-basics', 'en', minutes === 5 ? 10 : 5);
    const summary = (id, saved) => ({ id, saved, title: saved.plan.title, goal: saved.plan.goal,
      language: saved.plan.language, minutes: saved.plan.minutes, revision: 1 });
    const run = app(seed({ active: null, minutes: 10 }), { realPlans: true,
      libraryCourses: [summary('other-duration', shorter), summary('matching-duration', saved)] });
    run.click({ view: 'courses' });
    run.click({ courseMinutes: String(minutes) });
    run.click({ starterCourse: 'python-basics' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(run.loadedCourses, ['matching-duration']);
    assert.deepEqual(run.copiedCourses, []);
    assert.equal(run.current.state.learningPlan.plan.minutes, minutes);
    assert.equal(run.current.state.learningPlan.completed, 1);
    assert.equal(run.current.state.learningPlan.answers[1], 'My unfinished task');
    assert.equal(run.current.state.learningPlan.study[1].page, saved.study[1].page);
    const resumed = app(null, { storage: run.storage, realPlans: true });
    resumed.click({ view: 'learning-plan' });
    assert.equal(resumed.current.state.learningPlan.plan.minutes, minutes);
    assert.equal(resumed.current.state.learningPlan.completed, 1);
    assert.equal(resumed.current.state.learningPlan.study[1].page, saved.study[1].page);
  }
});

test('a new duration keeps the old saved course and survives account restoration', async () => {
  const saved = getStarterCourse('ai-prompts', 'en', 5);
  const course = { id: 'five-minutes', saved, title: saved.plan.title, goal: saved.plan.goal,
    language: saved.plan.language, minutes: 5, revision: 1 };
  const run = app(seed({ active: null, minutes: 5, learningPlan: saved }), { realPlans: true, libraryCourses: [course] });
  run.click({ view: 'courses' });
  run.click({ courseMinutes: '20' });
  assert.equal(run.current.state.learningPlan.plan.minutes, 5, 'changing preference never rewrites an existing lesson');
  run.click({ starterCourse: 'ai-prompts' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.copiedCourses[0].plan.minutes, 20);
  assert.deepEqual(run.loadedCourses, []);
  assert.equal(course.saved.plan.minutes, 5);

  for (const reason of [undefined, 'signup-complete']) {
    const guest = app(seed({ minutes: 5 }), { account: { user: null }, realPlans: true });
    guest.click({ view: 'courses' });
    guest.click({ courseMinutes: '20' });
    guest.click({ starterCourse: 'ai-prompts' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(guest.accountOpens, 0);
    assert.equal(guest.copiedCourses[0].plan.minutes, 20, 'selected duration is used by the browser guest course');
  }
});

test('signout opens the greeting and signing back in retains the exact lesson', async () => {
  const saved = savedAiCourse();
  const run = app(seed({ learningPlan: saved }), { realPlans: true });
  run.signIn(null, 'signout');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.view, 'discover');
  assert.equal(run.current.html.kind, 'guided-start');
  assert.equal(run.current.html.args[0].step, 0);
  assert.equal(run.current.state.learningPlan, null);
  run.signIn({ id: 'test-user' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.html.kind, 'quiet-home');
  assert.deepEqual(run.current.state.learningPlan, saved);
});

test('ready mini-course opens without an account and an unsuccessful save keeps prior work', async () => {
  const guest = app(seed(), { account: { user: null, profile: null } });
  guest.click({ starterCourse: 'everyday-english' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(guest.accountOpens, 0);
  assert.equal(guest.copiedCourses.length, 1);
  const existing = savedAiCourse();
  const run = app(seed({ learningPlan: existing }), { realPlans: true, starterCopy: Promise.resolve(false) });
  run.click({ starterCourse: 'ai-prompts' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.view, 'courses');
  assert.deepEqual(run.current.state.learningPlan, existing);
  assert.deepEqual(run.generations, []);
});

test('a new starter cannot replace progress after a failed save or a changed account during saving', async () => {
  const saved = savedAiCourse();
  const run = app(seed({ learningPlan: saved }), { realPlans: true, starterFlush: Promise.resolve(false) });
  run.click({ view: 'courses' });
  run.click({ starterCourse: 'python-basics' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.copiedCourses, []);
  assert.deepEqual(run.current.state.learningPlan, saved);
  assert.equal(run.current.view, 'courses');
  let finishSaving;
  const pending = app(seed({ learningPlan: saved }), { realPlans: true,
    starterFlush: new Promise(resolve => { finishSaving = resolve; }) });
  pending.click({ view: 'courses' });
  pending.click({ starterCourse: 'python-basics' });
  pending.signIn({ id: 'another-user' });
  await new Promise(resolve => setImmediate(resolve));
  finishSaving(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(pending.copiedCourses, []);
  assert.equal(pending.current.state.learningPlan, null);
});

test('a starter copy finishing after account switch cannot replace the next account workspace', async () => {
  let finishCopy;
  const starterCopy = new Promise(resolve => { finishCopy = resolve; });
  const run = app(seed({ active: null }), { realPlans: true, starterCopy });
  run.click({ starterCourse: 'ai-prompts' });
  await new Promise(resolve => setImmediate(resolve));
  run.signIn({ id: 'second-user' });
  await new Promise(resolve => setImmediate(resolve));
  finishCopy(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.state.learningPlan, null);
  assert.equal(run.current.state.learningCourse, undefined);
  assert.equal(run.current.html.kind, 'course-home');
});

test('a guest goal opens the personal roadmap setup without registration or eager lesson generation', async () => {
  const run = app(seed({ active: null }), { account: { user: null, profile: null } });
  run.startGoal('Learn to use ChatGPT', 20);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.accountOpens, 0);
  assert.deepEqual(run.generations, []);
  assert.equal(run.current.view, 'roadmap');
  assert.equal(run.current.html.args[0].wizard.originalGoal, 'Learn to use ChatGPT');
  assert.equal(run.current.html.args[0].wizard.minutes, 20);
});

test('an explicitly requested roadmap builds a personalized path and starts only its unlocked stage', async () => {
  const roadmapResponse = {
    title: 'Write useful spreadsheet formulas', outcome: 'Build a small report with formulas.', level: 'intermediate',
    levelReason: 'You already write SUM formulas.',
    stages: [
      { title: 'Use SUMIF', objective: 'Sum values that match a named category.' },
      { title: 'Use COUNTIF', objective: 'Count records that match the category.' },
      { title: 'Compare summaries', objective: 'Compare categories in a weekly report.' },
      { title: 'Build a report', objective: 'Create and verify a new report independently.' },
    ],
  };
  const run = app(seed(), { account: { user: null, profile: null }, roadmapResponse });
  run.signIn({ id: 'new-learner' }, 'signup-complete');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.view, 'discover', 'signup opens the simple course home');
  assert.equal(run.current.html.kind, 'course-home');
  run.click({ roadmapAction: 'setup' });
  assert.equal(run.current.view, 'roadmap');
  assert.equal(run.current.html.args[0].wizard.step, 0);
  run.answerRoadmap({ goal: 'I want to learn spreadsheet formulas' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.clarificationRequests[0].goal, 'I want to learn spreadsheet formulas');
  assert.equal(run.current.html.args[0].wizard.directionConfirmed, false);
  run.answerRoadmap({ direction: '0' });
  run.answerRoadmap({ experience: 'some', evidence: 'I know SUM.', diagnosticAnswer: '5, because SUM adds the two cells.' });
  run.answerRoadmap({ motivation: 'work' });
  run.answerRoadmap({ minutes: '10' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.roadmapRequests[0].evidence, 'I know SUM.');
  assert.equal(run.roadmapRequests[0].goal, 'Build a small spreadsheet report');
  assert.equal(run.roadmapRequests[0].originalGoal, 'I want to learn spreadsheet formulas');
  assert.equal(run.roadmapRequests[0].diagnosticAnswer, '5, because SUM adds the two cells.');
  assert.match(run.roadmapRequests[0].diagnosticQuestion, /SUM/);
  assert.equal(run.current.html.args[0].roadmap.level, 'intermediate');
  assert.equal(run.current.html.args[0].roadmap.originalGoal, 'I want to learn spreadsheet formulas');
  assert.deepEqual(run.current.html.args[0].active.map(stage => stage.status), ['ready', 'locked', 'locked', 'locked']);
  run.click({ roadmapAction: 'start', roadmapStage: '0' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.generations[0].context.roadmapStage.level, 'intermediate');
  assert.equal(run.generations[0].context.roadmapStage.originalGoal, 'I want to learn spreadsheet formulas');
  assert.equal(run.generations[0].context.roadmapStage.objective, roadmapResponse.stages[0].objective);
  assert.deepEqual(run.generations[0].context.roadmapStage.previousStages, []);
  assert.equal(run.current.view, 'learning-plan');
});

test('signing into an account keeps the guest goal in its separate browser workspace', async () => {
  const run = app(seed({ active: null }), { account: { user: null, profile: null } });
  run.startGoal('Learn to use spreadsheets', 10);
  assert.equal(run.accountOpens, 0);
  run.signIn({ id: 'member' }, 'signup-complete');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.state.guestLearning, undefined);
  run.signIn(null, 'signout');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.state.guestLearning, true);
});

test('clarification failure retains the topic and allows a retry before any course is generated', async () => {
  let reject, attempt = 0;
  const pending = new Promise((resolve, fail) => { reject = fail; });
  const clarification = {
    question: 'Choose a useful result',
    directions: ['list', 'calculator', 'report'].map(title => ({ title, goal: `Build a Python ${title}`, diagnosticQuestion: `What could a ${title} help you do? Give one example.` })),
  };
  const run = app(seed(), { clarificationResponse: async () => {
    if (++attempt === 1) await pending;
    return { ok: true, json: async () => ({ clarification }) };
  } });
  await new Promise(resolve => setImmediate(resolve));
  run.startGoal('Python', 5);
  assert.equal(run.current.html.args[0].wizard.originalGoal, 'Python');
  assert.equal(run.current.html.args[0].busy, 'clarify');
  reject(new Error('Network unavailable'));
  await new Promise(resolve => setImmediate(resolve));
  assert.match(run.current.html.args[0].error, /topic is saved/);
  assert.equal(run.current.html.args[0].wizard.goal, 'Python');
  run.answerRoadmap({});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.clarificationRequests.map(item => item.goal), ['Python', 'Python']);
  assert.deepEqual(run.current.html.args[0].wizard.clarification, clarification);
  assert.deepEqual(run.roadmapRequests, []);
  run.answerRoadmap({ direction: '0' });
  run.answerRoadmap({ experience: 'new', diagnosticUnknown: 'on' });
  assert.equal(run.current.html.args[0].wizard.step, 2, 'a beginner can honestly skip the starting check');
});

test('changing the chosen focus clears an answer to the old diagnostic', async () => {
  const run = app(seed());
  await new Promise(resolve => setImmediate(resolve));
  run.startGoal('Spreadsheets', 10);
  await new Promise(resolve => setImmediate(resolve));
  run.answerRoadmap({ direction: '0' });
  run.answerRoadmap({ experience: 'some', diagnosticAnswer: '5' });
  run.click({ roadmapAction: 'back' });
  run.click({ roadmapAction: 'back' });
  run.answerRoadmap({ direction: '1' });
  assert.equal(run.current.html.args[0].wizard.goal, 'Create a monthly spreadsheet budget');
  assert.equal(run.current.html.args[0].wizard.diagnosticAnswer, '');
  assert.equal(run.current.html.args[0].wizard.diagnosticUnknown, false);
  assert.match(run.current.html.args[0].wizard.diagnosticQuestion, /100/);
});

test('a guest introduction clarifies a spreadsheet learning goal without signup', async () => {
  const run = app(seed({ active: null }), { account: { user: null, profile: null } });
  run.click({ introAction: 'next' });
  run.input('intro-name', 'Aida');
  run.click({ introAction: 'next' });
  run.click({ introTopic: 'budget' });
  run.click({ introAction: 'next' });
  run.click({ introMinutes: '20' });
  run.click({ introAction: 'start' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.accountOpens, 0);
  assert.equal(run.current.view, 'roadmap');
  assert.equal(run.current.html.args[0].wizard.originalGoal, 'Track everyday expenses in a spreadsheet');
  assert.equal(run.current.html.args[0].wizard.minutes, 20);
  assert.equal(run.clarificationRequests[0].goal, 'Track everyday expenses in a spreadsheet');
  assert.deepEqual(run.generations, []);
  assert.deepEqual(run.roadmapRequests, []);
  assert.equal(run.current.state.minutes, 20);
});

test('English and custom welcome choices both clarify a personal goal before building a full course', async () => {
  for (const topic of ['english', 'custom']) {
    const run = app(seed({ active: null }), { realPlans: true });
    run.click({ introAction: 'new' });
    run.click({ introTopic: topic });
    if (topic === 'custom') run.input('intro-goal', 'Learn to draw a landscape');
    run.click({ introAction: 'next' });
    run.click({ introMinutes: '20' });
    run.click({ introAction: 'start' });
    await new Promise(resolve => setImmediate(resolve));
    const goal = topic === 'english' ? 'Practise everyday English conversations' : 'Learn to draw a landscape';
    assert.equal(run.current.view, 'roadmap');
    assert.equal(run.current.html.args[0].wizard.originalGoal, goal);
    assert.equal(run.current.html.args[0].wizard.minutes, 20);
    assert.equal(run.current.html.args[0].wizard.directionConfirmed, false);
    assert.deepEqual(run.clarificationRequests, [{ action: 'clarify', goal, minutes: 20, language: 'en' }]);
    assert.deepEqual(run.roadmapRequests, [], 'the level diagnostic precedes full course generation');
    assert.deepEqual(run.copiedCourses, []);
    assert.deepEqual(run.generations, []);
  }
});

test('a saved roadmap stays selected on the home path and opens without its setup wizard', () => {
  const roadmap = savedRoadmap();
  const run = app(seed({ learningPlan: savedAiCourse(), learningRoadmap: roadmap }), { realPlans: true });
  run.click({ view: 'roadmap' });
  assert.equal(run.saved().lastLearningType, 'roadmap');
  run.click({ roadmapAction: 'setup' });
  assert.equal(run.current.view, 'membership');
  assert.deepEqual(run.roadmapRequests, []);
  run.click({ view: 'discover' });
  assert.equal(run.current.html.kind, 'roadmap');
  assert.equal(run.current.html.args[0].roadmap.title, roadmap.title);
  run.click({ view: 'my-path' });
  assert.equal(run.current.html.kind, 'roadmap');
  assert.equal(run.current.html.args[0].wizard, null, 'home shows the saved path rather than an unfinished setup form');
  const reloaded = app(null, { storage: run.storage, realPlans: true });
  assert.equal(reloaded.current.html.kind, 'roadmap');
  reloaded.click({ view: 'my-path' });
  assert.equal(reloaded.current.html.kind, 'roadmap');
  assert.deepEqual(reloaded.current.html.args[0].roadmap, roadmap);
  assert.equal(reloaded.current.html.args[0].wizard, null);
  const roadmapOnly = app(seed({ active: null, learningRoadmap: roadmap }));
  assert.equal(roadmapOnly.current.html.args[0].roadmap.title, roadmap.title, 'an account with only a roadmap still has a usable home');
});

test('an existing roadmap stage resumes the saved lesson and draft without another generation', async () => {
  const id = '12345678-1234-4000-8000-123456789012';
  const saved = savedAiCourse();
  const course = { id, revision: 3, saved, updatedAt: new Date(NOW).toISOString() };
  const run = app(seed({ learningRoadmap: savedRoadmap(id) }), { realPlans: true, libraryCourses: [course] });
  run.click({ view: 'roadmap' });
  run.click({ roadmapAction: 'start', roadmapStage: '0' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.loadedCourses, [id]);
  assert.deepEqual(run.generations, []);
  assert.equal(run.current.view, 'learning-plan');
  assert.equal(run.current.state.learningPlan.completed, 1);
  assert.equal(run.current.state.learningPlan.answers[1], 'My current draft');
  assert.equal(run.current.state.learningPlan.study[1].page, 1);
  assert.equal(run.saved().lastLearningType, 'roadmap');
  run.click({ view: 'discover' });
  assert.equal(run.current.html.args[0].roadmap.title, savedRoadmap().title);
  const reloaded = app(null, { storage: run.storage, realPlans: true, libraryCourses: [course] });
  assert.equal(reloaded.current.html.kind, 'roadmap', 'reopening the app shows the same parent course');
  reloaded.click({ action: 'resume-current' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reloaded.current.view, 'learning-plan', 'the stage button on restored home must actually open the lesson');
  assert.deepEqual(reloaded.loadedCourses, [id]);
  assert.equal(reloaded.current.state.learningPlan.answers[1], 'My current draft');
});

test('a stage tapped during account hydration opens once with its saved checkpoint', async () => {
  let finish;
  const reconcile = new Promise(resolve => { finish = resolve; });
  const id = '12345678-1234-4000-8000-123456789012';
  const course = { id, revision: 3, saved: savedAiCourse(), updatedAt: new Date(NOW).toISOString() };
  const storage = new Map([[KEY, JSON.stringify(seed({ learningRoadmap: savedRoadmap(id) }))]]);
  const run = app(null, { account: { user: null, profile: null }, storage, reconcile, realPlans: true, libraryCourses: [course] });
  run.signIn({ id: 'test-user' });
  assert.equal(run.current.html.kind, 'roadmap');
  run.click({ roadmapAction: 'start', roadmapStage: '0' });
  run.click({ roadmapAction: 'start', roadmapStage: '0' });
  assert.deepEqual(run.loadedCourses, [], 'wait for the account before loading the course');
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.loadedCourses, [id], 'rapid taps queue only one resume');
  assert.deepEqual(run.generations, []);
  assert.equal(run.current.view, 'learning-plan');
  assert.equal(run.current.state.learningPlan.completed, 1);
  assert.equal(run.current.state.learningPlan.answers[1], 'My current draft');
  assert.equal(run.current.state.learningPlan.study[1].page, 1);
});

test('a queued stage tap does not override navigation or an account change', async () => {
  for (const leave of [run => run.click({ view: 'profile' }), run => run.signIn({ id: 'another-user' })]) {
    let finish;
    const reconcile = new Promise(resolve => { finish = resolve; });
    const id = '12345678-1234-4000-8000-123456789012';
    const storage = new Map([[KEY, JSON.stringify(seed({ learningRoadmap: savedRoadmap(id) }))]]);
    const run = app(null, { account: { user: null, profile: null }, storage, reconcile });
    run.signIn({ id: 'test-user' });
    run.click({ roadmapAction: 'start', roadmapStage: '0' });
    leave(run);
    const destination = run.current.view;
    finish();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(run.loadedCourses, []);
    assert.deepEqual(run.generations, []);
    assert.equal(run.current.view, destination);
  }
});

test('the next generated stage receives only prior completed stage objectives', async () => {
  const roadmap = savedRoadmap('12345678-1234-4000-8000-123456789011');
  roadmap.originalGoal = 'Python';
  roadmap.goal = 'Write a small calculator';
  roadmap.progress[0].completed = true;
  const run = app(seed({ learningRoadmap: roadmap }));
  await new Promise(resolve => setImmediate(resolve));
  run.click({ view: 'roadmap' });
  run.click({ roadmapAction: 'start', roadmapStage: '1' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(run.generations[0].context.roadmapStage.previousStages, [roadmap.stages[0]]);
  assert.equal(run.generations[0].context.roadmapStage.title, roadmap.stages[1].title);
  assert.equal(run.generations[0].context.roadmapStage.originalGoal, 'Python');
  assert.equal(run.saved().learningRoadmap.originalGoal, 'Python');
});

test('a large course lazily generates a later module lesson and reopens each saved lesson independently', async () => {
  for (const index of [4, 11]) {
    const previousId = stage => `20000000-0000-4000-8000-${String(stage + 1).padStart(12, '0')}`;
    const roadmap = roadmapModel.restoreRoadmap({
      ...savedRoadmap(), curriculumVersion: 2, originalGoal: 'Python',
      modules: Array.from({ length: 6 }, (_, module) => ({ title: `Module ${module + 1}`, outcome: `Apply skill group ${module + 1}.`, startIndex: module * 4, count: 4 })),
      stages: Array.from({ length: 24 }, (_, stage) => ({ title: `Python skill ${stage + 1}`, objective: `Produce and verify result ${stage + 1}.` })),
      sourceStatus: 'unavailable', sources: [],
      progress: Array.from({ length: 24 }, (_, stage) => ({ courseId: stage < index ? previousId(stage) : null, completed: stage < index })),
    });
    assert.ok(roadmap);
    const run = app(seed({ learningRoadmap: roadmap, lastLearningType: 'roadmap' }));
    await new Promise(resolve => setImmediate(resolve));
    run.click({ view: 'my-path' });
    assert.deepEqual(run.generations, [], 'opening a syllabus does not generate all its lessons');
    for (const blocked of ['24', '99', '-1', '04']) run.click({ roadmapAction: 'start', roadmapStage: blocked });
    assert.deepEqual(run.generations, [], 'invalid stage indices cannot generate a lesson');
    run.click({ roadmapAction: 'start', roadmapStage: String(index) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(run.generations.length, 1);
    const context = run.generations[0].context.roadmapStage;
    assert.equal(context.title, roadmap.stages[index].title);
    assert.equal(context.originalGoal, 'Python');
    assert.deepEqual(context.previousStages, roadmap.stages.slice(index - 3, index), 'only the last three completed lessons enter the new lesson context');
    const savedPath = run.saved().learningRoadmap;
    const courseId = savedPath.progress[index].courseId;
    assert.ok(courseId);
    assert.deepEqual(savedPath.progress.slice(0, index), roadmap.progress.slice(0, index));
    assert.ok(savedPath.progress.slice(index + 1).every(stage => stage.courseId === null), 'later lessons remain ungenerated');

    const currentSaved = savedAiCourse();
    currentSaved.answers[1] = `Draft for lesson ${index + 1}`;
    const priorSaved = savedAiCourse();
    priorSaved.answers[1] = 'Independent draft from an earlier module';
    const libraryCourses = [
      { id: courseId, revision: 1, saved: currentSaved, updatedAt: new Date(NOW).toISOString() },
      { id: previousId(2), revision: 2, saved: priorSaved, updatedAt: new Date(NOW).toISOString() },
    ];
    const reopened = app(null, { storage: run.storage, realPlans: true, libraryCourses });
    await new Promise(resolve => setImmediate(resolve));
    reopened.click({ view: 'my-path' });
    reopened.click({ roadmapAction: 'start', roadmapStage: String(index) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(reopened.current.view, 'learning-plan');
    assert.equal(reopened.current.state.learningPlan.answers[1], currentSaved.answers[1]);
    reopened.click({ view: 'my-path' });
    reopened.click({ roadmapAction: 'start', roadmapStage: '2' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(reopened.current.state.learningPlan.answers[1], priorSaved.answers[1]);
    assert.deepEqual(reopened.loadedCourses, [courseId, previousId(2)]);
    assert.deepEqual(reopened.generations, [], 'reopening either saved lesson must not generate a replacement');
    assert.equal(reopened.saved().learningRoadmap.progress[index].courseId, courseId);
  }
});

test('opening an archived roadmap preserves the other path and reloads the selected path', () => {
  const first = { ...savedRoadmap('12345678-1234-4000-8000-123456789011'), id: '12345678-1234-4000-8000-123456789001' };
  first.progress[0].completed = true;
  const second = { ...savedRoadmap('12345678-1234-4000-8000-123456789012'), id: '12345678-1234-4000-8000-123456789002', title: 'Another learning path' };
  const run = app(seed({ learningRoadmap: first, learningRoadmaps: [second] }));
  run.click({ learningRoadmap: second.id });
  assert.equal(run.current.view, 'roadmap');
  assert.equal(run.saved().learningRoadmap.id, second.id);
  assert.deepEqual(run.saved().learningRoadmaps, [first]);
  const reloaded = app(null, { storage: run.storage });
  assert.equal(reloaded.current.html.args[0].roadmap.title, second.title);
  reloaded.click({ view: 'my-path' });
  assert.equal(reloaded.current.html.kind, 'roadmap');
  assert.equal(reloaded.current.html.args[0].roadmap.id, second.id);
  assert.deepEqual(reloaded.current.state.learningRoadmaps, [first]);
});

test('a library lesson opens its archived parent path before resuming the same lesson', async () => {
  const id = '12345678-1234-4000-8000-123456789012';
  const parent = { ...savedRoadmap(id), id: '12345678-1234-4000-8000-123456789002' };
  const current = { ...savedRoadmap(), id: '12345678-1234-4000-8000-123456789001' };
  const course = { id, revision: 2, saved: savedAiCourse(), updatedAt: new Date(NOW).toISOString() };
  const run = app(seed({ learningRoadmap: current, learningRoadmaps: [parent] }), { realPlans: true, libraryCourses: [course] });
  run.click({ learningOpen: id });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.view, 'roadmap');
  assert.equal(run.saved().learningRoadmap.id, parent.id);
  assert.deepEqual(run.loadedCourses, [], 'the library first shows the owning path');
  run.click({ roadmapAction: 'start', roadmapStage: '0' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.view, 'learning-plan');
  assert.deepEqual(run.loadedCourses, [id]);
  assert.equal(run.current.state.learningPlan.answers[1], 'My current draft');
  assert.equal(run.current.state.learningRoadmaps[0].id, current.id);
});

for (const succeeds of [true, false]) test(`a roadmap request settling on home clears busy controls (${succeeds ? 'success' : 'retry'})`, async () => {
  let finish;
  const stageGeneration = new Promise(resolve => { finish = resolve; });
  const run = app(seed({ learningRoadmap: savedRoadmap(), lastLearningType: 'roadmap' }), { stageGeneration });
  run.click({ view: 'my-path' });
  run.click({ roadmapAction: 'start', roadmapStage: '0' });
  assert.equal(run.current.html.args[0].busy, 'stage');
  run.click({ view: 'discover' });
  assert.equal(run.current.html.kind, 'roadmap');
  assert.equal(run.current.html.args[0].busy, 'stage');
  finish(succeeds);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.view, 'discover', 'a completed request never steals navigation');
  run.click({ view: 'my-path' });
  assert.equal(run.current.html.kind, 'roadmap');
  assert.equal(Boolean(run.current.html.args[0].busy), false);
  if (succeeds) assert.equal(run.current.html.args[0].active[0].status, 'active');
  else assert.match(run.current.html.args[0].error, /Try again/);
});

test('real lesson checks apply hearts and correct-answer rewards once per checked response', () => {
  const id = '12345678-1234-4000-8000-123456789012';
  const saved = savedAiCourse();
  saved.completed = 0;
  saved.study[0] = { ...saved.study[0], page: 2, response: null, checked: false };
  const run = app(seed({ learningPlan: saved, learningCourse: { id, ownerId: 'test-user' } }), { realPlans: true });
  run.click({ view: 'learning-plan' });
  run.click({ learningChoice: '0' });
  run.click({ learningPage: 'check' });
  assert.equal(run.saved().learningRewards.hearts, 4);
  run.click({ learningPage: 'check' });
  assert.equal(run.saved().learningRewards.hearts, 4, 'repeating the checked response is not another penalty');
  run.click({ learningChoice: '1' });
  run.click({ learningPage: 'check' });
  assert.equal(run.saved().learningRewards.daily.correct, 1);
  run.click({ learningPage: 'check' });
  assert.equal(run.saved().learningRewards.daily.correct, 1, 'a passed checkpoint cannot earn repeated credit');
});

test('finishing a roadmap lesson unlocks its next stage and persists one claimable reward', () => {
  const id = '12345678-1234-4000-8000-123456789012';
  const saved = getStarterCourse('python-basics', 'en', 5);
  saved.completed = 1;
  saved.answers = ['print("Hello")', 'print("Hello, Ada")'];
  saved.reviews[1] = { answer: saved.answers[1], observation: 'Your greeting is clear.', nextAction: 'Try a different name.' };
  const run = app(seed({ learningPlan: saved, learningCourse: { id, ownerId: 'test-user' }, learningRoadmap: savedRoadmap(id) }), { realPlans: true });
  run.click({ view: 'learning-plan' });
  run.click({ learningStep: 'continue' });
  assert.equal(run.saved().learningPlan.completed, 2);
  assert.equal(run.saved().learningRoadmap.progress[0].completed, true);
  assert.equal(run.saved().learningRewards.lessons, 1);
  assert.equal(run.saved().learningRewards.gems, 25);
  run.click({ learningStep: 'continue' });
  assert.equal(run.saved().learningRewards.lessons, 1);
  run.click({ view: 'roadmap' });
  assert.deepEqual(run.current.html.args[0].active.map(stage => stage.status), ['completed', 'ready', 'locked', 'locked']);
  run.click({ roadmapClaim: 'finish-lesson' });
  assert.equal(run.saved().learningRewards.gems, 35);
  run.click({ roadmapClaim: 'finish-lesson' });
  assert.equal(run.saved().learningRewards.gems, 35, 'a daily reward is claimed once');
  run.click({ roadmapBuy: 'freeze' });
  assert.equal(run.saved().learningRewards.freezes, 1);
  assert.equal(run.saved().learningRewards.gems, 10);
  const reloaded = app(null, { storage: run.storage, realPlans: true });
  assert.equal(reloaded.current.state.learningRewards.gems, 10);
  assert.equal(reloaded.current.state.learningRoadmap.progress[0].completed, true);
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

test('budget home path resumes through overdue review and preserves the reading page', () => {
  const run = app(seed({ active: 'budget', budgetActivity: { view: 'lesson', step: 0 }, sessions: { budget: { lastSeen: NOW - RECAP_AFTER_MS - 1, cursor: { step: 0, page: 2 } } } }));
  assert.equal(run.current.view, 'discover');
  assert.equal(run.current.html.kind, 'quiet-home');
  run.click({ action: 'resume-current' });
  assert.equal(run.current.view, 'return-review');
  assert.equal(run.saved().sessions.budget.cursor.page, 2);
});

test('home goal draft survives navigation and reload and stays separate between accounts', async () => {
  const run = app(seed());
  run.input('goal-input', 'Learn video editing');
  run.click({ view: 'profile' });
  run.click({ view: 'courses' });
  assert.equal(run.current.html.kind, 'course-library');
  run.click({ view: 'discover' });
  assert.equal(run.current.html.args[0].homeGoal, 'Learn video editing');
  const reloaded = app(null, { storage: run.storage });
  assert.equal(reloaded.current.html.args[0].homeGoal, 'Learn video editing');
  run.signIn({ id: 'another-learner' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.html.args[0].homeGoal, undefined);
});

test('home path and path button select the same saved course and resume its exact draft', () => {
  const saved = savedAiCourse();
  const run = app(seed({ learningPlan: saved }), { realPlans: true });
  assert.equal(run.current.html.kind, 'quiet-home');
  assert.equal(run.current.html.args[0].learningPlan.plan.title, saved.plan.title);
  assert.equal(run.current.html.args[0].learningPlan.completed, saved.completed);
  run.click({ view: 'my-path' });
  assert.equal(run.current.view, 'course-path');
  run.click({ view: 'courses' });
  run.click({ action: 'resume-current' });
  assert.equal(run.current.view, 'learning-plan');
  assert.equal(run.current.state.learningPlan.answers[1], 'My current draft');
  assert.equal(run.current.state.learningPlan.study[1].page, 1);
});

test('home goal rejects blank and oversized requests before opening roadmap setup', () => {
  const run = app(seed());
  for (const goal of ['  ', 'ab', 'x'.repeat(181)]) {
    run.startGoal(goal, 10);
    assert.equal(run.current.view, 'discover');
    assert.deepEqual(run.roadmapRequests, []);
  }
  run.startGoal('Create a small game', 20);
  assert.equal(run.current.view, 'roadmap');
  assert.equal(run.current.html.args[0].wizard.goal, 'Create a small game');
  assert.equal(run.current.html.args[0].wizard.minutes, 20);
});

test('an older tab cannot overwrite a completed AI task through the real app save path', async () => {
  const url = 'https://docs.python.org/3/tutorial/';
  const plan = learningModel.normalizePlan({
    title: 'Python loops', outcome: 'Write a loop.',
    steps: [0, 1].map(index => ({ title: `Task ${index + 1}`, instruction: 'Visit every name.', task: 'Print three names.', criterion: 'Three names appear.', sourceUrl: url })),
  }, { goal: 'Learn Python loops', minutes: 5, language: 'en' }, new Map([[url, { url, title: 'Python tutorial' }]]));
  const initial = seed({ learningPlanOpen: true, learningPlan: { plan, study: [{ page: 1 }] } });
  const first = app(initial, { realPlans: true });
  first.click({ view: 'learning-plan' });
  const older = app(null, { storage: first.storage, realPlans: true });
  older.click({ view: 'learning-plan' });
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

test('resume offers a return review strictly after 24 hours, and skips it when nothing was learned', () => {
  for (const [elapsed, learned, expected] of [
    [RECAP_AFTER_MS - 1, true, 'lesson'],
    [RECAP_AFTER_MS, true, 'lesson'],
    [RECAP_AFTER_MS + 1, true, 'return-review'],
    [RECAP_AFTER_MS * 2, false, 'lesson'],
  ]) {
    const run = app(seed({ sessions: { design: { lastSeen: NOW - elapsed, cursor: { step: 0, page: learned ? 1 : 0 } } } }));
    run.click({ action: 'resume-course', id: 'design' });
    assert.equal(run.current.view, expected, `elapsed=${elapsed}, learned=${learned}`);
  }
});

test('a selected path node wins over a different saved review position, and future stages can be explored without credit', () => {
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
  assert.equal(run.lesson.step, 3);
  run.click({ action: 'finish-learn' });
  assert.equal(run.current.state.progress.design, 2);
});

test('a path-node choice survives an overdue recap instead of restoring a different saved stage', () => {
  const run = app(seed({ progress: { design: 2, budget: 0 }, sessions: { design: { lastSeen: NOW - RECAP_AFTER_MS - 1, cursor: { step: 1, quizIndex: 1 } } } }));
  run.click({ step: '0' });
  assert.equal(run.current.view, 'return-review');
  run.click({ returnAction: 'next' });
  for (let index = 0; index < 2; index++) {
    run.click({ returnChoice: String(recapQuestion('design', index).answer) });
    run.click({ returnAction: 'check' });
    run.click({ returnAction: 'next' });
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
    let run = app(seed({
      active: 'budget', progress: { design: 0, budget: completed }, drafts: { [key]: oldDraft },
      certificates: completed === 4 ? { budget: earned } : {},
      sessions: { budget: { lastSeen: NOW - RECAP_AFTER_MS - 1, cursor: { step: 0, page: 2 } } },
    }));
    run.click({ action, id: 'budget' });
    assert.equal(run.current.view, 'return-review');
    assert.deepEqual(run.saved().drafts[key], oldDraft, 'keep the old draft until the recap has finished');
    assert.equal(run.saved().returnReview.intent, 'practice');
    run = app(null, { storage: run.storage });
    run.click({ action: 'resume-course', id: 'budget' });
    assert.equal(run.review.intent, 'practice', 'the pending fresh task request survives reload');
    run.click({ returnAction: 'next' });
    for (let index = 0; index < 2; index++) {
      run.click({ returnChoice: String(recapQuestion('budget', index).answer) });
      run.click({ returnAction: 'check' });
      run.click({ returnAction: 'next' });
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

test('weak first attempts require basics and repair across reload, preserving saved quiz, work and completion', () => {
  const cursor = { step: 1, page: 0, quizIndex: 2, quizChoice: 1, quizFeedback: true };
  const drafts = { 'budget-practice': { values: [10, 20, 5], formula: '=SUM(B2:B4)', answer: '35', seed: 0 } };
  let run = app(seed({ active: 'budget', progress: { design: 0, budget: 2 }, drafts, sessions: { budget: { lastSeen: NOW - RECAP_AFTER_MS - 1, cursor } } }));
  run.click({ action: 'resume-course', id: 'budget' });
  assert.equal(run.current.view, 'return-review');
  assert.equal(run.review.phase, 'intro');
  run.click({ returnAction: 'next' });
  run.click({ returnAction: 'check' });
  run.click({ returnAction: 'next' });
  assert.equal(run.review.index, 0, 'cannot skip an unanswered question');
  run.click({ returnChoice: String((recapQuestion('budget', 0).answer + 1) % 3) });
  run.click({ returnAction: 'check' });
  run.click({ returnChoice: String(recapQuestion('budget', 0).answer) });
  assert.deepEqual(run.review.firstPass, [false, null], 'a corrected click cannot replace the first attempt');
  run.click({ returnAction: 'next' });
  run.click({ returnChoice: String(recapQuestion('budget', 1).answer) });
  run.click({ returnAction: 'check' });
  run.click({ returnAction: 'next' });
  assert.equal(run.review.phase, 'foundations', '50% first pass requires rereading the basics');
  const reviewBeforeReload = clone(run.review);
  run = app(null, { storage: run.storage });
  run.click({ action: 'resume-course', id: 'budget' });
  assert.deepEqual(run.review, reviewBeforeReload);
  run.click({ returnAction: 'next' });
  run.click({ returnAction: 'next' });
  assert.equal(run.review.phase, 'repair');
  run.click({ returnChoice: String((recapQuestion('budget', 0).answer + 1) % 3) });
  run.click({ returnAction: 'check' });
  run.click({ returnAction: 'next' });
  assert.equal(run.review.index, 0, 'wrong repair cannot skip ahead');
  for (let index = 0; index < 2; index++) {
    run.click({ returnChoice: String(recapQuestion('budget', index).answer) });
    run.click({ returnAction: 'check' });
    assert.deepEqual(run.review.firstPass, [false, true]);
    run.click({ returnAction: 'next' });
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
  assert.equal(run.current.view, 'return-review');
  assert.equal(run.saved().sessions.design.cursor.page, 1);
});

test('an AI course resumes its exact page and draft after the same first-attempt review, including reload and account isolation', async () => {
  const saved = savedAiCourse();
  const oldVisit = NOW - RECAP_AFTER_MS * 3;
  let run = app(seed({ learningPlan: saved, learningCourse: { id: 'python-course', updatedAt: new Date(oldVisit).toISOString() }, learningVisits: { 'ai:python-course': oldVisit } }), { realPlans: true });
  assert.equal(run.current.view, 'discover');
  run.click({ view: 'learning-plan' });
  assert.equal(run.current.view, 'return-review');
  assert.equal(run.review.key, 'ai:python-course');
  assert.equal(run.review.questions.length, 2, 'uses only the two encountered lesson checkpoints');
  assert.equal(run.saved().learningVisits['ai:python-course'], oldVisit, 'opening a review does not count as completing it');
  run.click({ returnAction: 'next' });
  run.click({ returnChoice: '1' });
  run.click({ returnAction: 'check' });
  run.click({ returnAction: 'next' });
  const partial = clone(run.review);
  run = app(null, { storage: run.storage, realPlans: true });
  run.click({ view: 'learning-plan' });
  assert.deepEqual(run.review, partial);
  run.signIn({ id: 'second-user' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.current.state.returnReview, undefined, 'another account cannot see this review or draft');
  run.signIn({ id: 'test-user' });
  await new Promise(resolve => setImmediate(resolve));
  run.click({ view: 'learning-plan' });
  assert.deepEqual(run.review, partial);
  run.click({ returnChoice: '1' });
  run.click({ returnAction: 'check' });
  run.click({ returnAction: 'next' });
  assert.equal(run.current.view, 'learning-plan');
  assert.deepEqual(run.saved().learningPlan, saved, 'review never grants course credit or rewrites the original study cursor');
  assert.equal(run.saved().learningVisits['ai:python-course'], NOW);
  assert.equal(run.saved().returnReview, undefined);
});

test('AI returning after a hidden tab is closed retains the inactivity timestamp and requires recall', () => {
  const run = app(seed({ learningPlan: savedAiCourse(), learningCourse: { id: 'python-course' } }), { realPlans: true });
  run.click({ view: 'learning-plan' });
  run.visible(false);
  run.advance(RECAP_AFTER_MS + 1);
  run.leave();
  assert.equal(run.saved().learningVisits['ai:python-course'], NOW, 'closing a long-hidden tab is not new learning activity');
  run.visible(true);
  assert.equal(run.current.view, 'return-review');
  assert.equal(run.saved().learningPlan.study[1].page, 1);
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
