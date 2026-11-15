import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel:'chrome', headless:true });
const base = process.env.MINDORA_URL || 'http://127.0.0.1:4173';
const sheet = { type:'sheet', columns:['Name','Units'], rows:[['A',2],['B',7]], target:'=SUM(B2:B3)' };
const examples = [
  [{ ...sheet, type:'sql', table:'sales', target:'SELECT Units FROM sales' }, 'SELECT Name FROM sales', 'SELECT Units FROM sales'],
  [{ type:'sql', table:'small_shop', columns:['item','amount'], rows:[['Tea',12],['Milk',20]], target:'SELECT amount AS quantity FROM small_shop' },
    'SELECT amount AS price FROM small_shop', 'SELECT amount AS quantity FROM small_shop;'],
  [sheet, '=SUM(B2:B2)', '=SUM(B2:B3)'],
  [{ type:'bar-chart', labels:['Jan','Feb'], max:50 }, '100', ['12','18']],
  [{ type:'flow', labels:['Source','Review','Publish'] }, '', ['Brief','Peer check','Email']],
  [{ type:'conversation', turns:['Hi, how can I help?', 'When do you need it?'] }, '', ['Could I get the report?', 'Friday, please.']],
];

try {
  const page = await browser.newPage();
  await page.route('**/core/app.js', r=>r.fulfill({body:''}));
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  for (const width of [320,1440]) {
    await page.setViewportSize({width,height:840});
    for (const [practice, wrong, correct] of examples) {
      const mount = async () => {
        await page.goto(base);
        await page.evaluate(async practice => {
          const { practiceEditor } = await import('/ui/lesson-practice.js');
          const { createPracticeController } = await import('/core/practice-controller.js');
          const { setLanguage } = await import('/ui/language.js');
          setLanguage('kk');
          const style = document.createElement('link'); style.rel='stylesheet'; style.href='/ui/lesson-practice.css';
          document.head.append(style);
          const form = document.createElement('form');
          form.id='learning-step-form';
          form.style.maxWidth='680px';
          const key = 'test-studio-' + practice.type;
          form.innerHTML=practiceEditor(practice, localStorage.getItem(key) || '',false)+'<button type="submit">OK</button>';
          document.body.append(form);
          createPracticeController({document,getPractice:()=>practice,onAnswer:v=>localStorage.setItem(key,v)});
          form.addEventListener('submit',e=>{e.preventDefault();form.dataset.submitted='true'});
        }, practice);
      };
      await mount();
      const fields = page.locator('[data-practice-field]');
      await fields.first().fill(wrong);
      await page.locator('[type="submit"]').click();
      assert.equal(await page.locator('form').getAttribute('data-submitted'),null);
      // Reload the incorrect draft before retrying: browser validity must be reconstructed.
      await mount();
      assert.equal(await fields.first().inputValue(),practice.type==='bar-chart' ? '' : wrong);
      await page.locator('[type="submit"]').click();
      assert.equal(await page.locator('form').getAttribute('data-submitted'),null);
      const values = Array.isArray(correct) ? correct : [correct];
      for (const [i,value] of values.entries()) await fields.nth(i).fill(value);
      await page.locator('[type="submit"]').click();
      assert.equal(await page.locator('form').getAttribute('data-submitted'),'true');
      await mount();
      for (const [i,value] of values.entries()) assert.equal(await fields.nth(i).inputValue(),value);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.evaluate(()=>localStorage.clear());
      console.log('PASS',width,practice.type,'invalid → reload → correction → submit → reload');
    }
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
