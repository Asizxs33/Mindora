import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWeeklyReport, completedReport, reportProgress, submitReport, reportReturnDue, weeklyReportCsv } from '../core/weekly-report.js';
import { parseHTML } from 'linkedom';
import { weeklyReportProject, weeklyReportView } from '../ui/work-skills.js';
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

test('later-day independent practice is distinguished from immediate practice and counts checked attempts', () => {
  const progress = reportProgress();
  const today = new Date(2026, 10, 15, 16).getTime();
  const tomorrow = new Date(2026, 10, 16, 9).getTime();
  Object.assign(progress.days[0], { formula:'=SUM(B2:B4)', total:'80', decision:'within' });
  submitReport(0, progress.days[0], today);
  assert.equal(reportReturnDue(progress, today + 60000), false);
  assert.equal(reportReturnDue(progress, tomorrow), true);
  submitReport(1, progress.days[1], tomorrow);
  Object.assign(progress.days[1], { formula:'=SUM(B2:B5)', total:'103', decision:'over' });
  submitReport(1, progress.days[1], tomorrow + 1000);
  assert.equal(progress.days[1].attempts, 2);
  assert.equal(reportReturnDue(progress, tomorrow + 2000), false);
  assert.deepEqual(validateBuiltinWorkspace({ weeklyReport:progress }).weeklyReport,progress);
});

function finishedReport() {
  const progress = reportProgress();
  Object.assign(progress.days[0], { formula: '=SUM(B2:B4)', total: '80', decision: 'within' });
  submitReport(0, progress.days[0], Date.UTC(2026, 10, 15, 10));
  submitReport(1, progress.days[1], Date.UTC(2026, 10, 16, 10));
  Object.assign(progress.days[1], { formula: '=SUM(B2:B5)', total: '103', decision: 'over' });
  submitReport(1, progress.days[1], Date.UTC(2026, 10, 16, 10, 1));
  progress.day = 1;
  return progress;
}

test('the completed report exports actual expenses, checked totals and attempt evidence after sync', () => {
  const progress = finishedReport();
  progress.note = '=HYPERLINK("https://example.com", "my note")\nInclude every expense.';
  const restored = validateBuiltinWorkspace({ weeklyReport: progress }).weeklyReport;
  assert.deepEqual(completedReport(restored), progress);
  const csv = weeklyReportCsv(restored);
  assert.match(csv, /^Expense,Week 1 \(USD\),Week 2 \(USD\)\r\nSupplies,24,16\r\nDelivery,38,42\r\nPrinting,18,27\r\nPacking,,18\r\n/);
  assert.match(csv, /Total,80,103\r\nBudget,100,100\r\nRemaining,20,-3\r\nDecision,Within budget,Over budget\r\nChecks used,1,2\r\n/);
  assert.match(csv, /Completed at,2026-11-15T10:00:00.000Z,2026-11-16T10:01:00.000Z/);
  assert.match(csv, /Formula used in lesson,'=SUM\(B2:B4\),'=SUM\(B2:B5\)/);
  assert.match(csv, /My note,"'=HYPERLINK\(""https:\/\/example.com"", ""my note""\)\nInclude every expense\.",/);
  assert.equal(reportProgress({ ...progress, note: 'x'.repeat(700) }).note.length, 600);
});

test('only two checked reports produce a project and download controls; stored notes remain text', () => {
  const progress = finishedReport();
  progress.note = '</textarea><script>not markup</script>';
  const document = parseHTML(weeklyReportProject(progress)).document;
  assert.ok(document.querySelector('[data-action="download"][data-id="weekly-report"]'));
  assert.match(document.querySelector('[data-note="weekly-report"]').textContent, /&lt;\/textarea&gt;&lt;script&gt;/);
  assert.equal(document.querySelector('script'), null);
  const result = parseHTML(weeklyReportView(progress)).document;
  assert.ok(result.querySelector('[data-view="work"]'));
  assert.ok(result.querySelector('[data-action="download"][data-id="weekly-report"]'));
  for (const mutate of [draft => { draft.days[0].completed = false; }, draft => { draft.days[1].total = '80'; }]) {
    const invalid = structuredClone(progress);
    mutate(invalid);
    assert.equal(completedReport(invalid), null);
    assert.equal(weeklyReportCsv(invalid), null);
    assert.equal(weeklyReportProject(invalid), '');
  }
});
