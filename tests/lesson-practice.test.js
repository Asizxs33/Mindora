import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePractice, paletteContrast, practiceAnswer, restorePracticeAnswer } from '../core/lesson-practice.js';
import { normalizePlan, restorePlan, taskReviewInput } from '../core/learning-plan.js';
import { practiceEditor, practiceResult } from '../ui/lesson-practice.js';
import { createPracticeController } from '../core/practice-controller.js';
import { pythonSandboxDocument, runPython } from '../core/python-runner.js';

test('practice schema survives plan/account round trip and rejects unsafe or unsupported editors', () => {
  const url = 'https://docs.python.org/3/tutorial/';
  const make = practice => normalizePlan({ title: 'First loop', outcome: 'Print a list', steps: [0, 1].map(() => ({
    title: 'Loop', instruction: 'Repeat the instruction', task: 'Print three names', criterion: 'Three lines', sourceUrl: url, ...(practice ? { practice } : {}),
  })) }, { goal: 'Python', minutes: 5, language: 'en' }, new Map([[url, { url, title: 'Python tutorial' }]]));
  const practice = { type: 'code', language: 'python', starter: 'print("hello")' };
  const answer = JSON.stringify(practiceAnswer(practice, { code: 'print(3)', output: '3', explanation: 'Print a value.' }));
  const saved = restorePlan(JSON.parse(JSON.stringify({ plan: make(practice), answers: [answer], completed: 0 })));
  assert.deepEqual(saved.plan.steps[0].practice, practice);
  assert.equal(saved.answers[0], answer);
  assert.equal(restorePracticeAnswer(practice, saved.answers[0]).output, '3');
  assert.equal(make().steps[0].practice, undefined);
  assert.equal(make({ type: 'shell', language: 'bash' }), null);
  assert.equal(normalizePractice({ type: 'code', language: '<script>' }), null);
  assert.equal(normalizePractice({ type: 'code', language: 'python', starter: 'x'.repeat(501) }), null);
});

test('structured submissions remain valid review inputs at all field limits including escaped strings', () => {
  for (const type of ['code', 'palette', 'calculation']) {
    const raw = Object.fromEntries(['code', 'output', 'explanation', 'title', 'result', 'working'].map(key => [key, '\n"\\\t\r'.repeat(500)]));
    const answer = JSON.stringify(practiceAnswer({ type }, raw));
    assert.ok(answer.length <= 1500, `${type} exceeded the answer store: ${answer.length}`);
    assert.ok(taskReviewInput({ goal: 'Learn', task: 'Make it', criterion: 'Check it', answer }));
    assert.deepEqual(restorePracticeAnswer({ type }, answer), JSON.parse(answer));
  }
});

