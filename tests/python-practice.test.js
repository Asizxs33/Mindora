import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPythonCases, normalizePythonChecks, pythonPrograms } from '../core/python-practice.js';
import { lessonPracticeIssues } from '../backend/lesson-practice-quality.js';

test('two Python inputs prevent a hard-coded output and use independently evaluated answers', () => {
  const checks = normalizePythonChecks({ operation: 'sum', inputs: [[2, 5], [3, 8, 2]] });
  assert.deepEqual(pythonPrograms(checks, 'print(sum(values))'), ['values = [2,5]\nprint(sum(values))', 'values = [3,8,2]\nprint(sum(values))']);
  assert.deepEqual(checkPythonCases(checks, [{ output: '7\n' }, { output: '7\n' }]), [true, false]);
  assert.deepEqual(checkPythonCases(checks, [{ output: '7\n' }, { output: '13\n' }]), [true, true]);
  assert.deepEqual(checkPythonCases(checks, [{ output: '7\n', error: 'RuntimeError' }, { output: '13\n' }]), [false, true]);
  assert.equal(normalizePythonChecks({ operation: 'sum', inputs: [[2, 5], [4, 3]] }), null);
  assert.deepEqual(lessonPracticeIssues({ practice: { type: 'code', language: 'python', pythonChecks: { operation: 'eval', inputs: [[2, 5], [3, 8]] } } }), ['invalid-python-checks']);
});
