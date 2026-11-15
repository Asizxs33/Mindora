// Browser UI regression with an explicit mock API boundary.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { browser, fixture, sizes, errors, key } from './browser-fixtures.mjs';

try {
 for(const language of ['en','ru','kk']){
  const f=await fixture(language),p=f.page;
  for(const size of [...sizes,{width:640,height:360},{width:1024,height:768},{width:1920,height:1080}]){
   await p.setViewportSize(size);
   const desktop=size.width>920,nav=desktop?'#navigation':'#mobile-navigation';
   await p.locator(nav+' [data-view="courses"]').click();await p.waitForSelector('.course-library');
   assert.equal(await p.locator('.ready-course:visible').count(),0,'Sample courses start collapsed');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Library fits '+size.width);
   const input=p.locator('#course-search');await input.fill('Python');
   assert.equal(await p.locator('.ready-course:visible').count(),1);
   await input.fill('not-a-course-xyz');assert.equal(await p.locator('.ready-course:visible').count(),0);
   assert.ok((await p.locator('[data-course-search-status]').innerText()).length>10);
   await p.locator('[data-course-search-clear]').click();assert.equal(await p.locator('.ready-course:visible').count(),0);
   if(language==='ru'&&[390,1440].includes(size.width))await p.screenshot({path:join(tmpdir(),'mindora-ux-library-'+size.width+'.png'),fullPage:true});
   await p.locator(nav+' [data-view="profile"]').click();
   if(!desktop){
    assert.equal(await p.locator('.profile-more').count(),0);
    assert.equal(await p.locator('.mobile-profile-tools button:visible').count(),4);
    for(const target of await p.locator('.mobile-profile-tools button').all()){const box=await target.boundingBox();assert.ok(box.width>=44&&box.height>=44);}
    if(language==='ru'&&[320,390].includes(size.width))await p.screenshot({path:join(tmpdir(),'mindora-ux-profile-'+size.width+'.png'),fullPage:true});
    await p.locator('.mobile-profile-tools [data-view="work"]').click();
   }else await p.locator('#navigation [data-view="work"]').click();
   assert.equal(await p.locator('#main [data-character-kind="mino"]').count(),1);
   const style=await p.locator('.header-rewards .roadmap-metrics').evaluate(e=>({border:getComputedStyle(e).borderTopWidth,bg:getComputedStyle(e).backgroundColor}));
   assert.equal(style.border,'0px');assert.equal(style.bg,'rgba(0, 0, 0, 0)');
   for(const symbol of ['flame','gem','heart']){
    const button=p.locator('.header-rewards .roadmap-'+symbol),box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44,'Counter target '+symbol+' '+size.width);
    assert.ok(await button.getAttribute('aria-label'));
    assert.equal(await button.locator('span:visible').count(), 0, 'Compact counters show only their icon and value');
   }
   await p.locator('.header-rewards .roadmap-flame').click();await p.waitForSelector('.roadmap-rewards');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(language==='ru'&&[390,1440].includes(size.width))await p.screenshot({path:join(tmpdir(),'mindora-ux-rewards-'+size.width+'.png'),fullPage:true});
  }
  await p.locator('[data-roadmap-claim="finish-lesson"]').click();
  assert.equal(await p.locator('.header-rewards .roadmap-gem strong').innerText(),'40');
  await p.locator('.header-rewards .roadmap-heart').click();
  await p.waitForSelector('.reward-tabs [data-view="shop"][aria-current]');
  await p.locator('[data-roadmap-buy="freeze"]').click();
  assert.equal(await p.locator('.header-rewards .roadmap-gem strong').innerText(),'15');
  await p.locator('.header-rewards .roadmap-gem').click();
  assert.ok(await p.locator('.reward-tabs [data-view="shop"][aria-current]').isVisible());
  await p.setViewportSize(sizes[0]);
  assert.equal(new URL(p.url()).hash, '#shop');
  await p.reload();
  await p.locator('.shop-wallet').waitFor();
  await p.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.progress.design=3;saved.sessions.design.cursor.step=3;localStorage.setItem(key,JSON.stringify(saved));},key);
  await p.goto(new URL('/',p.url()).href);await p.waitForSelector('.learning-hub-node[aria-current="step"]');
  await p.waitForFunction(()=>{const box=document.querySelector('.learning-hub-node[aria-current="step"]').getBoundingClientRect(),nav=document.querySelector('#mobile-navigation').getBoundingClientRect();return box.top>64&&box.bottom<nav.top;}).catch(async e=>{console.log(await p.evaluate(()=>({scrollY,node:document.querySelector('.learning-hub-node[aria-current="step"]').getBoundingClientRect().toJSON(),nav:document.querySelector('#mobile-navigation').getBoundingClientRect().toJSON()})));throw e;});
  await p.locator('.learning-hub-node[aria-current="step"]').click();await p.waitForSelector('.lesson-flow');
  await p.locator('.lesson-exit').click();await p.waitForSelector('.learning-hub');
  assert.equal(await p.locator('.course-path').count(),0,'Exit returns the same map');
  await p.locator('#mobile-navigation [data-view="courses"]').click();
  const started=p.locator('.mini-enrollments [data-course="design"]');
  const title=(await started.locator('strong').first().textContent()).trim();
  assert.equal(await p.locator('.course-saved-section [data-course="design"]').count(),0);
  const waiting=f.holdNextLibrary();await p.locator('[data-learning-refresh]').click();await waiting;
  await p.locator('#course-search').fill(title);
  assert.ok(await started.isVisible(),'Searching reveals the started mini-course');
  await p.locator('#course-search').press('Home');f.releaseLibrary();
  await p.waitForFunction(()=>document.querySelector('.learning-library')?.getAttribute('aria-busy')==='false');
  assert.equal(await p.locator('#course-search').inputValue(),title);
  assert.ok(await p.locator('#course-search').evaluate(e=>e===document.activeElement));
  await p.keyboard.type('x');assert.equal(await p.locator('#course-search').inputValue(),'x'+title);
  await p.setViewportSize({width:1440,height:900});
  for (let visit = 0; visit < 2; visit++) {
   await p.locator('#navigation [data-view="profile"]').click();
   await p.locator('#navigation [data-view="discover"]').click();
   await p.locator('.learning-hub-node[aria-current="step"]').waitFor();
   assert.equal(await p.locator('#mindora-account[open]').count(),0,'Saved names must not reopen the introduction on Learn');
  }
  console.log('PASS visible tools, search recovery, orange counters, work and phone resume '+language);await f.context.close();
 }
 const guest = await fixture('en'), p = guest.page;
 await p.evaluate(key => { const saved=JSON.parse(localStorage.getItem(key)); saved.guestLearning=true; localStorage.setItem('mindora.workspace.v1.guest',JSON.stringify(saved)); },key);
 await p.route('**/api/account',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({available:true,user:null,profile:null})}));
 await p.reload(); await p.waitForSelector('.phone-course-nav');
 await p.locator('#mobile-navigation [data-view="courses"]').click();
 assert.equal(await p.locator('.learning-library-gate').count(),0,'A studying guest is not told to sign in to start');
 assert.equal(await p.locator('.ready-course:visible').count(),0);
 await p.locator('.phone-catalog summary').click();
 assert.ok(await p.locator('.mini-enrollments [data-course="design"]').isVisible());
 await p.setViewportSize({width:1440,height:900});
 await p.locator('#navigation [data-view="discover"]').click();
 await p.locator('.learning-hub-node[aria-current="step"]').waitFor();
 assert.equal(await p.locator('#mindora-account[open]').count(),0,'Guest navigation must keep the course map open');
 await guest.context.close();
 assert.deepEqual(errors,[]);
 console.log('PASS UX journey 320/390/640/768/1024/1440/1920, EN/RU/KK, API fixtures explicitly.');
}finally{await browser.close();}
