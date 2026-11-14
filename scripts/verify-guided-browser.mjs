// Explicit mock API boundary: this checks browser flows, not live credentials.
// PLAYWRIGHT_MODULE may point to a locally installed Playwright package.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getStarterCourse } from '../core/starter-courses.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MINDORA_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const user = { id: 'browser-qa', name: 'Aruzhan', email: 'qa@example.test' };
const key = 'mindora.workspace.v1.browser-qa';
const errors = [];
const lessonRequests = [];
let signupPayload;
async function context({ signedIn = true, saved = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let identity = signedIn, revision = 0;
  const courses = new Map();
  await ctx.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    let body = {};
    if (url.pathname === '/api/account') {
      if (request.method() === 'POST') { signupPayload = request.postDataJSON(); identity = signupPayload.action !== 'signout'; }
      body = { available: true, user: identity ? user : null, profile: identity ? { name: 'Aruzhan', interests: [] } : null };
    } else if (url.pathname === '/api/learning-workspace') {
      body = request.method() === 'PUT' ? { workspace: { data: request.postDataJSON().data, revision: ++revision } } : { workspace: null };
    } else if (url.pathname === '/api/learning-courses' && request.method() === 'POST') {
      const course = { id: `00000000-0000-4000-8000-${String(courses.size + 1).padStart(12, '0')}`, saved: request.postDataJSON().saved, revision: 1, updatedAt: new Date().toISOString() };
      courses.set(course.id, course); body = { course };
    } else if (url.pathname === '/api/learning-roadmap') {
      const input = request.postDataJSON();
      if (input.action === 'clarify') {
        body = { clarification: { question: 'What would you like to make?', directions:
          ['A small program', 'A weekly report', 'A chart'].map(title => ({ title, goal: input.goal + ': ' + title, diagnosticQuestion: 'How would you begin this task?' })) } };
      } else body = { roadmap: { ...input, title: 'My Python journey', outcome: 'Build a small program one lesson at a time.', level: 'beginner', levelReason: 'Fixture: you selected starting from scratch.',
        stages: ['Print a message', 'Store a value', 'Work with numbers', 'Build a tiny project'].map(title => ({ title, objective: `Practise: ${title.toLowerCase()}.` })) } };
    } else if (url.pathname === '/api/learning-plan') {
      const input = request.postDataJSON(), saved = getStarterCourse('python-basics', input.language, input.minutes);
      lessonRequests.push(input);
      saved.plan.goal = input.goal;
      saved.plan.title = input.roadmapStage?.title || saved.plan.title;
      const course = { id: `00000000-0000-4000-8000-${String(courses.size + 1).padStart(12, '0')}`, saved, revision: 1, updatedAt: new Date().toISOString() };
      courses.set(course.id, course); body = { plan: saved.plan, course };
    } else if (url.pathname === '/api/learning-courses' && url.searchParams.has('id')) {
      body = { course: courses.get(url.searchParams.get('id')) };
    } else if (url.pathname === '/api/learning-courses' && request.method() === 'PUT') {
      const data = request.postDataJSON(), course = courses.get(data.id);
      if (course) { course.saved = data.saved; course.revision++; }
      body = { course };
    } else if (url.pathname === '/api/learning-courses') {
      body = { courses: [...courses.values()].map(course => ({ id: course.id, title: course.saved.plan.title, goal: course.saved.plan.goal, language: course.saved.plan.language, minutes: course.saved.plan.minutes, completed: course.saved.completed, totalSteps: course.saved.plan.steps.length, revision: course.revision })) };
    } else if (url.pathname.startsWith('/api/learning-courses/')) {
      const course = courses.get(url.pathname.split('/').at(-1));
      if (course && request.method() === 'PUT') { course.saved = request.postDataJSON().saved; course.revision++; }
      body = { course };
    } else if (url.pathname === '/api/task-review') body = { review: { observation: 'Fixture feedback: the submitted example is present.', nextAction: 'Check the task criterion before continuing.' } };
    else if (url.pathname === '/api/budget-draft') body = { available: false, workspace: null };
    else body = { error: 'Not part of this browser fixture' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  if (saved) await ctx.addInitScript(({ key, saved }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved));
  }, { key, saved });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForTimeout(250);
  return { ctx, page };
}
const size = page => page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, vw: innerWidth, vh: innerHeight }));
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || localStorage.getItem('mindora.workspace.v1.guest')), key);
const nav = (page, view) => page.locator(`#navigation [data-view="${view}"], #mobile-navigation [data-view="${view}"]`).filter({ visible: true }).first();
try {
  // First entry: one short question at a time; the account form reuses the name.
  const first = await context({ signedIn: false });
  const page = first.page;
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const bounds = await size(page);
    assert.equal(bounds.width, bounds.vw);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.guided-footer [data-view="new-course"]').click();
  await page.locator('.phone-course-nav [data-view="courses"]').click();
  await page.locator('.phone-catalog > summary').click();
  await page.locator('[data-course="design"][data-course-path]').click();
  await page.waitForSelector('.learning-hub');
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const bounds = await size(page);
    assert.equal(bounds.width, bounds.vw);
    await page.screenshot({ path: join(tmpdir(), `mindora-clean-hub-${viewport.width}.png`), fullPage: true });
    // Lesson paths scroll naturally; large nodes and readable labels take priority.
    const nodes = await page.locator('.learning-hub-node').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    assert.ok(nodes.every(width => width >= 44));
    console.log('Learning path viewport:', JSON.stringify(bounds));
    await page.screenshot({ path: join(tmpdir(), `mindora-clean-hub-${viewport.width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.learning-hub-node[aria-current="step"]').click();
  await page.waitForSelector('#main[data-page="lesson"]');
  assert.equal(signupPayload, undefined, 'the first course requires no registration');
  assert.equal((await state(page)).minutes, 10);
  assert.equal((await state(page)).active, 'design');
  await first.ctx.close();

  // An overdue learner reviews, leaves midway, returns, repairs and resumes.
  const saved = {
    version: 1, language: 'en', minutes: 10, active: 'design',
    progress: { design: 1, budget: 0 }, goals: {}, drafts: { keep: { title: 'My draft' } },
    works: {}, certificates: {}, notes: {}, studyDays: [], practiceCount: 0,
    sessions: { design: { lastSeen: Date.now() - 3 * 86400000, cursor: { step: 1, page: 0, minutes: 10, quizIndex: 1, quizChoice: null, quizFeedback: false } } },
  };
  const returning = await context({ saved });
  const r = returning.page;
  await r.locator('.learning-hub-node[aria-current="step"]').click();
  await r.waitForSelector('#main[data-page="return-review"]');
  await r.locator('[data-return-action="next"]').click();
  await r.locator('[data-return-choice="0"]').click();
  await r.locator('[data-return-action="check"]').click();
  await r.reload();
  await r.locator('.learning-hub-node[aria-current="step"]').click();
  await r.waitForSelector('[data-return-action="next"]');
  assert.deepEqual((await state(r)).returnReview.firstPass, [false, null]);
  await r.locator('[data-return-action="next"]').click();
  await r.locator('[data-return-choice="2"]').click();
  await r.locator('[data-return-action="check"]').click();
  await r.locator('[data-return-action="next"]').click();
  assert.equal((await state(r)).returnReview.phase, 'foundations');
  await r.screenshot({ path: join(tmpdir(), 'mindora-clean-integrated-review.png'), fullPage: true });
  await r.locator('[data-return-action="next"]').click();
  await r.locator('[data-return-action="next"]').click();
  for (const answer of [1, 2]) {
    await r.locator(`[data-return-choice="${answer}"]`).click();
    await r.locator('[data-return-action="check"]').click();
    await r.locator('[data-return-action="next"]').click();
  }
  await r.waitForSelector('#main[data-page="lesson"]');
  const restored = await state(r);
  assert.equal(restored.returnReview, undefined);
  assert.deepEqual(restored.progress, saved.progress);
  assert.deepEqual(restored.drafts, saved.drafts);
  assert.equal(restored.sessions.design.cursor.quizIndex, 1);
  await r.reload();
  await r.locator('.learning-hub-node[aria-current="step"]').click();
  await r.waitForSelector('#main[data-page="lesson"]');
  assert.equal(await r.locator('.return-review').count(), 0);
  await returning.ctx.close();

  // A ready course is saved through the existing library and uses its real player.
  const ready = await context({ saved: { ...saved, sessions: {}, progress: { design: 0, budget: 0 } } });
  const p = ready.page;
  await nav(p, 'courses').click();
  assert.equal(await p.locator('.ready-course').count(), 6);
  await p.locator('.phone-catalog summary').click();
  await p.locator('[data-course-minutes="5"]').click();
  await p.locator('[data-starter-course="python-basics"]').click();
  await p.waitForSelector('.learning-hub').catch(async error => { console.log('Ready course failure:', JSON.stringify({ errors, state: await state(p), body: (await p.locator('#main').innerText()).slice(0,1800) })); throw error; });
  await p.locator('.learning-hub-node[aria-current="step"], .learning-hub-actions [data-view="learning-plan"]:visible').click();
  await p.waitForSelector('.ai-lesson-reader');
  await p.screenshot({ path: join(tmpdir(), 'mindora-clean-ready-lesson.png'), fullPage: true });
  await p.locator('[data-learning-page="next"]:visible').click();
  await p.screenshot({ path: join(tmpdir(), 'mindora-clean-ready-monitor.png'), fullPage: true });
  await p.locator('[data-learning-page="next"]:visible').click();
  await p.locator('[data-learning-gap]').fill('print');
  await p.locator('[data-learning-page="check"]').click();
  assert.equal(await p.locator('[data-learning-page="next"]').isDisabled(), true);
  await p.locator('[data-learning-gap]').fill('"Hello"');
  await p.locator('[data-learning-page="check"]').click();
  await p.locator('[data-learning-page="next"]:visible').click();
  await p.locator('[data-learning-page="next"]:visible').click();
  for (const answer of ['print("Aruzhan")', 'print("Hello")\nprint("Mindora")']) {
    await p.locator('#learning-step-form textarea').fill(answer);
    await p.locator('#learning-step-form button[type="submit"]').click();
    await p.locator('[data-learning-step="continue"]').click();
  }
  await p.waitForSelector('#learning-plan-complete');
  assert.equal((await state(p)).learningPlan.completed, 2);
  assert.equal((await state(p)).progress.design, 0);
  await p.locator('.ai-lesson-exit').click();
  await nav(p, 'courses').click();
  await p.locator('.phone-catalog summary').click();
  await p.locator('[data-starter-course="python-basics"]').click();
  await p.waitForSelector('.learning-hub');
  assert.equal((await state(p)).learningPlan.completed, 2);
  for (const minutes of [10, 20]) {
    await nav(p, 'courses').click();
    await p.locator('.phone-catalog summary').click();
    await p.locator(`[data-course-minutes="${minutes}"]`).click();
    await p.locator('[data-starter-course="python-basics"]').click();
    await p.waitForSelector('.learning-hub');
    assert.equal((await state(p)).learningPlan.plan.minutes, minutes);
    assert.equal(await p.locator('.learning-hub-node').count(), minutes === 10 ? 3 : 4);
    await p.locator('.learning-hub-node[aria-current="step"], .learning-hub-actions [data-view="learning-plan"]:visible').click();
    await p.locator('[data-learning-page="next"]:visible').click();
    await p.locator('[data-learning-page="next"]:visible').click();
    await p.locator('[data-learning-gap]').fill('"Hello"');
    await p.locator('[data-learning-page="check"]').click();
    await p.locator('[data-learning-page="next"]:visible').click();
    await p.locator('[data-learning-page="next"]:visible').click();
    await p.locator('#learning-step-form textarea').fill('print("My first saved task")');
    await p.locator('#learning-step-form button[type="submit"]').click();
    await p.locator('[data-learning-step="continue"]').click();
    await p.locator('[data-learning-page="next"]:visible').click();
    await p.waitForFunction(key => !JSON.parse(localStorage.getItem(key)).learningCourse.dirty, key);
    await p.reload();
    await p.waitForSelector('.learning-hub');
    assert.equal((await state(p)).learningPlan.completed, 1);
    assert.equal((await state(p)).learningPlan.study[1].page, 1);
    await p.locator('.learning-hub-node[aria-current="step"]').click();
    assert.equal((await state(p)).learningPlan.plan.minutes, minutes);
    await p.locator('.ai-lesson-exit').click();
  }
  // Switching duration never erases the completed 5-minute version.
  await nav(p, 'courses').click();
  await p.locator('.phone-catalog summary').click();
  await p.locator('[data-course-minutes="5"]').click();
  await p.locator('[data-starter-course="python-basics"]').click();
  await p.waitForSelector('.learning-hub');
  assert.equal((await state(p)).learningPlan.completed, 2);
  assert.equal((await state(p)).learningPlan.plan.minutes, 5);
  // Profile logout is directly reachable on the phone and returns to Mino.
  await p.locator('#mobile-navigation [data-view="profile"]').click();
  await p.locator('[data-account-signout]').click();
  await p.waitForSelector('.guided-greeting');
  assert.equal(await p.locator('#mindora-account[open]').count(), 0);
  assert.equal(await p.locator('#guided-prompt').isVisible(), true);
  await p.reload();
  await p.waitForSelector('.guided-greeting');
  await p.locator('.guided-signin').click();
  await p.locator('#account-email').fill(user.email);
  await p.locator('#account-password').fill('Browser-fixture-8');
  await p.locator('.account-primary').click();
  await p.waitForSelector('.account-signout');
  await p.locator('.account-close').click();
  await p.waitForSelector('.learning-hub');
  assert.equal((await state(p)).learningPlan.completed, 2);
  assert.equal((await state(p)).learningPlan.plan.minutes, 5);
  await ready.ctx.close();
  // The latest backend's personal roadmap coexists with the short-course catalog.
  const journey = await context({ saved: { ...saved, active: null, sessions: {}, progress: { design: 0, budget: 0 } } });
  const j = journey.page;
  await j.locator('.phone-course-nav [data-view="new-course"]').click();
  await j.locator('#goal-input').fill('Learn Python for my work');
  await j.locator('#time-select').selectOption('5');
  await j.locator('#goal-form button[type="submit"]').click();
  await j.locator('[name="direction"][value="0"]').check();
  await j.locator('#roadmap-form button[type="submit"]').click();
  await j.locator('[name="diagnosticUnknown"]').check();
  await j.locator('input[name="experience"][value="new"]').check();
  await j.locator('#roadmap-form button[type="submit"]').click();
  await j.locator('input[name="motivation"][value="work"]').check();
  await j.locator('#roadmap-form button[type="submit"]').click();
  await j.locator('input[name="minutes"][value="5"]').check();
  await j.locator('#roadmap-form button[type="submit"]').click();
  await j.waitForSelector('.roadmap-layout');
  assert.equal(await j.locator('.roadmap-stage.is-locked').count(), 3);
  await j.locator('[data-roadmap-stage="0"]').click();
  await j.waitForSelector('.ai-lesson-reader');
  await j.locator('[data-learning-page="next"]:visible').click();
  await j.locator('[data-learning-page="next"]:visible').click();
  await j.locator('[data-learning-gap]').fill('"Hello"');
  await j.locator('[data-learning-page="check"]').click();
  await j.locator('[data-learning-page="next"]:visible').click();
  await j.locator('[data-learning-page="next"]:visible').click();
  for (const answer of ['print("My lesson")', 'print("Hello")\nprint("Mindora")']) {
    await j.locator('#learning-step-form textarea').fill(answer);
    await j.locator('#learning-step-form button[type="submit"]').click();
    await j.locator('[data-learning-step="continue"]').click();
  }
  await j.waitForSelector('#learning-plan-complete');
  assert.equal((await state(j)).learningRoadmap.progress[0].completed, true);
  await j.locator('[data-action="next-path-lesson"]').click();
  await j.waitForSelector('.ai-lesson-reader');
  assert.ok((await state(j)).learningRoadmap.progress[1].courseId);
  await j.locator('.ai-lesson-exit').click();
  await j.waitForSelector('.roadmap-layout');
  assert.equal(await j.locator('[data-roadmap-stage="1"]').count(), 1);
  await j.reload();
  await j.waitForSelector('.roadmap-layout');
  assert.equal((await state(j)).learningRoadmap.progress[0].completed, true);
  await j.screenshot({ path: join(tmpdir(), 'mindora-personal-roadmap-phone.png'), fullPage: true });
  await j.locator('[data-roadmap-stage="1"]').click();
  await j.waitForSelector('.ai-lesson-reader');
  assert.equal((await state(j)).learningRoadmap.progress[1].courseId !== null, true);
  await j.locator('.ai-lesson-exit').click();
  await j.waitForSelector('.roadmap-stage.is-active');
  // A second personal course keeps the first path and its generated lessons.
  const firstPath = (await state(j)).learningRoadmap;
  const generated = lessonRequests.length;
  await j.locator('.phone-course-nav [data-view="new-course"]').click();
  await j.locator('#goal-input').fill('Build a weekly report');
  await j.locator('#goal-form button[type="submit"]').click();
  await j.locator('[name="direction"][value="0"]').check();
  await j.locator('#roadmap-form button[type="submit"]').click();
  await j.locator('[name="diagnosticUnknown"]').check();
  await j.locator('input[name="experience"][value="some"]').check();
  await j.locator('#roadmap-form button[type="submit"]').click();
  await j.locator('input[name="motivation"][value="work"]').check();
  await j.locator('#roadmap-form button[type="submit"]').click();
  await j.locator('input[name="minutes"][value="5"]').check();
  await j.locator('#roadmap-form button[type="submit"]').click();
  await j.waitForSelector('.roadmap-layout');
  assert.equal(lessonRequests.length, generated, 'a new outline does not eagerly generate lessons');
  await nav(j, 'courses').click();
  assert.equal(await j.locator('[data-learning-roadmap]').count(), 2);
  await j.locator(`[data-learning-roadmap="${firstPath.id}"]`).click();
  await j.waitForSelector('.roadmap-layout');
  assert.equal((await state(j)).learningRoadmap.progress[0].completed, true);
  await nav(j, 'profile').click();
  await nav(j, 'courses').click();
  await j.locator('.phone-course-nav [data-view="my-path"]').click();
  await j.waitForSelector('.roadmap-layout');
  await j.locator('[data-roadmap-stage="1"]').click();
  await j.waitForSelector('.ai-lesson-reader');
  assert.equal(lessonRequests.length, generated, 'opening an archived lesson loads its saved copy');
  await journey.ctx.close();
  assert.deepEqual(errors, []);
  console.log('PASS: responsive greeting/path, guest greeting → lesson, interrupted recall, low-score repair, saved cursor/drafts, 5/10/20-minute courses, mobile signout → greeting → signin, personalized roadmap → completion → unlock → reload → next lesson. API mocked explicitly.');
} finally { await browser.close(); }
