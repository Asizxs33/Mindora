// Real browser UI with an explicit mock API boundary; no live account credentials.
// Run npm start on MINDORA_URL first. PLAYWRIGHT_MODULE accepts a local package path.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MINDORA_URL || 'http://127.0.0.1:4176';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const user = { id: 'mobile-home-qa', name: 'Aruzhan', email: 'mobile-home@example.test' };
const key = `mindora.workspace.v1.${user.id}`;
const sizes = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }];
const errors = [], checks = [];
const workspace = language => ({
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

async function firstScreen(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const geometry = await page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector), box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, height: box.height, visible: element.checkVisibility() };
    };
    const nav = document.querySelector('#mobile-navigation');
    return { input: rect('#goal-input'), submit: rect('#goal-form button[type="submit"]'),
      nav: nav.checkVisibility() ? nav.getBoundingClientRect().top : innerHeight,
      width: document.documentElement.scrollWidth, vw: innerWidth,
      tabs: [...nav.querySelectorAll('[data-view]')].map(button => button.dataset.view),
      currentActions: [...document.querySelectorAll('.course-home-current-actions button')].map(button => {
        const box = button.getBoundingClientRect(); return { top: box.top, bottom: box.bottom };
      }),
    };
  });
  assert.deepEqual(geometry.tabs, ['courses', 'profile'], `${label}: exactly two bottom sections`);
  assert.ok(geometry.width <= geometry.vw + 1, `${label}: horizontal overflow`);
  for (const [name, rect] of Object.entries({ input: geometry.input, submit: geometry.submit })) {
    assert.ok(rect.visible && rect.top >= 0 && rect.bottom <= geometry.nav + 1, `${label}: ${name} must be visible without scrolling: ${JSON.stringify(geometry)}`);
    assert.ok(rect.height >= 44, `${label}: ${name} needs a comfortable touch target`);
  }
  for (const action of geometry.currentActions.filter(() => geometry.vw <= 920)) {
    assert.ok(action.top >= 0 && action.bottom <= geometry.nav + 1, `${label}: current course actions must be fully visible above navigation: ${JSON.stringify(geometry)}`);
  }
  checks.push(`${label}: composer and navigation`);
}

const nav = (page, view) => page.locator(`#navigation [data-view="${view}"], #mobile-navigation [data-view="${view}"]`).filter({ visible: true }).first();

async function assertComposerSurvivesResponse(test, label) {
  const { page } = test;
  await page.locator('#goal-input').fill('Learn to edit my first video');
  const before = await page.locator('#goal-input').evaluate(input => {
    input.focus(); input.setSelectionRange(9, 13); window.mobileHomeInput = input;
    return { value: input.value, top: input.getBoundingClientRect().top, scroll: scrollY };
  });
  test.releaseLibrary();
  await page.waitForTimeout(250);
  const after = await page.locator('#goal-input').evaluate(input => ({
    sameNode: window.mobileHomeInput === input, focused: document.activeElement === input,
    value: input.value, start: input.selectionStart, end: input.selectionEnd,
    top: input.getBoundingClientRect().top, scroll: scrollY,
  }));
  assert.equal(after.sameNode, true, `${label}: preserve the editing input node (including IME composition)`);
  assert.equal(after.focused, true); assert.equal(after.value, before.value);
  assert.equal(after.start, 9); assert.equal(after.end, 13);
  assert.ok(Math.abs(after.top - before.top) < 1); assert.equal(after.scroll, before.scroll);
  checks.push(`${label}: editing node, value, selection and position preserved`);
}

