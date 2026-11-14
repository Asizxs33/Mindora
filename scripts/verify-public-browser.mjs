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

const guestState=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mindora.workspace.v1.guest')));
try {
 const first=await context({signedIn:false}),p=first.page;
 const calls=[];p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push({path:new URL(r.url()).pathname,method:r.method(),guest:r.headers()['x-mindora-guest']});});
 for(const width of [320,390,1440]){
  await p.setViewportSize({width,height:844});
  await p.waitForTimeout(250);
  assert.equal(await p.locator('.mindora-landing').isVisible(),true);
  assert.equal(await p.locator('.landing-mino').count(),1);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await p.locator('.sidebar').isVisible(),false);
  assert.equal(await p.locator('.mobile-navigation').isVisible(),false);
  await p.screenshot({path:join(tmpdir(),'mindora-landing-'+width+'.png'),fullPage:true});
 }
 await p.setViewportSize({width:390,height:844});
 await p.locator('.landing-start [data-view="new-course"]').click();
 await p.locator('#goal-input').fill('Learn spreadsheet formulas for my weekly report');
 await p.locator('#time-select').selectOption('5');
 await p.locator('#goal-form button[type="submit"]').click();
 await p.locator('[name="direction"][value="0"]').check();
 await p.locator('#roadmap-form button[type="submit"]').click();
 await p.locator('[name="experience"][value="new"]').check();
 await p.locator('[name="diagnosticUnknown"]').check();
 await p.locator('#roadmap-form button[type="submit"]').click();
 await p.locator('[name="motivation"][value="work"]').check();
 await p.locator('#roadmap-form button[type="submit"]').click();
 await p.locator('[name="minutes"][value="5"]').check();
 await p.locator('#roadmap-form button[type="submit"]').click();
 await p.waitForSelector('.roadmap-layout');
 await p.screenshot({path:join(tmpdir(),'mindora-compact-path.png'),fullPage:true});
 await p.locator('[data-roadmap-stage="0"]').click();
 await p.waitForSelector('.ai-lesson-reader');
 await p.locator('[data-learning-page="next"]:visible').click();
 await p.locator('[data-learning-page="next"]:visible').click();
 const before=await guestState(p);const requests=lessonRequests.length;
 await p.locator('.ai-lesson-exit').click();
 await p.close();
 const r=await first.ctx.newPage();r.setDefaultTimeout(15000);
 await r.goto(base);await r.waitForSelector('.roadmap-layout');
 await r.locator('[data-roadmap-stage="0"]').click();
 await r.waitForSelector('.ai-lesson-reader');
 assert.equal((await guestState(r)).learningPlan.study[0].page,before.learningPlan.study[0].page);
 assert.equal(lessonRequests.length,requests);
 await r.locator('[data-learning-gap]').fill('"Hello"');
 await r.locator('[data-learning-page="check"]').click();
 await r.locator('[data-learning-page="next"]:visible').click();
 await r.locator('[data-learning-page="next"]:visible').click();
 for(const answer of ['print("My lesson")','print("Hello")\nprint("Mindora")']){
  await r.locator('#learning-step-form textarea').fill(answer);
  await r.locator('#learning-step-form button[type="submit"]').click();
  await r.locator('[data-learning-step="continue"]').click();
 }
 await r.waitForSelector('#learning-plan-complete');
 assert.equal((await guestState(r)).learningRoadmap.progress[0].completed,true);
 await r.locator('[data-action="next-path-lesson"]').click();
 await r.waitForSelector('.ai-lesson-reader');
 assert.equal((await guestState(r)).guestCourses.length,2);
 assert.equal(calls.filter(r=>r.path==='/api/account'&&r.method==='POST').length,0);
 assert.ok(calls.some(r=>r.path==='/api/learning-plan'&&r.guest==='1'));
 assert.deepEqual(errors,[]);
 console.log('PASS public landing at 320/390/1440, real UI guest roadmap -> generated lesson -> close/reopen cursor -> complete -> next stage. API fixtures explicitly.');
 await first.ctx.close();
}finally{await browser.close();}
