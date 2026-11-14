import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeepSeekPlan } from '../backend/deepseek-plan.js';
import { generateDeepSeekRoadmap } from '../backend/roadmap-api.js';
import { normalizeRoadmap, restoreRoadmap } from '../core/roadmap-model.js';
import { validateBuiltinWorkspace } from '../backend/builtin-workspace.js';
import { normalizeSavedCourse } from '../backend/learning-course-store.js';
import { restorePlan } from '../core/learning-plan.js';

const kinds = ['lesson', 'practice', 'review', 'mini-project'];
const source = { url: 'https://docs.python.org/3/tutorial/controlflow.html', title: 'Python control flow',
  content: 'A for loop visits each item of a sequence. An indented body runs for each item. You can print each value from a literal list and sum a short list of numbers.' };
const previousStages = [{ title: 'Literal data', objective: 'Represent a short list of values.' }, { title: 'Print a value', objective: 'Print a value on its own line.' }];
const completion = output => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] });
const lesson = {
  formatVersion: 3, title: 'Print a small report', outcome: 'Print two entries from literal data.',
  guided: [{ title: 'Print each item', instruction: 'A for loop repeats its indented body for each item.',
    task: 'Write a loop to print the two names Ada and Lin.', criterion: 'Ada and Lin appear on separate lines.',
    practice: { type: 'code', language: 'python' }, sourceId: 0, imageIds: [],
    teaching: { why: 'Process several entries without copying the same operation.',
      example: { input: 'for n in [2, 3]:\n    print(n)', output: '2\n3', explanation: 'Each number is printed once.' },
      assessment: { type: 'choice', question: 'How many lines are printed?', options: ['Two', 'One', 'Three'], answer: 0, explanation: 'There are two items.' },
      takeaway: 'The indented body runs once per item.' },
  }],
  final: { title: 'A fresh report', task: 'Write a loop printing the names Sam and Kim.', criterion: 'Sam and Kim each appear on their own line.', practice: { type: 'code', language: 'python' } },
};

test('each persisted node kind reaches lesson composition and changes its instructional contract', async () => {
  const contracts = {
    lesson: [/introduces a new concept/i, /define unfamiliar terms/i],
    practice: [/applied practice/i, /theory concise/i, /produce their own response/i],
    review: [/retrieval review/i, /previousStages/, /do not introduce new prerequisites/i, /fresh situations/i],
    'mini-project': [/mini-project/i, /one coherent artifact/i, /final task assembles or adapts/i, /explicit success criteria/i],
  };
  const prompts = new Map();
  for (const kind of [...kinds, undefined]) {
    const stage = { goal: 'Build useful Python programs', originalGoal: 'Python', title: 'Print a report', objective: 'Print literal data in a useful sequence.',
      level: 'beginner', levelReason: 'The learner can represent and print literal values.', previousStages, ...(kind ? { kind } : {}) };
    const requests = [];
    const fetcher = async (url, options) => {
      const body = JSON.parse(options.body);
      if (url.endsWith('/v1/tools/search')) return Response.json({ results: [source] });
      if (url.endsWith('/v1/tools/fetch')) return Response.json({ content: source.content });
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      const input = JSON.parse(body.messages[1].content);
      if (!input.materials) return completion({ query: 'Python for loop tutorial', githubQuery: '' });
      requests.push(body);
      assert.deepEqual(input.roadmapStage, stage, 'the selected kind and actual prior objectives reach the provider');
      return completion(lesson);
    };
    const plan = await generateDeepSeekPlan({ goal: stage.title, minutes: 5, language: 'en', roadmapStage: stage }, 'test-only', fetcher,
      { readPage: async () => null, readRenderedPage: async () => null });
    assert.equal(requests.length, 1);
    const prompt = requests[0].messages[0].content;
    if (kind) {
      for (const required of contracts[kind]) assert.match(prompt, required, kind);
      prompts.set(kind, prompt);
    } else assert.doesNotMatch(prompt, /This stage (?:is retrieval review|is a mini-project|is applied practice|introduces a new concept)/,
      'old stages do not silently acquire a new lesson kind');
    const saved = normalizeSavedCourse({ plan, answers: ['print("Ada")\nprint("Lin")'] });
    assert.ok(saved);
    const restored = restorePlan(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(restored.plan, plan);
    assert.equal(restored.answers[0], 'print("Ada")\nprint("Lin")');
  }
  assert.equal(new Set(prompts.values()).size, 4, 'node kinds change actual composition guidance, not just the path label');
});

test('generated syllabus kinds survive workspace roundtrip and invalid, unvaried or swapped boundary kinds trigger one bounded retry', async () => {
  const input = { goal: 'Build useful Python programs', minutes: 10, language: 'en', experience: 'some', motivation: 'work', evidence: 'I can print simple values.' };
  const output = { curriculumVersion: 2, title: 'Python reports', outcome: 'Write a short useful report.', level: 'beginner', levelReason: 'Build on literal data and printed values.',
    modules: Array.from({ length: 6 }, (_, index) => ({ title: `Module ${index + 1}`, outcome: `Use skill group ${index + 1}.`, startIndex: index * 4, count: 4 })),
    stages: Array.from({ length: 24 }, (_, index) => ({ title: `Stage ${index + 1}`, objective: `Produce and explain result ${index + 1}.`, kind: kinds[index % 4] })),
  };
  for (const issue of ['unknown', 'missing', 'no-variety', 'swapped-boundaries']) {
    const invalid = structuredClone(output);
    if (issue === 'unknown') invalid.stages[9].kind = 'invented-kind';
    if (issue === 'missing') delete invalid.stages[9].kind;
    if (issue === 'no-variety') invalid.stages.forEach(stage => { stage.kind = 'lesson'; });
    if (issue === 'swapped-boundaries') {
      invalid.stages[0].kind = 'mini-project';
      invalid.stages.at(-1).kind = 'lesson';
    }
    const requests = [], signals = [];
    let loads = 0;
    const generated = await generateDeepSeekRoadmap(input, 'test-only', async (_url, options) => {
      requests.push(JSON.parse(options.body)); signals.push(options.signal);
      assert.ok(requests.length <= 2);
      return completion(requests.length === 1 ? invalid : output);
    }, { loadSources: async (_input, { signal }) => { loads++; signals.push(signal); return { sources: [source], status: 'verified' }; } });
    assert.equal(requests.length, 2);
    assert.equal(loads, 1);
    assert.equal(new Set(signals).size, 1);
    const prompt = requests[0].messages[0].content;
    assert.match(prompt, /Use all four kinds/);
    assert.match(prompt, /start with lesson and end with mini-project/);
    assert.match(prompt, /kind:lesson\|practice\|review\|mini-project/);
    const roadmap = restoreRoadmap(normalizeRoadmap(generated, input));
    assert.deepEqual(roadmap.stages.map(stage => stage.kind), output.stages.map(stage => stage.kind));
    const reopened = validateBuiltinWorkspace(JSON.parse(JSON.stringify({ learningRoadmap: roadmap }))).learningRoadmap;
    assert.deepEqual(reopened, roadmap);
    assert.equal(reopened.stages[0].kind, 'lesson');
    assert.equal(reopened.stages.at(-1).kind, 'mini-project');
  }
});
