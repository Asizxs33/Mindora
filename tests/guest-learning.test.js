import test from 'node:test';
import assert from 'node:assert/strict';
import { planApi } from '../backend/plan-api.js';
import { roadmapApi } from '../backend/roadmap-api.js';
import { taskReviewApi } from '../backend/task-review-api.js';
import { createGuestCourseRequest, GUEST_COURSE_LIMIT } from '../core/guest-courses.js';
import { getStarterCourse } from '../core/starter-courses.js';
import { ROADMAP_CURRICULUM_LIMITS } from '../core/roadmap-model.js';

const makeRequest = (path, body, origin = 'https://mindora.test') => new Request('https://mindora.test/api/' + path, {
  method:'POST', headers:{origin,'Content-Type':'application/json','X-Mindora-Guest':'1'}, body:JSON.stringify(body),
});
const session = () => { throw new Error('Public learning must not use account identity.'); };
const input = {goal:'Learn spreadsheet formulas', minutes:5, language:'en'};

test('guest plan generation returns a real generated lesson without an account or database write', async () => {
  let generated = 0;
  const response = await planApi(makeRequest('learning-plan', input), {
    apiKey:'fixture', settings:null, session,
    generate:async data => { generated++; assert.equal(data.goal,input.goal); return getStarterCourse('python-basics','en',5).plan; },
    store:() => { throw new Error('Guest lessons must not be written into an account.'); },
  });
  assert.equal(response.status,200);
  const {course,plan} = await response.json();
  assert.equal(generated,1);
  assert.equal(course.saved.plan.title,plan.title);
  assert.equal(course.revision,1);
  assert.deepEqual(response.headers.getSetCookie(),[]);
});

test('guest roadmap creation and feedback run the provider with validated inputs', async () => {
  const roadmap = await roadmapApi(makeRequest('learning-roadmap',{...input,experience:'new',motivation:'work'}),{
    quota: () => ({ run: async (_owner, _input, build) => ({ roadmap: await build() }) }), apiKey:'fixture', settings:null,session, generate:async()=>({
      title:'Useful formulas', outcome:'Build a budget sheet.',level:'beginner',levelReason:'Start with cells.',
      stages:['Name cells','Add numbers','Use SUM','Build a budget'].map(title=>({title,objective:'Create and check a small example.'})),
    }),
  });
  assert.equal(roadmap.status,200);
  assert.equal((await roadmap.json()).roadmap.stages.length,4);
  const feedback = await taskReviewApi(makeRequest('task-review',{
    goal:input.goal,task:'Add two numbers.',criterion:'The total is correct.',answer:'2 + 3 = 5',language:'en',
  }),{apiKey:'fixture',settings:null,session,review:async()=>({observation:'The total is correct.',nextAction:'Try a different pair.'})});
  assert.equal(feedback.status,200);
  assert.equal((await feedback.json()).review.observation,'The total is correct.');
});

test('public learning keeps same-origin and input validation',async()=>{
  let called = false;
  const dependencies = {apiKey:'fixture',settings:null,session,generate:async()=>{called=true;}};
  assert.equal((await planApi(makeRequest('learning-plan',input,'https://foreign.test'),dependencies)).status,403);
  assert.equal((await planApi(makeRequest('learning-plan',{...input,minutes:100}),dependencies)).status,400);
  assert.equal(called,false);
});

test('browser course storage restores answers and rejects stale revisions and inactive sessions',async()=>{
  let records = [], enabled = true;
  const store = createGuestCourseRequest({read:()=>records,write:value=>{records=structuredClone(value);},active:()=>enabled,createId:()=> '12345678-1234-4000-8000-123456789012'});
  const saved = getStarterCourse('clear-writing','en',10);
  const {course} = await store('/api/learning-courses','POST',{saved});
  saved.answers[0] = 'My unfinished draft';
  saved.study[0].page = 1;
  await store('/api/learning-courses','PUT',{id:course.id,revision:1,saved});
  const restored = await store('/api/learning-courses?id='+course.id);
  assert.equal(restored.course.saved.answers[0],'My unfinished draft');
  assert.equal(restored.course.saved.study[0].page,1);
  await assert.rejects(store('/api/learning-courses','PUT',{id:course.id,revision:1,saved}), {status:409});
  enabled=false;
  await assert.rejects(store('/api/learning-courses'),/session changed/);
});

test('a guest can save every lesson of the longest curriculum and reopen earlier progress', async () => {
  let records = [], sequence = 0;
  const ports = { read: () => records, write: value => { records = structuredClone(value); }, active: () => true,
    createId: () => `12345678-1234-4000-8000-${String(++sequence).padStart(12, '0')}` };
  const store = createGuestCourseRequest(ports);
  const ids = [];
  for (let index = 0; index < ROADMAP_CURRICULUM_LIMITS.maxStages; index++) {
    const saved = getStarterCourse('clear-writing', 'en', 10);
    saved.answers[0] = `My answer to lesson ${index + 1}`;
    saved.completed = 1;
    const { course } = await store('/api/learning-courses', 'POST', { saved });
    ids.push(course.id);
  }
  const reloaded = createGuestCourseRequest(ports);
  assert.equal((await reloaded('/api/learning-courses')).courses.length, ROADMAP_CURRICULUM_LIMITS.maxStages);
  for (const index of [0, ids.length - 1]) {
    const { course } = await reloaded('/api/learning-courses?id=' + ids[index]);
    assert.equal(course.saved.answers[0], `My answer to lesson ${index + 1}`);
    assert.equal(course.saved.completed, 1);
  }
});

test('guest storage stays bounded while allowing updates at its lesson limit', async () => {
  const saved = getStarterCourse('clear-writing', 'en', 5);
  let records = Array.from({ length: GUEST_COURSE_LIMIT }, (_, index) => ({
    id: `12345678-1234-4000-8000-${String(index).padStart(12, '0')}`, revision: 1, saved: structuredClone(saved),
  }));
  const store = createGuestCourseRequest({ read: () => records, write: value => { records = structuredClone(value); },
    active: () => true, createId: () => '12345678-1234-4000-8000-999999999999' });
  await assert.rejects(store('/api/learning-courses', 'POST', { saved }), /100 saved lessons/);
  saved.answers[0] = 'Updated at capacity';
  const { course } = await store('/api/learning-courses', 'PUT', { id: records[0].id, revision: 1, saved });
  assert.equal(records.length, GUEST_COURSE_LIMIT);
  assert.equal(course.revision, 2);
  assert.equal((await store('/api/learning-courses?id=' + course.id)).course.saved.answers[0], 'Updated at capacity');
});
