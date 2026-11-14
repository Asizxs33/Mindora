// Check real rendered animation frames, not just an animation-enabled flag.
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
  let page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
  let image = page.locator('[data-character-animation]');
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

  await page.evaluate(() => window.renderMotionFixture('mia'));
  await playing();
  const uri = await image.getAttribute('src');
  let previous, stableSince = Date.now(), rested = false, followingChanges = 0;
  const deadline = Date.now() + 14000;
  while (Date.now() < deadline && followingChanges < 3) {
    const [frame] = await frameHashes(1);
    if (frame !== previous) {
      if (rested) followingChanges++;
      previous = frame;
      stableSince = Date.now();
    } else if (Date.now() - stableSince > 2450) rested = true;
  }
  assert.ok(rested, 'Human mentor holds the resting pose');
  assert.ok(followingChanges >= 3, 'Human gesture repeats after its three-second hold');
  assert.equal(await image.getAttribute('src'), uri, 'No swapping between still and animation');
  checks += 3;

  for (const scene of minoScenes) {
    await page.evaluate(mood => window.renderMotionFixture('mino', false, mood), scene.mood);
    await playing();
    assert.ok((await image.getAttribute('src')).endsWith(scene.image.replace('.gif', '.webp')), `${scene.mood} must select its own supplied animation`);
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
  await page.waitForTimeout(3900);
  assert.ok(new Set(await frameHashes(14)).size >= 3, 'The native animation replays without a tap');
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

  // A new document drops decoded image references before exercising failures.
  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/core/app.js', route => route.fulfill({ body: '' }));
  await page.goto(base);
  image = page.locator('[data-character-animation]');
  await page.evaluate(async () => {
    const { character, mountCharacters } = await import('/ui/characters.js');
    document.body.innerHTML = '<main id="motion-fixture"></main>';
    window.renderMotionFixture = (kind, offscreen, mood) => {
      document.querySelector('#motion-fixture').innerHTML = character(kind, mood);
      mountCharacters();
    };
  });
  let attempts = 0;
  await page.route('**/characters/mino-scenes/02-bright-idea.webp', route => ++attempts === 1 ? route.abort('failed') : route.continue());
  await page.evaluate(() => { scrollTo(0, 0); window.renderMotionFixture('mino', false, 'explaining'); });
  await page.waitForFunction(() => document.querySelector('.mindora-character')?.dataset.characterPlaying === 'true', null, { timeout: 6000 });
  assert.equal(attempts, 2, 'One transient animation failure recovers without a click or full reload');
  assert.ok(new Set(await frameHashes()).size >= 3);
  checks += 2;

  let failures = 0;
  await page.route('**/characters/mino-scenes/07-applause.webp', route => { failures++; return route.abort('failed'); });
  await page.evaluate(() => window.renderMotionFixture('mino', false, 'celebrate'));
  await page.waitForTimeout(8800);
  assert.equal(failures, 3, 'A broken animation stops after the initial request and two retries');
  assert.match(await image.getAttribute('src'), /\.png$/);
  assert.equal(new Set(await frameHashes(3)).size, 1, 'A failed animation keeps a usable still illustration');
  checks += 3;
  assert.deepEqual(errors, []);
  console.log(`Passed ${checks} visible-motion checks at a 390 px mobile viewport.`);
} finally {
  await browser.close();
}
