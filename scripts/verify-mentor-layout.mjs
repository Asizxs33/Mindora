// Browser layout regression against the real UI renderers, not screenshot mocks.
// Run a local server first; PLAYWRIGHT_MODULE can point to an installed package.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MINDORA_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const sizes = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }];
const mentors = ['mino', 'mia', 'sam', 'artist', 'copywriter', 'smm'];
const poses = ['welcome', 'thinking', 'explaining', 'encourage', 'incorrect', 'celebrate'];
const failures = [], errors = [];
let checks = 0;

async function geometry(page, label) {
  const issues = await page.evaluate(() => {
    const issues = [], root = document.querySelector('dialog[open]') || document.getElementById('main') || document.getElementById('template-stage');
    const visible = el => el?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const lines = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!node.textContent.trim() || !visible(parent) || parent.closest('.mindora-character,script,style,.sr-only')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const box of range.getClientRects()) if (box.width && box.height) lines.push({ box, text: node.textContent.trim().slice(0, 65) });
    }
    for (const character of root.querySelectorAll('.mindora-character')) {
      const art = character.classList.contains('character-image-error')
        ? [...character.querySelectorAll('.human-source-fallback path,.human-source-fallback rect,.human-source-fallback circle,.human-source-fallback ellipse')]
        : [...character.querySelectorAll('[data-character-animation]')];
      for (const element of art.filter(visible)) {
        const box = element.getBoundingClientRect();
        for (const line of lines) if (intersects(box, line.box)) issues.push(`${character.dataset.characterKind} overlaps “${line.text}”`);
      }
      const reaction = character.querySelector('.character-reaction');
      if (visible(reaction)) for (const line of lines) if (intersects(reaction.getBoundingClientRect(), line.box)) issues.push(`Tap popup overlaps “${line.text}”`);
    }
    for (const bubble of root.querySelectorAll('[data-mentor-message],.guided-dialogue,.return-review-speech,.account-intro-copy')) {
      if (bubble.closest('[hidden]')) continue; // Inactive lesson pages are intentionally hidden.
      if (!visible(bubble) || !bubble.textContent.trim()) issues.push('Teaching dialogue is hidden or empty');
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('Horizontal page overflow');
    return [...new Set(issues)];
  });
  checks++;
  if (issues.length) {
    failures.push({ label, issues });
    if (failures.length <= 5) await page.screenshot({ path: join(tmpdir(), `mindora-layout-failure-${failures.length}.png`), fullPage: true });
  }
}

