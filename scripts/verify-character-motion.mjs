// Check real rendered GIF frames, not just an animation-enabled flag.
// Start npm start first; PLAYWRIGHT_MODULE may point to an installed Playwright.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MINDORA_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const minoScenes = JSON.parse(await readFile(new URL('../ui/assets/characters/mino-scenes/manifest.json', import.meta.url), 'utf8'));
let checks = 0;

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/core/app.js', route => route.fulfill({ body: '' }));
  await page.goto(base);
  await page.evaluate(async () => {
    const { character, mountCharacters } = await import('/ui/characters.js');
    document.body.innerHTML = '<main id="motion-fixture"></main>';
    window.renderMotionFixture = (kind = 'mino', offscreen = false, mood = 'welcome') => {
      document.querySelector('#motion-fixture').innerHTML = `<section style="padding:20px;margin-top:${offscreen ? 1400 : 0}px"><div class="guided-content"><p class="guided-dialogue">One small step. I’m with you.</p>${character(kind, mood)}</div><label for="motion-input">Your topic</label><input id="motion-input"><button data-character-motion>Motion</button></section>`;
      mountCharacters();
    };
  });
  const character = page.locator('.mindora-character');
  const image = page.locator('[data-character-animation]');
  const playing = () => page.waitForFunction(() => document.querySelector('.mindora-character')?.dataset.characterPlaying === 'true');
  async function frameHashes(count = 4) {
    const hashes = [];
    for (let index = 0; index < count; index++) {
      hashes.push(createHash('sha256').update(await image.screenshot()).digest('hex'));
      await page.waitForTimeout(110);
    }
    return hashes;
  }
  for (const kind of ['mino', 'mia', 'sam', 'artist', 'copywriter', 'smm']) {
    await page.evaluate(kind => window.renderMotionFixture(kind), kind);
    await playing();
    assert.ok(new Set(await frameHashes()).size >= 3, `${kind} must visibly move before any tap`);
    checks++;
  }

  for (const scene of minoScenes) {
    await page.evaluate(mood => window.renderMotionFixture('mino', false, mood), scene.mood);
    await playing();
    assert.ok((await image.getAttribute('src')).endsWith(scene.image), `${scene.mood} must select its own supplied animation`);
    // Some authored scenes hold their opening pose for 480 ms before a gesture.
    assert.ok(new Set(await frameHashes(9)).size >= 3, `${scene.mood} must visibly move before any tap`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.dataset.characterAnimations === 'off');
    assert.ok((await image.getAttribute('src')).endsWith(scene.still), `${scene.mood} needs its own matching still`);
    assert.equal(new Set(await frameHashes(2)).size, 1, `${scene.mood} must stay still with reduced motion`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    checks += 4;
  }

  await page.evaluate(() => window.renderMotionFixture());
  await playing();
  const input = page.locator('#motion-input');
  await input.fill('Learn Python');
  const before = await input.boundingBox();
  await page.waitForFunction(() => document.querySelector('.mindora-character')?.dataset.characterPlaying === 'false');
  // A learner glancing at their mentor should see the next gesture quickly.
  // The old seven-second pause fails this assertion.
  await page.waitForFunction(() => document.querySelector('.mindora-character')?.dataset.characterPlaying === 'true', null, { timeout: 2400 });
  assert.ok(new Set(await frameHashes()).size >= 3, 'A cached GIF must visibly replay');
  assert.deepEqual(await input.boundingBox(), before, 'Motion must not move the input');
  assert.equal(await input.inputValue(), 'Learn Python');
  assert.equal(await input.evaluate(element => element === document.activeElement), true);
  checks += 4;

  await page.locator('[data-character-motion]').click();
  await page.waitForFunction(() => document.documentElement.dataset.characterAnimations === 'off');
  assert.equal(new Set(await frameHashes(3)).size, 1, 'Turning motion off freezes the visible artwork');
  assert.match(await image.getAttribute('src'), /\.png$/);
  assert.equal(await page.evaluate(() => localStorage.getItem('mindora.characters.motion.v1')), 'off');
  await page.evaluate(() => window.renderMotionFixture());
  assert.equal(await character.getAttribute('data-character-playing'), 'false');
  checks += 4;
  await page.locator('[data-character-motion]').click();
  await playing();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(new Set(await frameHashes(3)).size, 1, 'Reduced motion uses an actual still frame');
  assert.equal(await page.locator('[data-character-motion]').isDisabled(), true);
  checks += 2;
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.evaluate(() => window.renderMotionFixture('mino', true));
  await page.waitForTimeout(200);
  assert.equal(await character.getAttribute('data-character-playing'), 'false');
  assert.match(await image.getAttribute('src'), /\.png$/);
  await character.scrollIntoViewIfNeeded();
  await playing();
  assert.ok(new Set(await frameHashes()).size >= 3, 'Scrolling back to a mentor resumes real movement');
  checks += 3;

  let attempts = 0;
  await page.route('**/design-pack/mino-explain.gif', route => ++attempts === 1 ? route.abort('failed') : route.continue());
  await page.evaluate(() => { scrollTo(0, 0); window.renderMotionFixture('mino', false, 'explaining'); });
  await page.waitForFunction(() => document.querySelector('.mindora-character')?.dataset.characterPlaying === 'true', null, { timeout: 6000 });
  assert.equal(attempts, 2, 'One transient GIF failure recovers without a click or full reload');
  assert.ok(new Set(await frameHashes()).size >= 3);
  checks += 2;

  let failures = 0;
  await page.route('**/design-pack/mino-celebrate.gif', route => { failures++; return route.abort('failed'); });
  await page.evaluate(() => window.renderMotionFixture('mino', false, 'celebrate'));
  await page.waitForTimeout(8800);
  assert.equal(failures, 3, 'A broken GIF stops after the initial request and two retries');
  assert.match(await image.getAttribute('src'), /\.png$/);
  assert.equal(new Set(await frameHashes(3)).size, 1, 'A failed GIF keeps a usable still illustration');
  checks += 3;
  assert.deepEqual(errors, []);
  console.log(`Passed ${checks} visible-motion checks at a 390 px mobile viewport.`);
} finally {
  await browser.close();
}