try {
  for (const language of ['en', 'ru', 'kk']) {
    const test = await fixture(language), { page } = test;
    for (const size of sizes) {
      await page.setViewportSize(size);
      if (size.width <= 920) {
        const create = page.locator('.phone-course-nav [data-view="new-course"]');
        await create.click();
        assert.equal(await page.locator('.course-home-current,.ready-courses,[data-course-library]').count(), 0);
      }
      await firstScreen(page, `${language} ${size.width}`);
      await page.screenshot({ path: join(tmpdir(), `mindora-mobile-home-${language}-${size.width}.png`), fullPage: size.width === 1440 });
    }
    await page.setViewportSize(sizes[1]);
    await page.locator('.phone-course-nav [data-view="my-path"]').click();
    await page.waitForSelector('.learning-hub, .course-path');
    assert.ok(await page.locator('.learning-hub-node, [data-step]').count() >= 4, `${language}: course path has usable lesson nodes`);
    assert.ok(await page.locator('#mobile-navigation [data-view="courses"]').getAttribute('aria-current'), `${language}: path belongs to Courses`);
    await nav(page, 'courses').click();
    await page.waitForSelector('.phone-library');
    assert.equal(await page.locator('#goal-input').count(), 0);
    checks.push(`${language}: path opens from course home`);

    await page.setViewportSize(sizes[0]);
    await nav(page, 'profile').click();
    const logout = page.locator('.profile-signout');
    assert.equal(await logout.isVisible(), true, `${language}: profile logout visible`);
    const logoutBounds = await logout.boundingBox();
    const navBounds = await page.locator('#mobile-navigation').boundingBox();
    assert.ok(logoutBounds.y >= 0 && logoutBounds.y + logoutBounds.height <= navBounds.y, `${language}: logout above fixed navigation without scrolling`);
    await page.screenshot({ path: join(tmpdir(), `mindora-mobile-profile-${language}-320.png`), fullPage: true });
    checks.push(`${language}: phone profile logout accessible`);
    await test.context.close();
  }

  const empty = await fixture('kk', { ...workspace('kk'), active: null, goals: {}, progress: { design: 0, budget: 0 }, sessions: {} });
  await empty.page.setViewportSize(sizes[0]);
  await empty.page.locator('.phone-course-nav [data-view="new-course"]').click();
  await firstScreen(empty.page, 'New signed-in learner 320');
  assert.equal(await empty.page.locator('.course-home-current').count(), 0, 'A new learner must not see invented progress');
  assert.equal(await empty.page.locator('.mindora-character:visible').count(), 1);
  await empty.page.locator('#goal-input').focus();
  assert.equal(await empty.page.locator('.course-home-mino').getAttribute('data-character-mood'), 'listening');
  await empty.page.locator('#goal-input').fill('Мен алғашқы видеомды жасағым келеді');
  assert.equal(await empty.page.locator('.course-home-mino').getAttribute('data-character-mood'), 'idea');
  await empty.page.locator('#time-select').selectOption('5');
  assert.equal(await empty.page.locator('.course-home-mino').getAttribute('data-character-mood'), 'map');
  await empty.page.locator('#goal-form button[type="submit"]').click();
  await empty.page.waitForSelector('#roadmap-form');
  // The goal can be confirmed on the first wizard step, or retained behind the
  // next question. Go back if needed to inspect the actual submitted value.
  if (!await empty.page.locator('#roadmap-form [name="goal"]').count()) {
    await empty.page.locator('[data-roadmap-action="back"]').click();
  }
  assert.equal(await empty.page.locator('#roadmap-form [name="goal"]').inputValue(), 'Мен алғашқы видеомды жасағым келеді');
  checks.push('New learner starts a personal path from the visible composer');
  await empty.context.close();

  // A late saved-course response must not erase text, replace the focused input,
  // reset the selection, or move the composer while the learner is typing.
  const initial = await fixture('en', workspace('en'), { delayInitialLibrary: true });
  await initial.page.setViewportSize(sizes[0]);
  await initial.libraryRequested();
  await initial.page.locator('.phone-course-nav [data-view="new-course"]').click();
  await assertComposerSurvivesResponse(initial, 'Initial account hydration');
  await initial.context.close();

  const delayed = await fixture(), { page } = delayed;
  await page.setViewportSize(sizes[0]);
  await nav(page, 'courses').click();
  const requestSeen = delayed.holdNextLibrary();
  await page.locator('[data-learning-refresh]').evaluate(button => button.click());
  await requestSeen;
  await page.locator('.phone-course-nav [data-view="new-course"]').click();
  await assertComposerSurvivesResponse(delayed, 'Late saved-course refresh');

  await nav(page, 'profile').click();
  await page.locator('.profile-signout').click();
  await page.waitForSelector('[data-guided-step="0"]');
  await page.reload();
  await page.waitForSelector('[data-guided-step="0"]');
  checks.push('Phone logout returns to greeting and stays signed out on reload');
  await delayed.context.close();
  assert.deepEqual(errors, [], 'No browser exceptions');
  console.log(JSON.stringify({ checks: checks.length, results: checks, api: 'Explicit test fixtures; live authentication and generation are not tested.' }, null, 2));
} finally {
  await browser.close();
}
