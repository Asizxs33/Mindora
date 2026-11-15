import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWeeklyReport, reportProgress } from '../core/weekly-report.js';
import { validateBuiltinWorkspace } from '../backend/builtin-workspace.js';
import { quotaIdentity } from '../backend/personal-course-quota.js';
import { roadmapApi } from '../backend/roadmap-api.js';

test('a new expense requires a wider range and changes the budget decision', () => {
  const first = { formula: '=sum(B2:B4)', total: '80', decision: 'within' };
  assert.deepEqual(Object.values(checkWeeklyReport(0,first)), [true,true,true]);
  assert.deepEqual(Object.values(checkWeeklyReport(1,first)), [false,false,false]);
  assert.deepEqual(Object.values(checkWeeklyReport(1,{ formula: '=SUM(B2:B5)', total: '103', decision: 'over' })), [true,true,true]);
});

test('the synced workspace retains both the independent draft and first report', () => {
  const progress = reportProgress();
  Object.assign(progress.days[0], { formula:'=SUM(B2:B4)', total:'80', decision:'within', completed:true });
  progress.day = 1;
  progress.days[1].formula = '=SUM(';
  const restored = validateBuiltinWorkspace({ weeklyReport: progress });
  assert.deepEqual(reportProgress(restored.weeklyReport),progress);
  assert.equal(reportProgress({ day:1 }).day,0);
});

test('guest quota cookie is reused and signed-in quota uses the verified user', () => {
  const cookies = [], url = 'https://mindora.test/api/learning-roadmap';
  const id = quotaIdentity(new Request(url), null, cookies);
  const request = new Request(url,{ headers:{ cookie:cookies[0].split(';')[0] } });
  assert.equal(quotaIdentity(request,null,[]),id);
  assert.equal(quotaIdentity(request,{id:'alice'},[]),'account:alice');
});

test('a spent free course is rejected before generation', async () => {
  const url = 'https://mindora.test/api/learning-roadmap';
  const request = new Request(url,{method:'POST',headers:{origin:'https://mindora.test','content-type':'application/json','X-Mindora-Guest':'1'},
    body:JSON.stringify({goal:'Learn spreadsheet formulas',minutes:5,language:'en',experience:'new',motivation:'work'})});
  let called = false;
  const response = await roadmapApi(request,{ settings:{},apiKey:'fixture',quota:()=>({run:async()=>({code:'COURSE_LIMIT'})}),generate:async()=>{called=true;} });
  assert.equal(response.status,402);
  assert.equal(called,false);
});