test('palette colors are validated before CSS interpolation and all work stays escaped', () => {
  const value = JSON.stringify({ type: 'palette', background: 'red;position:fixed', foreground: '#000000', accent: 'url(https://bad.example/x)', title: '</textarea><script>alert(1)</script>', explanation: '<img src=x onerror=alert(1)>' });
  for (const html of [practiceEditor({ type: 'palette' }, value, false), practiceResult({ type: 'palette' }, value)]) {
    assert.doesNotMatch(html, /<script>|<img|position:fixed|url\(/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /background:#fff1e5/);
  }
  assert.equal(paletteContrast('#000000', '#ffffff'), 21);
  assert.equal(paletteContrast('#ffffff', '#ffffff'), 1);
  assert.equal(paletteContrast('url(x)', '#ffffff'), null);
  assert.equal(practiceResult(undefined, '<script>old answer</script>'), '&lt;script&gt;old answer&lt;/script&gt;');
  assert.match(practiceEditor({ type: 'code', language: 'javascript' }, '', false), /code is not executed here|код не выполняется|орындалмайды/);
  assert.doesNotMatch(practiceEditor({ type: 'code', language: 'javascript' }, '', false), /data-practice-run/);
});

function sandboxHarness() {
  const listeners = new Map();
  let frame;
  const document = { defaultView: {
    addEventListener(type, handler) { listeners.set(type, handler); }, removeEventListener(type) { listeners.delete(type); },
  }, body: { append(value) { frame = value; } }, createElement() {
    return { attributes: {}, contentWindow: { postMessage() {} }, setAttribute(key, value) { this.attributes[key] = value; }, remove() { this.removed = true; } };
  } };
  return { document, get frame() { return frame; }, send(type, source) {
    const channel = frame.srcdoc.match(/const channel = "([^"]+)"/)[1];
    listeners.get('message')?.({ source: source ?? frame.contentWindow, data: { type, channel, output: '3' } });
  } };
}

test('Python frame is opaque and its deadline cannot be extended by worker messages', async () => {
  const sandbox = sandboxHarness();
  const promise = runPython('while True: pass', { document: sandbox.document, loadTimeout: 200, runTimeout: 30 });
  const rejected = assert.rejects(promise, /timeout/);
  assert.equal(sandbox.frame.attributes.sandbox, 'allow-scripts');
  assert.match(sandbox.frame.srcdoc, /default-src 'none'/);
  assert.match(sandbox.frame.srcdoc, /connect-src https:\/\/cdn.jsdelivr.net/);
  assert.doesNotMatch(sandbox.frame.srcdoc, /while True/); // Code travels by message, never injected in HTML.
  sandbox.send('done', {}); // A different window cannot resolve the task.
  sandbox.send('running');
  const timer = setInterval(() => sandbox.send('running'), 5);
  try { await rejected; } finally { clearInterval(timer); }
  assert.equal(sandbox.frame.removed, true);
});

test('cancelled Python execution removes its frame and ignores late output', async () => {
  const sandbox = sandboxHarness();
  const controller = new AbortController();
  const promise = runPython('print(3)', { document: sandbox.document, signal: controller.signal });
  controller.abort();
  sandbox.send('done');
  await assert.rejects(promise, /cancelled/);
  assert.equal(sandbox.frame.removed, true);
  assert.doesNotMatch(pythonSandboxDocument('safe'), /allow-same-origin|eval\(/);
});

function editorHarness(practice, fields, executePython) {
  const handlers = {}, saved = [];
  const controls = Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, { value, dataset: { practiceField: name } }]));
  const status = {}, output = {}, stop = { hidden: true }, button = { dataset: { practiceRun: '' }, disabled: false };
  const form = { id: 'learning-step-form', isConnected: true, elements: { answer: { value: '' } },
    querySelectorAll: () => Object.values(controls),
    querySelector(selector) {
      const field = selector.match(/data-practice-field="([^"]+)"/);
      if (field) return controls[field[1]];
      return { '[data-practice-status]': status, '[data-practice-output]': output, '[data-practice-stop]': stop }[selector];
    },
  };
  for (const control of Object.values(controls)) control.form = form;
  button.form = form;
  const controller = createPracticeController({ document: { addEventListener(type, fn) { handlers[type] = fn; } },
    getPractice: () => practice, onAnswer: value => saved.push(JSON.parse(value)), executePython,
  });
  return { saved, form, status, output, stop, button, controller, input(name, value) { controls[name].value = value; handlers.input({ target: controls[name] }); },
    run: () => handlers.click({ target: { closest: () => button } }),
  };
}

test('editing code persists its draft and clears stale output; old runs cannot touch a new run', async () => {
  const jobs = [];
  const editor = editorHarness({ type: 'code', language: 'python' }, { code: 'print(1)', output: '1', explanation: 'First attempt' }, () => new Promise((resolve, reject) => jobs.push({ resolve, reject })));
  const first = editor.run();
  editor.controller.cancel();
  const second = editor.run();
  const newStatus = editor.status.textContent;
  jobs[0].reject(new Error('unavailable'));
  await first;
  assert.equal(editor.status.textContent, newStatus);
  assert.equal(editor.button.disabled, true);
  assert.equal(editor.stop.hidden, false);
  jobs[1].resolve({ output: '1\n', error: '' });
  await second;
  assert.equal(editor.saved.at(-1).output, '1\n');
  editor.input('code', 'print(2)');
  assert.equal(editor.saved.at(-1).code, 'print(2)');
  assert.equal(editor.saved.at(-1).output, '');
  const third = editor.run();
  editor.form.isConnected = false;
  const before = editor.saved.length;
  jobs[2].resolve({ output: 'stale', error: '' });
  await third;
  assert.equal(editor.saved.length, before);
});
