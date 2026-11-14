// Explicit mock API boundary: this checks browser flows, not live credentials.
// PLAYWRIGHT_MODULE may point to a locally installed Playwright package.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
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
let signupPayload;
const roadmapRequests = [];
const lessonRequests = [];
const roadmap = {
  title: 'Build useful spreadsheet formulas', outcome: 'Produce a monthly expense report.',
  level: 'intermediate', levelReason: 'You already know how to use SUM.',
  stages: [
    { title: 'Use SUMIF', objective: 'Total rows for a given category.' },
    { title: 'Count expenses', objective: 'Write an expense count by category.' },
    { title: 'Check subtotals', objective: 'Compare conditional and overall totals.' },
    { title: 'Make a fresh report', objective: 'Build a report from a new dataset.' },
  ],
};
async function context({ signedIn = true, saved = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let identity = signedIn, revision = 0;
  const courses = new Map();
  await ctx.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    let body = {};
    if (url.pathname === '/api/account') {
      if (request.method() === 'POST') { signupPayload = request.postDataJSON(); identity = true; }
      body = { available: true, user: identity ? user : null, profile: identity ? { name: 'Aruzhan', interests: [] } : null };
    } else if (url.pathname === '/api/learning-workspace') {
      body = request.method() === 'PUT' ? { workspace: { data: request.postDataJSON().data, revision: ++revision } } : { workspace: null };
    } else if (url.pathname === '/api/learning-roadmap') {
      const input = request.postDataJSON();
      roadmapRequests.push(input);
      body = { roadmap: { ...roadmap, title: input.goal, goal: input.goal, minutes: input.minutes, language: input.language } };
    } else if (url.pathname === '/api/learning-plan') {
      const input = request.postDataJSON();
      lessonRequests.push(input);
      const saved = getStarterCourse('python-basics', 'en');
      Object.assign(saved.plan, { title: input.roadmapStage.title, goal: input.goal });
      const course = { id: randomUUID(), saved, revision: 1, updatedAt: new Date().toISOString() };
      courses.set(course.id, course);
      body = { plan: saved.plan, course };
    } else if (url.pathname === '/api/learning-courses' && request.method() === 'POST') {
      const course = { id: randomUUID(), saved: request.postDataJSON().saved, revision: 1, updatedAt: new Date().toISOString() };
      courses.set(course.id, course); body = { course };
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
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const nav = (page, view) => page.locator(`#navigation [data-view="${view}"], #mobile-navigation [data-view="${view}"]`).filter({ visible: true }).first();
async function buildPath(page, goal, evidence) {
  const next = page.locator('#roadmap-form button[type="submit"]');
  await page.locator('#roadmap-form input[name="goal"]').fill(goal);
  await next.click();
  await page.locator('#roadmap-form input[name="experience"][value="some"]').check();
  await page.locator('#roadmap-form textarea[name="evidence"]').fill(evidence);
  await next.click();
  await page.locator('#roadmap-form input[name="motivation"][value="work"]').check();
  await next.click();
  await page.locator('#roadmap-form input[name="minutes"][value="5"]').check();
  await next.click();
  await page.waitForSelector('.roadmap-layout');
}
try {
  // Optional greeting leads to signup, followed by the single questionnaire.
  const first = await context({ signedIn: false });
  const page = first.page;
  await page.locator('[data-intro-action="show"]').click();
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const bounds = await size(page);
    assert.equal(bounds.width, bounds.vw);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-intro-action="next"]').click();
  await page.locator('#account-name').fill('Aruzhan');
  await page.locator('.account-primary').click();
  await page.locator('.account-primary').click();
  await page.locator('#account-email').fill(user.email);
  await page.locator('#account-password').fill('Browser-fixture-8');
  await page.locator('#account-confirm').fill('Browser-fixture-8');
  await page.screenshot({ path: join(tmpdir(), 'mindora-clean-quick-signup.png'), fullPage: true });
  await page.locator('.account-primary').click();
  await buildPath(page, 'Learn spreadsheet formulas', 'I already use SUM.');
  assert.equal(roadmapRequests[0].evidence, 'I already use SUM.');
  assert.equal(lessonRequests.length, 0);
  assert.equal(await page.locator('.roadmap-stage.is-locked').count(), 3);
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const bounds = await size(page);
    assert.equal(bounds.width, bounds.vw);
    console.log('Learning path viewport:', JSON.stringify(bounds));
    await page.screenshot({ path: join(tmpdir(), `mindora-clean-hub-${viewport.width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-roadmap-stage="0"]').click();
  await page.waitForSelector('.ai-lesson-reader');
  assert.equal(signupPayload.name, 'Aruzhan');
  assert.equal((await state(page)).minutes, 5);
  assert.equal(lessonRequests[0].roadmapStage.level, 'intermediate');
  assert.equal(lessonRequests[0].roadmapStage.title, 'Use SUMIF');
  const firstPath = (await state(page)).learningRoadmap;
  assert.ok(firstPath.progress[0].courseId);

  // Creating another path preserves the first path and its saved lesson.
  await page.locator('.ai-lesson-exit').click();
  await page.locator('[data-roadmap-action="setup"]').click();
  await buildPath(page, 'Practice weekly reporting', 'I can design simple reports.');
  assert.equal(lessonRequests.length, 1);
  assert.equal((await state(page)).learningRoadmap.goal, 'Practice weekly reporting');
  await nav(page, 'courses').click();
  assert.equal(await page.locator('[data-learning-roadmap]').count(), 2);
  await page.locator(`[data-learning-roadmap="${firstPath.id}"]`).click();
  await page.waitForSelector('.roadmap-layout');
  assert.equal((await state(page)).learningRoadmap.progress[0].courseId, firstPath.progress[0].courseId);
  await page.locator('[data-roadmap-stage="0"]').click();
  await page.waitForSelector('.ai-lesson-reader');
  assert.equal(lessonRequests.length, 1);
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
  await nav(r, 'courses').click();
  await r.locator('.ready-course[data-course="design"]').click();
  await r.waitForSelector('#main[data-page="path"]');
  await nav(r, 'profile').click();
  await nav(r, 'my-path').click();
  await r.waitForSelector('#main[data-page="path"]');
  await r.locator('.course-path-actions [data-action="resume-course"]').click();
  await r.waitForSelector('#main[data-page="return-review"]');
  await r.locator('[data-return-action="next"]').click();
  await r.locator('[data-return-choice="0"]').click();
  await r.locator('[data-return-action="check"]').click();
  await r.reload();
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
  await nav(r, 'my-path').click();
  await r.locator('.course-path-actions [data-action="resume-course"]').click();
  await r.waitForSelector('#main[data-page="lesson"]');
  assert.equal(await r.locator('.return-review').count(), 0);
  await returning.ctx.close();

  // A ready course is saved through the existing library and uses its real player.
  const ready = await context({ saved: { ...saved, sessions: {}, progress: { design: 0, budget: 0 } } });
  const p = ready.page;
  const coursesNav = nav(p, 'courses');
  await coursesNav.click();
  assert.equal(await p.locator('.ready-course').count(), 6);
  await p.locator('[data-starter-course="python-basics"]').click();
  await p.waitForSelector('#main[data-page="course-path"]');
  assert.equal(await p.locator('.ai-lesson-reader').count(), 0);
  await nav(p, 'profile').click();
  await nav(p, 'my-path').click();
  await p.waitForSelector('#main[data-page="course-path"]');
  await p.locator('.learning-hub-actions [data-view="learning-plan"]').click();
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
  await coursesNav.click();
  await p.locator('[data-starter-course="python-basics"]').click();
  await p.waitForSelector('#main[data-page="course-path"]');
  assert.equal((await state(p)).learningPlan.completed, 2);
  await ready.ctx.close();
  assert.deepEqual(errors, []);
  console.log('PASS: greeting → signup → personal paths retained across selection, interrupted recall, low-score repair, saved cursor/drafts, same-day resume, ready course → path → assessment → practice → result → reopen. API mocked explicitly.');
} finally { await browser.close(); }
