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
async function context({ signedIn = true, saved = null, width = 390, phone = false, hash = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: phone, hasTouch: phone });
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
  await page.goto(base + hash);
  await page.waitForTimeout(250);
  return { ctx, page };
}

const guestState=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mindora.workspace.v1.guest')));
async function verifyPlusDemo(width) {
  const phone = width < 921;
  const { ctx, page } = await context({ signedIn: false, width, phone, hash: '#plus' });
  const shop = page.locator('.plus-shop');
  const plan = name => shop.locator('[data-demo-select="' + name + '"]');
  const action = name => shop.locator('[data-demo-action="' + name + '"]');
  const badge = page.locator('.topbar .plus-badge');
  const nav = phone ? '#mobile-navigation' : '#navigation';
  const use = control => phone ? control.tap() : control.click();
  const fits = async () => {
    assert.ok(await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return document.documentElement.scrollWidth <= width &&
        [...document.querySelectorAll('.mindora-shop button, .mindora-shop input')].every(el => {
          const box = el.getBoundingClientRect();
          return !box.width || (box.left >= -1 && box.right <= width + 1);
        });
    }), 'Shop controls must fit a ' + width + 'px viewport');
  };
  try {
    // Each size starts in a fresh guest profile. The previous guest's demo must not leak.
    await plan('annual').waitFor();
    assert.equal(await badge.count(), 0);
    assert.ok(await plan('annual').isEnabled() && await plan('monthly').isEnabled());
    assert.match(await plan('annual').innerText(), /\$99\.99/);
    assert.match(await plan('monthly').innerText(), /\$9\.99/);
    await fits();
    await use(plan('annual'));
    assert.equal(await badge.count(), 0, 'Pending checkout does not activate Plus');
    const prices = shop.locator('.checkout-lines dd');
    assert.match(await prices.first().textContent(), /\$99\.99/);
    assert.equal(await prices.last().textContent(), '$0.00');
    await fits();
    await use(action('confirm'));
    await badge.waitFor();
    await page.reload();
    await action('practice').waitFor();
    assert.equal(new URL(page.url()).hash, '#plus');
    await badge.waitFor();
    await fits();
    await use(page.locator(nav + ' [data-view="profile"]'));
    const membership = page.locator('.plus-profile-status');
    assert.match(await membership.innerText(), /Demo active · Annual/);
    await use(membership.locator('[data-view="membership"]'));
    await use(action('practice'));
    const displayed = await shop.locator('.checkout-lines dd').allTextContents();
    const [quantity, unitPrice, discount] = displayed.map(value => Number(value.replace(/[^\d.]/g, '')));
    const total = quantity * unitPrice - discount;
    assert.ok(Number.isInteger(total) && total > 0);
    const input = shop.locator('#invoice-total');
    const check = shop.locator('#demo-invoice button');
    await fits();
    await input.fill('0');
    await use(check);
    assert.equal(await input.getAttribute('aria-invalid'), 'true');
    assert.deepEqual(await shop.locator('.checkout-lines dd').allTextContents(), displayed);
    await input.fill(String(total));
    await use(check);
    const checked = shop.locator('[role="status"]');
    assert.ok((await checked.innerText()).includes('$' + total.toFixed(2)));
    await use(action('practice'));
    assert.equal(await input.inputValue(), '');
    await use(action('back'));
    await use(action('choose'));
    assert.ok(await plan('annual').isDisabled());
    await use(plan('monthly'));
    assert.match(await prices.first().textContent(), /\$9\.99/);
    await use(action('confirm'));
    await use(page.locator('.shop-sections [data-view="shop"]'));
    assert.equal(new URL(page.url()).hash, '#shop');
    await page.reload();
    await page.locator('.shop-wallet').waitFor();
    await fits();
    assert.equal(await shop.count(), 0);
    await use(page.locator('.shop-sections [data-view="membership"]'));
    assert.equal(new URL(page.url()).hash, '#plus');
    await use(action('choose'));
    assert.ok(await plan('monthly').isDisabled() && await plan('annual').isEnabled());
    await use(page.locator(nav + ' [data-view="profile"]'));
    assert.match(await membership.innerText(), /Demo active · Monthly/);
    await use(page.locator(nav + ' [data-view="courses"]'));
    const design = page.locator('.ready-course[data-course="design"]');
    if (!await design.isVisible()) await use(page.locator('.phone-catalog summary'));
    await use(design);
    await use(page.locator('.learning-hub-node[aria-current="step"]'));
    await page.locator('.lesson-progress-head .plus-badge').waitFor();
    await fits();
    await page.goto(new URL('/welcome', base).href);
    await page.locator('.landing-brand .plus-badge').waitFor();
  } finally {
    await ctx.close();
  }
}

