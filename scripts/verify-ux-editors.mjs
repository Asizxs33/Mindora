// Browser UI regression with an explicit mock API boundary.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { browser, fixture, workspace, sizes, errors, key } from './browser-fixtures.mjs';

try {
 for(const width of [320,1440])for(const course of ['design','budget']){
  const saved=workspace('en');saved.active=course;saved.progress[course]=2;saved.sessions[course]={lastSeen:Date.now(),cursor:{step:2,page:0,minutes:10}};
  const f=await fixture('en',saved),p=f.page;await p.setViewportSize({width,height:900});
  await p.locator('.learning-hub-node[aria-current="step"]').click();
  if(course==='design'){
   await p.locator('#poster-form [name="title"]').fill('');await p.locator('[data-action="check-work"]').click();
   assert.ok(await p.locator('.check-panel:not(.all-passed)').isVisible());
   await p.locator('#poster-form [name="title"]').fill('Read together');
   await p.locator('#poster-form [name="subtitle"]').fill('Every Saturday at the library');
   await p.locator('#poster-form [name="cta"]').fill('Join us at 10 am');
  }else{
   await p.locator('#budget-formula').fill('=SUM(B2:B4)');await p.locator('#budget-answer').fill('0');await p.locator('[data-action="check-work"]').click();
   assert.ok(await p.locator('.check-panel:not(.all-passed)').isVisible());
   const total=await p.locator('.expense-table .number-cell').evaluateAll(cells=>cells.reduce((sum,c)=>sum+Number(c.querySelector('input')?.value||c.textContent),0));
   await p.locator('#budget-answer').fill(String(total));
  }
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:join(tmpdir(),'mindora-ux-editor-'+course+'-'+width+'.png'),fullPage:true});
  await p.locator('[data-action="check-work"]').click();assert.ok(await p.locator('.check-panel.all-passed').isVisible());
  await p.locator('[data-action="check-work"]').click();
  const state=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.ok(state.works[course]);
  await p.locator('.lesson-exit').click();
  const nav=width>920?'#navigation':'#mobile-navigation';await p.locator(nav+' [data-view="profile"]').click();
  await p.locator((width>920?'#navigation':'.mobile-profile-tools')+' [data-view="work"]').click();
  const download=p.waitForEvent('download');await p.locator('[data-action="download"]').click();
  assert.equal((await download).suggestedFilename(),course==='design'?'mindora-poster.svg':'mindora-expenses.csv');
  console.log('PASS editor invalid/correct answer, saved work, export',course,width);await f.context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
