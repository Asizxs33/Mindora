import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createWorkspaceStorage } from '../core/workspace-storage.js';
import { showWorkspaceConflict } from '../ui/workspace-conflict.js';

test('the guard preserves legacy JSON and accepts repeated saves from the same tab', () => {
  let value = '{"version":1,"notes":{"design":"Saved draft"}}';
  const storage = createWorkspaceStorage({ readValue: () => value, writeValue: next => { value = next; } });
  assert.equal(storage.read(), value);
  assert.equal(storage.write('{"version":1,"minutes":5}'), true);
  assert.equal(storage.write('{"version":1,"minutes":20}'), true);
  assert.equal(value, '{"version":1,"minutes":20}');
  assert.equal(storage.hasConflict(), false);
});

test('failed writes do not advance the expected snapshot or hide later conflicts', () => {
  let value = null, fail = true;
  const storage = createWorkspaceStorage({ readValue: () => value, writeValue: next => {
    if (fail) throw new Error('Quota exceeded');
    value = next;
  } });
  storage.read();
  assert.throws(() => storage.write('first'), /Quota/);
  fail = false;
  assert.equal(storage.write('first'), true);
  value = 'newer';
  assert.equal(storage.write('stale'), false);
  assert.equal(value, 'newer');
  // Restoring an old byte-identical snapshot elsewhere cannot unlock a stale tab.
  value = 'first';
  assert.equal(storage.write('stale'), false);
});

test('the conflict notice preserves the current input node and has an explicit reload action', () => {
  const { document } = parseHTML('<main><textarea name="answer">My unsaved text</textarea></main>');
  const main = document.querySelector('main');
  const answer = main.querySelector('textarea');
  showWorkspaceConflict(main);
  showWorkspaceConflict(main);
  assert.equal(main.querySelector('textarea'), answer);
  assert.equal(answer.value, 'My unsaved text');
  assert.equal(main.querySelectorAll('#workspace-conflict').length, 1);
  assert.equal(main.querySelector('#workspace-conflict').getAttribute('role'), 'alert');
  assert.equal(main.querySelector('[data-action="reload-workspace"]').getAttribute('type'), 'button');
});
