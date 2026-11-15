import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { getStarterCourse } from '../core/starter-courses.js';
import { restorePlan, taskReviewInput } from '../core/learning-plan.js';
import { normalizePractice, practiceAnswer } from '../core/lesson-practice.js';
import { normalizeStudio, queryTable, sheetValue, studioCheck } from '../core/studio-practice.js';
import { practiceEditor, practiceResult } from '../ui/lesson-practice.js';
import { workedStudio } from '../ui/studio-practice.js';
import { normalizeLessonVisual } from '../core/lesson-visual.js';
import { renderLessonVisual } from '../ui/lesson-visual.js';

const rows = [['Tea',12],["Sue's tea",7],['Coffee',24]], columns = ['item','units'];
const sql = { type:'sql', table:'sales', columns, rows, target:'SELECT item FROM sales WHERE units >= 12' };
const sheet = { type:'sheet', columns, rows, target:'=SUM(B2:B4)' };

test('SQL evaluates projection and a single filter with typed values; a wrong result can be corrected', () => {
  assert.equal(studioCheck(sql,'SELECT * FROM sales'), 'different');
  assert.equal(studioCheck(sql,'select item from SALES where UNITS > 11;'), 'correct');
  assert.deepEqual(queryTable(sql,"SELECT units,item FROM sales WHERE item = 'Sue''s tea'"), { columns:['units','item'], rows:[[7,"Sue's tea"]] });
  assert.deepEqual(queryTable(sql,"SELECT * FROM sales WHERE units = 100").rows, []);
  for (const invalid of ['SELECT unknown FROM sales','SELECT * FROM other','SELECT * FROM sales; SELECT * FROM sales','', 'SELECT item FROM sales WHERE missing > 1']) {
    assert.equal(queryTable(sql, invalid), null);
  }
});
test('SQL lessons accept AS aliases in saved targets and in answers', () => {
  const practice = {
    type: 'sql', table: 'small_shop', columns: ['item', 'amount'], rows: [['Tea', 12], ['Milk', 20]],
    target: 'SELECT amount AS quantity FROM small_shop;',
  };
  assert.deepEqual(normalizeStudio(practice), practice);
  assert.deepEqual(queryTable(practice, practice.target), { columns: ['quantity'], rows: [[12], [20]] });
  assert.deepEqual(queryTable(practice, 'select item, amount AS Quantity from SMALL_SHOP where amount > 12'), {
    columns: ['item', 'quantity'], rows: [['Milk', 20]],
  });
  assert.equal(studioCheck(practice, 'SELECT amount AS Quantity FROM small_shop'), 'correct');
  assert.equal(studioCheck(practice, 'SELECT amount AS price FROM small_shop'), 'different');
  assert.equal(queryTable(practice, 'SELECT missing AS quantity FROM small_shop'), null);
});
test('sheet formulas compute a bounded range on actual cells and reject invalid ranges', () => {
  assert.equal(studioCheck(sheet,'=SUM(B2:B3)'),'different');
  assert.equal(studioCheck(sheet,'=SUM(B2:B4)'), 'correct');
  assert.equal(sheetValue(sheet,'=average(B2:B4)'), 43/3);
  assert.equal(sheetValue(sheet,'=MAX(A2:B4)'), 24);
  for (const bad of ['=SUM(B3:B2)','=MIN(A2:A3)','=SUM(B2:B6)','=SUM(B1:B4)','=IMPORTXML(A2)']) assert.equal(sheetValue(sheet,bad),null);
});
test('five studio submissions survive save, reload and review, including arbitrary punctuation', () => {
  for (const [practice, fields] of [[sql,{expression:'SELECT * FROM sales'}],[sheet,{expression:'=SUM(B2:B3)'}],
    [{type:'flow',labels:['Input','Decision']},{item0:'Amount',item1:'Above budget?'}],
    [{type:'bar-chart',labels:['Mon','Tue'],max:50},{item0:'12',item1:'25'}],
    [{type:'conversation',turns:['Hello?','Can you help?']},{item0:'Hello!',item1:'Tell me more.'}]]) {
    const saved = getStarterCourse('sql-tables','kk',5);
    assert.deepEqual(normalizePractice(practice), practice);
    saved.plan.steps[0].practice = practice;
    const encoded = JSON.stringify(practiceAnswer(practice, fields));
    saved.answers[0] = encoded;
    const restored = restorePlan(JSON.parse(JSON.stringify(saved)));
    assert.equal(restored.plan.language,'kk');
    assert.equal(restored.answers[0], encoded);
    const document = parseHTML(practiceEditor(practice,encoded,false)).document;
    const firstField = document.querySelector('[data-practice-field]');
    assert.equal(firstField.getAttribute('value'), fields.expression ?? fields.item0);
    assert.ok(practiceResult(practice, encoded).length);
    assert.ok(taskReviewInput({goal:'Learn a task',task:'Try the tool.',criterion:'Record the result.',answer:encoded,language:'kk'}));
  }
});
test('stored schemas bound cells, labels, dimensions and the displayed markup', () => {
  for (const bad of [{...sql,columns:['a','A']},{...sheet,rows:[[1]]},{...sheet,rows:[['a','b']]},{...sql,table:'sales;other'},{type:'flow',labels:['one','one']},{type:'bar-chart',labels:['a','b'],max:1e20}]) assert.equal(normalizePractice(bad),null);
  const visual = {type:'table',label:'<script>hi</script>',columns:['A'],rows:[['<img src=x>']]};
  const doc = parseHTML(renderLessonVisual(visual,'kk')).document;
  assert.equal(doc.querySelector('img,script'), null);
  assert.equal(doc.querySelector('td').textContent,'<img src=x>');
  assert.ok(normalizeLessonVisual({type:'flow',label:'Lifecycle',steps:['Read','Create']}));
  assert.equal(normalizeLessonVisual({type:'flow',label:'Lifecycle',steps:['Read','']}),null);
  const example = {input:'SELECT units FROM sales', visual:{type:'table',columns,rows,label:'sales'}};
  assert.match(workedStudio(sql,example), /data-studio-expression/);
  assert.equal(workedStudio(sql,{...example,input:'SELECT outside FROM sales'}),'');
  const chart = {type:'bar-chart',labels:['M','T'],max:10};
  assert.deepEqual(practiceAnswer(chart,{item0:'NaN',item1:'111'}).values,['','']);
});
