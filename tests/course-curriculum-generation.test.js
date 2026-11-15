import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekRoadmap, roadmapApi } from '../backend/roadmap-api.js';
import { normalizeRoadmap, restoreRoadmap } from '../core/roadmap-model.js';
import { validateBuiltinWorkspace } from '../backend/builtin-workspace.js';

const input = { goal: 'Build small useful programs', originalGoal: 'Python', minutes: 5, language: 'en', experience: 'some', motivation: 'work', evidence: 'I can use lists.' };
const source = { title: 'Python tutorial', url: 'https://docs.python.org/3/tutorial/', content: 'Course outline: values, lists, conditions, loops, functions, and combining these skills in a program.' };
const research = { sources: [source], status: 'verified' };
const metadata = [{ title: source.title, url: source.url }];
const curriculum = () => ({
  curriculumVersion: 2, level: 'beginner', levelReason: 'The learner knows lists but needs supported practice.',
  title: 'Build practical Python skills', outcome: 'Create and explain a small useful program.',
  modules: Array.from({ length: 6 }, (_, index) => ({ title: `Module ${index + 1}`, outcome: `Apply skill group ${index + 1}.`, startIndex: index * 4, count: 4 })),
  stages: Array.from({ length: 24 }, (_, index) => ({ title: `Skill ${index + 1}`, objective: `Produce and verify practical result ${index + 1}.`, kind: ['lesson', 'practice', 'review', 'mini-project'][index % 4] })),
});
const completion = value => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });

function fixture(outputs, opened = research) {
  const loads = [], calls = [];
  const loadSources = async (data, options) => { loads.push({ data, signal: options.signal }); return opened; };
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    calls.push({ body: JSON.parse(options.body), signal: options.signal });
    const output = outputs[calls.length - 1];
    assert.notEqual(output, undefined, 'generation exceeded its retry budget');
    return typeof output === 'function' ? output() : completion(output);
  };
  return { loads, calls, generate: data => generateDeepSeekRoadmap(data, 'test-only', fetcher, { loadSources }) };
}

test('daily 5, 10 and 20 minute choices create a whole syllabus with lazy lessons and pinned source metadata', async () => {
  for (const minutes of [5, 10, 20]) {
    const data = { ...input, minutes };
    const forged = { ...curriculum(), goal: 'Wrong provider goal', originalGoal: 'Wrong provider subject', sources: [{ title: 'Invented course', url: 'https://invented.example/fake' }], sourceStatus: 'unavailable' };
    const run = fixture([forged]);
    const request = new Request('https://mindora.test/api/learning-roadmap', {
      method: 'POST', headers: { origin: 'https://mindora.test', 'content-type': 'application/json', 'X-Mindora-Account': 'account-a' }, body: JSON.stringify(data),
    });
    const response = await roadmapApi(request, {
      quota: () => ({ run: async (_owner, _input, build) => ({ roadmap: await build() }) }), apiKey: 'test-only', settings: { databaseUrl: 'test-only' }, session: async () => ({ user: { id: 'account-a' }, cookies: [] }), generate: run.generate,
    });
    assert.equal(response.status, 200);
    const { roadmap } = await response.json();
    assert.equal(roadmap.curriculumVersion, 2);
    assert.equal(roadmap.minutes, minutes);
    assert.equal(roadmap.goal, input.goal);
    assert.equal(roadmap.originalGoal, 'Python');
    assert.equal(roadmap.stages.length, 24);
    assert.equal(roadmap.modules.length, 6);
    assert.ok(roadmap.stages.length * minutes > minutes, 'daily time must not become the duration of the whole course');
    assert.deepEqual(roadmap.sources, metadata);
    assert.equal(roadmap.sourceStatus, 'verified');
    const prompt = run.calls[0].body.messages[0].content;
    assert.ok(prompt.includes(`${minutes}-minute practice session, not the duration of the entire course`));
    assert.match(prompt, /Lessons are generated separately only when their stage is opened/);
    assert.deepEqual(JSON.parse(run.calls[0].body.messages[1].content), data);
    assert.deepEqual(JSON.parse(run.calls[0].body.messages[2].content), { retrievedCourseOutlines: [source], sourceStatus: 'verified' });
    assert.equal(run.loads.length, 1);
    assert.equal(run.calls.length, 1);
    assert.equal(run.loads[0].signal, run.calls[0].signal);
    const saved = restoreRoadmap(roadmap);
    assert.equal(saved.progress.length, 24);
    assert.ok(saved.progress.every(stage => stage.courseId === null && stage.completed === false), 'syllabus creation does not eagerly create lessons');
    assert.deepEqual(validateBuiltinWorkspace(JSON.parse(JSON.stringify({ learningRoadmap: saved }))).learningRoadmap, saved);
  }
});

test('an incomplete curriculum retries composition once using the same source evidence and deadline', async () => {
  const first = { ...curriculum(), title: 'FAILED_OUTLINE_NOT_FOR_REPLAY', stages: curriculum().stages.slice(0, 23) };
  const run = fixture([first, curriculum()]);
  const result = await run.generate(input);
  assert.equal(result.stages.length, 24);
  assert.equal(run.loads.length, 1);
  assert.equal(run.calls.length, 2);
  assert.equal(run.loads[0].signal, run.calls[0].signal);
  assert.equal(run.calls[0].signal, run.calls[1].signal);
  const [initial, retry] = run.calls.map(call => call.body);
  assert.deepEqual(retry.messages.slice(0, initial.messages.length), initial.messages);
  assert.match(retry.messages.at(-1).content, /all 24 unique stages/);
  assert.equal(JSON.stringify(retry.messages).includes(first.title), false);
  assert.equal(retry.max_tokens, initial.max_tokens);
});

test('two invalid outlines fail without another source fetch or a third composition', async () => {
  const invalid = { ...curriculum(), modules: [] };
  const run = fixture([invalid, invalid]);
  await assert.rejects(run.generate(input), { name: 'RoadmapContentInvalid' });
  assert.equal(run.loads.length, 1);
  assert.equal(run.calls.length, 2);
});

test('unavailable course sources cannot be replaced by model-invented attribution', async () => {
  const run = fixture([{ ...curriculum(), sources: metadata, sourceStatus: 'verified' }], { sources: [], status: 'unavailable' });
  const result = normalizeRoadmap(await run.generate(input), input);
  assert.equal(result.sourceStatus, 'unavailable');
  assert.deepEqual(result.sources, []);
  assert.deepEqual(JSON.parse(run.calls[0].body.messages[2].content), { retrievedCourseOutlines: [], sourceStatus: 'unavailable' });
});

test('course regeneration does not retry provider access errors or extend an expired 50 second deadline', async context => {
  for (const status of [401, 429]) {
    const run = fixture([() => Response.json({ error: { message: 'Unavailable' } }, { status })]);
    await assert.rejects(run.generate(input), error => error.providerStatus === status);
    assert.equal(run.calls.length, 1);
  }
  const controller = new AbortController();
  let deadlines = 0;
  context.mock.method(AbortSignal, 'timeout', duration => {
    assert.equal(duration, 50000);
    deadlines++;
    return controller.signal;
  });
  const expired = fixture([() => {
    controller.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
    return completion({ ...curriculum(), stages: [] });
  }]);
  await assert.rejects(expired.generate(input), { name: 'TimeoutError' });
  assert.equal(expired.calls.length, 1);
  assert.equal(expired.loads.length, 1);
  assert.equal(deadlines, 1);
});