try {
  const context = await browser.newContext();
  await context.route('**/core/app.js', route => route.fulfill({ body: '' }));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.evaluate(async () => {
    const [characters, scenes, views, guided, reviews, reviewCore, language] = await Promise.all([
      import('/ui/characters.js'), import('/ui/mentor-scenes.js'), import('/ui/views.js'), import('/ui/guided-start.js'),
      import('/ui/return-review.js'), import('/core/return-review.js'), import('/ui/language.js'),
    ]);
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/ui/guided-start.css'; document.head.append(css);
    const state = { active: 'design', progress: { design: 0, budget: 0 }, goals: { design: 'Make a poster' }, works: {}, minutes: 10 };
    window.renderLayoutFixture = ({ kind, mentor = 'mino', pose = 'welcome', step = 0 }) => {
      document.body.className = kind === 'intro' ? 'quiet-shell is-guided' : kind === 'hub' ? 'quiet-shell' : kind === 'path' ? '' : 'is-learning';
      let html;
      if (kind === 'mentor') html = scenes.mentorScene(mentor, pose, '<h1>One idea at a time.</h1><p>A clear example helps you understand. Try a small step, then see what happens.</p>', '', { hint: 'Take your time. The main explanation stays visible.' });
      if (kind === 'intro') html = guided.guidedStartView({ step, name: 'Aruzhan', topic: 'design' });
      if (kind === 'hub') html = guided.quietHomeView(state);
      if (kind === 'path') html = views.pathView(state);
      if (kind === 'lesson') html = views.lesson(state, { step: 0, questionCount: 3, quizIndex: 0, draft: {} });
      if (kind === 'review') {
        const review = reviewCore.createReturnReview({ key: 'layout', mentor, questions: [{ type: 'choice', question: 'How can you make your next learning step easier to understand?', options: ['One useful idea', 'Everything at once', 'Skip the example'], answer: 0, explanation: 'Focus on one useful idea.' }] });
        review.phase = step ? 'question' : 'intro'; html = reviews.returnReviewView(review);
      }
      document.getElementById('app').innerHTML = `<div class="app-shell"><main id="main" data-page="discover">${html}</main></div>`;
      characters.mountCharacters(); window.scrollTo(0, 0);
    };
    window.setLayoutLanguage = language.setLanguage;
  });
  const render = async fixture => {
    await page.evaluate(fixture => window.renderLayoutFixture(fixture), fixture);
    await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link => link.href.includes('/ui/')).every(link => link.sheet));
    await page.waitForTimeout(70);
  };
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const mentor of mentors) for (const pose of poses) {
      await render({ kind: 'mentor', mentor, pose });
      await geometry(page, `${size.width}/${mentor}/${pose}`);
      await page.locator('.mindora-character').click();
      await geometry(page, `${size.width}/${mentor}/${pose}/tap`);
      if (mentor !== 'mino') {
        // Exercise the actual SVG fallback at gesture extremes as well as GIFs.
        await page.locator('.mindora-character').evaluate(el => el.classList.add('character-image-error'));
        for (const time of [0, 350, 700]) {
          await page.locator('.mindora-character').evaluate((el, time) => {
            for (const animation of el.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; }
          }, time);
          await geometry(page, `${size.width}/${mentor}/${pose}/fallback-${time}`);
        }
      }
    }
    for (const kind of ['intro', 'hub', 'path', 'lesson', 'review']) {
      for (const step of kind === 'intro' ? [0, 1, 2, 3] : kind === 'review' ? [0, 1] : [0]) {
        await render({ kind, step, mentor: 'mia' });
        if (kind === 'intro' && step === 0) {
          await page.waitForFunction(() => document.querySelector('.guided-mino')?.dataset.characterPlaying === 'true');
          assert.match(await page.locator('.guided-mino [data-character-animation]').getAttribute('src'), /\.gif$/);
        }
        await geometry(page, `${size.width}/${kind}/${step}`);
        const speech = await page.locator('.guided-dialogue,.return-review-speech,[data-mentor-message]').allTextContents();
        await page.locator('.mindora-character').first().click();
        await geometry(page, `${size.width}/${kind}/${step}/tap`);
        assert.deepEqual(await page.locator('.guided-dialogue,.return-review-speech,[data-mentor-message]').allTextContents(), speech, 'A tap must not replace the visible teaching content');
        if (step === 0 && ['intro', 'hub', 'path', 'lesson'].includes(kind)) await page.screenshot({ path: join(tmpdir(), `mindora-layout-${kind}-${size.width}.png`), fullPage: true });
      }
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await render({ kind: 'mentor', mentor: 'mia', pose: 'explaining' });
  assert.match(await page.locator('[data-character-animation]').getAttribute('src'), /\.png$/);
  assert.equal(await page.locator('.mindora-character').getAttribute('data-character-playing'), 'false');
  await geometry(page, 'reduced-motion');
  await context.close();

  const templates = await browser.newPage();
  templates.on('pageerror', error => errors.push(error.message));
  await templates.goto(`${base}/ui/template-library.html`);
  for (const size of sizes) {
    await templates.setViewportSize(size);
    for (let index = 0; index < 10; index++) {
      await templates.selectOption('#template-picker', String(index));
      await templates.waitForTimeout(70);
      await geometry(templates, `${size.width}/template-${index + 1}`);
    }
  }
  await templates.close();

  const accounts = await browser.newContext();
  await accounts.route('**/api/account', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ available: true, user: null, profile: null }) }));
  const account = await accounts.newPage();
  account.on('pageerror', error => errors.push(error.message));
  await account.goto(base);
  for (const size of sizes) {
    await account.setViewportSize(size);
    for (const mode of ['signup', 'signin', 'guided']) {
      await account.evaluate(async mode => {
        const { openAccount, closeAccount } = await import('/ui/account.js'); closeAccount();
        await openAccount(mode === 'guided' ? 'signup' : mode, mode === 'guided' ? { name: 'Aruzhan', goal: 'Make a poster' } : null);
      }, mode);
      await account.waitForTimeout(100);
      await geometry(account, `${size.width}/account-${mode}`);
      await account.locator('dialog[open] .mindora-character').click();
      await geometry(account, `${size.width}/account-${mode}/tap`);
    }
  }
  await accounts.close();

  for (const size of sizes.slice(0, 2)) {
    const signed = await browser.newContext({ viewport: size });
    let identity = true, rejectSignout = true;
    await signed.addInitScript(() => localStorage.setItem('mindora.workspace.v1.layout-profile', JSON.stringify({ version: 1, active: 'design', progress: { design: 1, budget: 0 }, minutes: 10 })));
    await signed.route('**/api/**', async route => {
      const request = route.request(); let data = { available: false }, status = 200;
      if (new URL(request.url()).pathname === '/api/account') {
        if (request.method() === 'POST' && request.postDataJSON().action === 'signout') {
          if (rejectSignout) { rejectSignout = false; status = 503; }
          else identity = false;
        }
        data = status === 503 ? { message: 'Please retry signing out.' } : { available: true, user: identity ? { id: 'layout-profile', name: 'Aruzhan', email: 'qa@example.test' } : null, profile: identity ? { name: 'Aruzhan', interests: [] } : null };
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const profile = await signed.newPage();
    profile.on('pageerror', error => errors.push(error.message));
    await profile.goto(base);
    await profile.locator('#mobile-navigation [data-view="profile"]').click();
    await profile.locator('[data-account-signout]').click();
    await profile.locator('#account-error:not([hidden])').waitFor();
    assert.equal(await profile.evaluate(async () => Boolean((await import('/ui/account.js')).getAccountState().user)), true, 'A failed signout must preserve the session');
    await geometry(profile, `${size.width}/failed-signout`);
    // A reduced dynamic viewport models the browser controls/onscreen keyboard.
    await profile.setViewportSize({ width: size.width, height: 450 });
    await profile.locator('[data-account-action="signout"]').click();
    await profile.waitForFunction(() => !document.querySelector('dialog[open]'));
    await profile.locator('.guided-greeting').waitFor();
    await profile.setViewportSize(size);
    await profile.screenshot({ path: join(tmpdir(), `mindora-layout-after-signout-${size.width}.png`), fullPage: true });
    assert.equal(await profile.evaluate(async () => (await import('/ui/account.js')).getAccountState().user), null);
    await signed.close();
  }
  assert.deepEqual(errors, [], 'Browser errors');
  assert.deepEqual(failures, [], 'Character/text overlap; first failures are screenshotted in the system temp directory');
  console.log(`PASS: ${checks} mentor/text geometry checks, all 6 mentors × 6 poses, SVG gesture extremes, 10 lesson templates, intro/path/lesson/review/account, 4 viewport sizes and reduced motion.`);
} finally {
  await browser.close();
}

