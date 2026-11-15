import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateSvg, certificateDate, downloadCertificate } from '../core/certificate.js';
import { certificateView } from '../ui/certificate.js';
import { learningPlanView } from '../ui/learning-plan.js';
import { roadmapView } from '../ui/roadmap.js';
import { getStarterCourse } from '../core/starter-courses.js';
import { restorePlan } from '../core/learning-plan.js';
import { restoreRoadmap, roadmapStageStatuses } from '../core/roadmap-model.js';
import { validateBuiltinWorkspace } from '../backend/builtin-workspace.js';

const completion = { name: 'Alex Morgan', courseTitle: 'Your first poster', completedAt: '2026-11-14T18:30:00.000Z', certificateId: 'MINDORA-DESIGN-20261114' };

test('certificate is deterministic and contains the supplied completion record', () => {
  const svg = certificateSvg(completion);
  assert.equal(svg, certificateSvg({ ...completion }));
  assert.match(svg, /width="297mm" height="210mm"/);
  for (const text of ['Certificate of completion', 'Alex Morgan', 'Your first poster', 'November 14, 2026', completion.certificateId]) assert.ok(svg.includes(text), text);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image|\bonload=|https?:\/\/(?!www\.w3\.org)/);
});

test('all supplied strings stay text instead of becoming SVG elements or attributes', () => {
  const malicious = `</text><script>alert("x")</script> & 'hello'`;
  const svg = certificateSvg({ name: malicious, courseTitle: malicious, certificateId: malicious, completedAt: malicious });
  assert.doesNotMatch(svg, /<script>|<\/text><script>/);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('&quot;x&quot;'));
  assert.ok(svg.includes('&amp; &apos;hello&apos;'));
  assert.ok(svg.includes('Completion date unavailable'));
  assert.doesNotMatch(svg, /NaN|Invalid Date/);
});

test('SVG removes XML-forbidden code points and retains valid multilingual names', () => {
  const svg = certificateSvg({ ...completion, name: 'Әлия 李明 🦫\u0000\u000b\ud800' });
  assert.ok(svg.includes('Әлия 李明 🦫'));
  assert.doesNotMatch(svg, /[\u0000\u000b]|\ud800/u);
});

test('completion date is UTC-stable and never invented for missing data', () => {
  assert.equal(certificateDate('2026-11-15T00:30:00+05:00'), 'November 14, 2026');
  assert.equal(certificateDate(new Date('2026-11-14T12:00:00Z')), 'November 14, 2026');
  for (const value of [null, undefined, '', 'not a date']) assert.equal(certificateDate(value), 'Completion date unavailable');
  assert.equal(certificateSvg(), certificateSvg({}));
});

test('account input and certificate strings are escaped in the UI without removing integration hooks', () => {
  const name = `"><img src=x onerror="alert(1)">`;
  const html = certificateView({ ...completion, name, courseTitle: '<script>hello</script>' });
  assert.doesNotMatch(html, /<img src=x|<script>hello/);
  assert.match(html, /id="certificate-name"[^>]*maxlength="80"/);
  assert.match(html, /value="&quot;&gt;&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;"/);
  assert.match(html, /data-action="download-certificate"/);
  assert.match(html, /data-view="path"/);
});

test('download does not attempt browser work during server-side use', () => {
  assert.throws(() => downloadCertificate(completion), /available in the browser/);
});

test('SQL keeps its saved certificate only after the real final submission', () => {
  const { courseTitle, ...record } = completion;
  const course = getStarterCourse('sql-tables', 'en', 5);
  const pending = { ...course, completed: course.plan.steps.length, certificate: record };
  assert.equal(restorePlan(pending).certificate, undefined);
  assert.doesNotMatch(learningPlanView({ saved: restorePlan(pending), certificateKind: 'lesson' }), /data-certificate-kind/);
  const saved = restorePlan({ ...pending, answers: ['First SQL submission', 'Final SQL submission'] });
  assert.deepEqual(saved.certificate, record);
  assert.match(learningPlanView({ saved, certificateKind: 'lesson' }), /data-certificate-kind="lesson"/);
  assert.doesNotMatch(learningPlanView({ saved, onRoadmap: true }), /data-certificate-kind/);
});

test('the full roadmap and the weekly report retain their certificates in the workspace', () => {
  const { courseTitle, ...record } = completion;
  const stages = ['Setup', 'Practice', 'Review', 'Project'].map(title => ({ title, objective: 'Complete the activity.' }));
  const path = {
    goal: 'Organize weekly work in a spreadsheet', title: 'Weekly spreadsheet workflow', minutes: 5, language: 'en',
    level: 'beginner', levelReason: 'A course for someone starting out.', outcome: 'Share a weekly spreadsheet.',
    stages, progress: stages.map((_, i) => ({ courseId: `00000000-0000-4000-8000-00000000000${i}`, completed: i < 3 })),
    certificate: record,
  };
  const pending = restoreRoadmap(path);
  assert.equal(pending.certificate, undefined);
  assert.doesNotMatch(roadmapView({ roadmap: pending, active: roadmapStageStatuses(pending) }), /data-certificate-kind/);
  path.progress[3].completed = true;
  const saved = validateBuiltinWorkspace({ learningRoadmap: path, certificates: { 'weekly-report': record } });
  assert.deepEqual(saved.learningRoadmap.certificate, record);
  assert.deepEqual(saved.certificates['weekly-report'], record);
  assert.match(roadmapView({ roadmap: saved.learningRoadmap, active: roadmapStageStatuses(saved.learningRoadmap) }), /data-certificate-kind="roadmap"/);
});

test('localized SVG uses the matching title and date without assigning a date to older completions', () => {
  const svg = certificateSvg({ ...completion, language: 'ru', completedAt: null });
  assert.match(svg, /xml:lang="ru"/);
  assert.match(svg, /Сертификат об окончании/);
  assert.match(svg, /Дата окончания недоступна/);
});