try {
 for (const width of [320, 390, 1440]) await verifyPlusDemo(width);
 console.log('PASS Plus demo checkout, saved status, profile, lesson and landing badges at 320/390/1440.');
 for (const width of [320, 390]) {
  const { ctx, page } = await context({ signedIn: false, width, phone: true });
  try {
   await page.locator('#mindora-account[open] #account-name').waitFor();
   await page.locator('[data-account-action="guest"]').tap();
   await page.locator('#goal-input').waitFor();
   assert.ok(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
   ), `Creator exceeds the ${width}px phone viewport`);
   await page.locator('#mobile-navigation [data-view="courses"]').tap();
   await page.locator('.phone-catalog').waitFor();
  } finally {
   await ctx.close();
  }
 }
 const first=await context({signedIn:false}),p=first.page;
 const calls=[];p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push({path:new URL(r.url()).pathname,method:r.method(),guest:r.headers()['x-mindora-guest']});});
 for(const width of [320,390,1440]){
  await p.setViewportSize({width,height:844});
  await p.waitForTimeout(250);
  assert.equal(await p.locator('.mindora-landing').isVisible(),true);
  assert.equal(await p.locator('.landing-hero .landing-mascot').count(),1);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await p.locator('.sidebar').isVisible(),false);
  assert.equal(await p.locator('.mobile-navigation').isVisible(),false);
  await p.screenshot({path:join(tmpdir(),'mindora-welcome-'+width+'.png'),fullPage:true});
 }
 await p.setViewportSize({width:390,height:844});
 await p.locator('#mindora-account[open] #account-name').waitFor();
 await p.locator('[data-account-action="close"]').click();
 await p.locator('.landing-hero [data-account-open="signup"]').click();
 await p.locator('[data-account-action="guest"]').click();
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
 await p.locator('.roadmap-stage-node[data-roadmap-stage="3"]').click();
 await p.waitForSelector('.lesson-stream');
 assert.deepEqual((await guestState(p)).learningRoadmap.opened, [3]);
 assert.equal((await guestState(p)).learningRoadmap.progress.filter(stage => stage.completed).length, 0);
 await p.locator('.ai-lesson-exit').click();
 await p.locator('[data-roadmap-stage="0"]').click();
 await p.waitForSelector('.ai-lesson-reader');
 await p.locator('[data-learning-gap]').focus();
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
 await r.locator('#learning-step-form').waitFor();
 for(const answer of ['print("My lesson")','print("Hello")\nprint("Mindora")']){
  await r.locator('#learning-step-form textarea').fill(answer);
  await r.locator('#learning-step-form button[type="submit"]').click();
  await r.locator('[data-learning-step="continue"]').click();
 }
 await r.waitForSelector('#learning-plan-complete');
 assert.equal((await guestState(r)).learningRoadmap.progress[0].completed,true);
 await r.locator('[data-action="next-path-lesson"]').click();
 await r.waitForSelector('.ai-lesson-reader');
 assert.equal((await guestState(r)).guestCourses.length,3);
 assert.equal(calls.filter(r=>r.path==='/api/account'&&r.method==='POST').length,0);
 assert.ok(calls.some(r=>r.path==='/api/learning-plan'&&r.guest==='1'));
 assert.deepEqual(errors,[]);
 console.log('PASS public landing page at 320/390/1440, real UI guest roadmap -> generated lesson -> close/reopen cursor -> complete -> next stage. API fixtures explicitly.');
 await first.ctx.close();
}finally{await browser.close();}
