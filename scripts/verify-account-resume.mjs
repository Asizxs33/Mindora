// Explicit API fixtures: reproduce a tap before account hydration completes.
// Live account/cloud persistence is checked separately against production.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getStarterCourse } from '../core/starter-courses.js';
import { restoreRoadmap } from '../core/roadmap-model.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.MINDORA_URL || 'http://127.0.0.1:4188';
const user = { id: 'resume-qa', name: 'Resume QA', email: 'resume@example.test' };
const key = `mindora.workspace.v1.${user.id}`;
const id = '12345678-1234-4000-8000-123456789012';
const saved = getStarterCourse('python-basics', 'en', 10);
saved.study = [{ page: 1 }];
saved.answers = ['An unsubmitted draft'];
const course = { id, saved, revision: 2, updatedAt: new Date().toISOString() };
const roadmap = restoreRoadmap({
  goal: 'Learn Python', minutes: 10, language: 'en', title: 'Python foundations',
  outcome: 'Write a small program.', level: 'beginner', levelReason: 'Start with the basics.',
  stages: ['Print a message', 'Store a value', 'Repeat an action', 'Build a program']
    .map(title => ({ title, objective: `${title} independently.` })),
  progress: Array.from({ length: 4 }, (_, index) => ({ courseId: index === 0 ? id : null, completed: false })),
});
const workspace = {
  version: 1, language: 'en', minutes: 10, active: 'design', progress: { design: 0, budget: 0 },
  goals: {}, drafts: {}, works: {}, notes: {}, sessions: {}, certificates: {},
  learningPlan: saved, learningCourse: { id, ownerId: user.id, revision: 2 },
  learningRoadmap: roadmap, lastLearningType: 'roadmap',
};

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    let release, requested, loads = 0, generations = 0;
    const held = new Promise(resolve => { release = resolve; });
    const requestStarted = new Promise(resolve => { requested = resolve; });
    const errors = [];
    await context.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url());
      let body;
      if (url.pathname === '/api/account') body = { available: true, user, profile: { name: user.name, interests: [] } };
      else if (url.pathname === '/api/learning-workspace') body = { workspace: null };
      else if (url.pathname === '/api/learning-courses' && req.method() === 'GET' && !url.searchParams.has('id')) {
        requested();
        await held;
        body = { courses: [{ id, title: saved.plan.title, revision: 2, completed: 0, totalSteps: saved.plan.steps.length }] };
      } else if (url.pathname === '/api/learning-courses' && req.method() === 'GET') { loads++; body = { course }; }
      else if (url.pathname === '/api/learning-plan') { generations++; body = { error: 'Must resume the saved course' }; }
      else if (url.pathname === '/api/budget-draft') body = { available: false, workspace: null };
      else body = { course };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await context.addInitScript(({ key, workspace }) => localStorage.setItem(key, JSON.stringify(workspace)), { key, workspace });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await requestStarted;
    await page.locator('.roadmap-stage-node[data-roadmap-stage="0"]').click();
    assert.equal(await page.locator('.ai-lesson-reader').count(), 0);
    release();
    await page.waitForSelector('.ai-lesson-reader', { timeout: 15000 });
    const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(restored.learningCourse.id, id);
    assert.equal(restored.learningPlan.study[0].page, 1);
    assert.equal(restored.learningPlan.answers[0], 'An unsubmitted draft');
    assert.equal(generations, 0);
    assert.ok(loads >= 1);
    assert.deepEqual(errors, []);
    console.log(`${viewport.width}px: first tap survives delayed account hydration; exact page/draft restored; no AI regeneration`);
    await context.close();
  }
} finally {
  await browser.close();
}
