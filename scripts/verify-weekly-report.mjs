import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = process.env.MINDORA_URL || 'http://127.0.0.1:4173';

try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({viewport:{ width, height:844 }});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, {waitUntil:'domcontentloaded'});
    await page.locator('[data-view="weekly-report"]:visible').first().waitFor();
    assert.match(await page.locator('h1:visible').first().innerText(), /work skill/i);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.locator('[data-view="weekly-report"]:visible').first().click();
    const form = page.locator('#weekly-report-form');
    const formula = form.locator('[name="formula"]');
    const total = form.locator('[name="total"]');
    await formula.fill('=SUM(B2:B4)');
    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await formula.inputValue(), '=SUM(B2:B4)');
    await total.fill('80');
    await form.locator('select').selectOption('within');
    await form.locator('button').click();
    await page.locator('[data-report-next]').click();
    await formula.fill('=SUM(B2:B4)');
    await total.fill('80');
    await form.locator('select').selectOption('within');
    await form.locator('button').click();
    assert.equal(await page.locator('.report-error').count(),3);
    await formula.fill('=SUM(B2:B5)');
    await total.fill('103');
    await form.locator('select').selectOption('over');
    await form.locator('button').click();
    await page.locator('.report-outcome').waitFor();
    await page.reload({waitUntil:'domcontentloaded'});
    assert.match(await page.locator('.report-outcome').innerText(), /\$103.*\$3 over budget/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    assert.deepEqual(errors, []);
    console.log('PASS', width, 'px · real browser · two reports, incorrect range, draft and completed result after reload');
    await context.close();
  }
} finally { await browser.close(); }
