// Explicit mock API boundary: this checks browser flows, not live credentials.
// PLAYWRIGHT_MODULE may point to a locally installed Playwright package.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MINDORA_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const user = { id: 'browser-qa', name: 'Aruzhan', email: 'qa@example.test' };
const key = 'mindora.workspace.v1.browser-qa';
const errors = [];
let signupPayload;
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
    } else if (url.pathname === '/api/learning-courses' && request.method() === 'POST') {
      const course = { id: `ready-${courses.size + 1}`, saved: request.postDataJSON().saved, revision: 1, updatedAt: new Date().toISOString() };
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
try {
  // First entry: one short question at a time; the account form reuses the name.
  const first = await context({ signedIn: false });
  const page = first.page;
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const bounds = await size(page);
    assert.equal(bounds.width, bounds.vw); assert.equal(bounds.height, bounds.vh);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-intro-action="next"]').click();
  assert.equal(await page.locator('[data-intro-action="next"]').isDisabled(), true);
  await page.locator('#intro-name').fill('Aruzhan');
  await page.locator('[data-intro-action="next"]').click();
  await page.locator('[data-intro-topic="design"]').click();
  await page.locator('[data-intro-action="next"]').click();
  await page.locator('[data-intro-minutes="5"]').click();
  await page.locator('[data-intro-action="start"]').click();
  await page.locator('#account-email').fill(user.email);
  assert.equal(await page.locator('#account-name').count(), 0);
  await page.locator('#account-password').fill('Browser-fixture-8');
  await page.locator('#account-confirm').fill('Browser-fixture-8');
  await page.screenshot({ path: join(tmpdir(), 'mindora-clean-quick-signup.png'), fullPage: true });
  await page.locator('.account-primary').click();
  await page.waitForSelector('.learning-hub');
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const bounds = await size(page);
    assert.equal(bounds.width, bounds.vw);
    assert.equal(bounds.height, bounds.vh);
    console.log('Learning path viewport:', JSON.stringify(bounds));
    await page.screenshot({ path: join(tmpdir(), `mindora-clean-hub-${viewport.width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.learning-hub-actions [data-action="resume-course"]').click();
  await page.waitForSelector('#main[data-page="lesson"]');
  assert.equal(signupPayload.name, 'Aruzhan');
  assert.equal((await state(page)).minutes, 5);
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
  await r.locator('.learning-hub-actions [data-action="resume-course"]').click();
  await r.waitForSelector('#main[data-page="return-review"]');
  await r.locator('[data-return-action="next"]').click();
  await r.locator('[data-return-choice="0"]').click();
  await r.locator('[data-return-action="check"]').click();
  await r.reload();
  await r.locator('.learning-hub-actions [data-action="resume-course"]').click();
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
  await r.locator('.learning-hub-actions [data-action="resume-course"]').click();
  await r.waitForSelector('#main[data-page="lesson"]');
  assert.equal(await r.locator('.return-review').count(), 0);
  await returning.ctx.close();

  // A ready course is saved through the existing library and uses its real player.
  const ready = await context({ saved: { ...saved, sessions: {}, progress: { design: 0, budget: 0 } } });
  const p = ready.page;
  await p.locator('.learning-hub-actions [data-view="courses"]').click();
  assert.equal(await p.locator('.ready-course').count(), 6);
  await p.locator('[data-starter-course="python-basics"]').click();
  await p.waitForSelector('.learning-hub').catch(async error => { console.log('Ready course failure:', JSON.stringify({ errors, state: await state(p), body: (await p.locator('#main').innerText()).slice(0,1800) })); throw error; });
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
  await p.locator('.learning-hub-actions [data-view="courses"]').click();
  await p.locator('[data-starter-course="python-basics"]').click();
  await p.waitForSelector('.learning-hub');
  assert.equal((await state(p)).learningPlan.completed, 2);
  await ready.ctx.close();
  assert.deepEqual(errors, []);
  console.log('PASS: greeting/path fit, guided signup → lesson, interrupted recall, low-score repair, saved cursor/drafts, same-day resume, ready course → assessment → practice → result → reopen. API mocked explicitly.');
} finally { await browser.close(); }
