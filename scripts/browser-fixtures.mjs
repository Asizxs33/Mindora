// Real browser UI with an explicit mock API boundary; no live account credentials.
// Run npm start on MINDORA_URL first. PLAYWRIGHT_MODULE accepts a local package path.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MINDORA_URL || 'http://127.0.0.1:4176';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const user = { id: 'mobile-home-qa', name: 'Aruzhan', email: 'mobile-home@example.test' };
const key = `mindora.workspace.v1.${user.id}`;
const sizes = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }];
const errors = [];
const workspace = language => ({
  learningRewards: {hearts:4,heartAt:Date.now(),gems:30,freezes:0,streak:1,lastDay:Math.floor(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())/86400000),lessons:1,lessonIds:[],checks:[],daily:{day:Math.floor(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())/86400000),lessons:1,correct:1,claimed:[]}},
  version: 1, language, minutes: 10, active: 'design', lastLearningType: 'builtin', pathKind: 'builtin',
  goals: { design: 'Make my first poster' }, progress: { design: 1, budget: 0 },
  drafts: {}, works: {}, notes: {}, certificates: {}, practiceCount: 0, studyDays: [],
  sessions: { design: { lastSeen: Date.now(), cursor: { step: 1, page: 0, minutes: 10, quizIndex: 0, quizChoice: null, quizFeedback: false } } },
});

async function fixture(language = 'en', saved = workspace(language), { delayInitialLibrary = false } = {}) {
  const context = await browser.newContext({ viewport: sizes[1] });
  let signedIn = true, revision = 0, holdLibrary = delayInitialLibrary, releaseLibrary, announceRequest;
  let requested = delayInitialLibrary ? new Promise(resolve => { announceRequest = resolve; }) : Promise.resolve();
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    let body;
    if (url.pathname === '/api/account') {
      if (request.method() === 'POST') signedIn = request.postDataJSON().action !== 'signout';
      body = { available: true, user: signedIn ? user : null, profile: signedIn ? { name: user.name, interests: [] } : null };
    } else if (url.pathname === '/api/learning-workspace') {
      body = request.method() === 'PUT' ? { workspace: { data: request.postDataJSON().data, revision: ++revision } } : { workspace: null };
    } else if (url.pathname === '/api/learning-courses') {
      if (holdLibrary && request.method() === 'GET') {
        holdLibrary = false;
        await new Promise(resolve => { releaseLibrary = resolve; announceRequest(); });
      }
      body = { courses: [] };
    } else if (url.pathname === '/api/budget-draft') body = { available: false, workspace: null };
    else body = { error: 'Outside this UI fixture' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await context.addInitScript(({ key, saved }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved));
  }, { key, saved });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForSelector('.phone-course-nav');
  await page.locator('#interface-language').selectOption(language);
  assert.equal(await page.locator('html').getAttribute('lang'), language);
  return {
    context, page,
    libraryRequested: () => requested,
    holdNextLibrary() { holdLibrary = true; requested = new Promise(resolve => { announceRequest = resolve; }); return requested; },
    releaseLibrary() { releaseLibrary?.(); },
  };
}


export { browser, fixture, workspace, sizes, errors, key };
