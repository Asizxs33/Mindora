import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { character } from './characters.js';
import { mentorScene } from './mentor-scenes.js';
import { interactWithMentor } from './mentor-interactions.js';

test('every tutor state has a real, matching still and animated asset', () => {
  for (const mentor of ['mino', 'mia', 'sam', 'artist', 'copywriter', 'smm']) {
    for (const mood of ['welcome', 'thinking', 'explaining', 'encourage', 'celebrate', 'incorrect']) {
      const { document } = parseHTML(character(mentor, mood));
      const source = document.querySelector('img').getAttribute('src');
      assert.ok(existsSync(new URL(source)), `${mentor}/${mood} PNG`);
      assert.ok(existsSync(new URL(source.replace(/\.png$/, '.webp'))), `${mentor}/${mood} WebP`);
    }
  }
});

test('asking a tutor reveals escaped lesson help without completing an assessment', () => {
  const { document } = parseHTML(mentorScene('mia', 'thinking', '<h3>Choose a title</h3>', '', { hint: '<img src=x onerror=alert(1)>' }));
  const control = document.querySelector('[data-mentor-help]');
  const messages = [];
  const options = { animate: false, announce: message => messages.push(message), react: () => {} };
  assert.equal(interactWithMentor(control, options), true);
  assert.equal(control.getAttribute('aria-expanded'), 'true');
  assert.equal(document.querySelector('[data-mentor-hint]').hidden, false);
  assert.ok(messages[0].includes('<img'));
  assert.equal(document.querySelector('[data-mentor-hint] img'), null);
  assert.equal(document.querySelector('[data-character-kind]').dataset.characterMood, 'thinking');
  interactWithMentor(control, options);
  assert.equal(control.getAttribute('aria-expanded'), 'false');
});

test('show me focuses only this lessons material and honours reduced motion', () => {
  const { document } = parseHTML(`<section class="lesson-template">${mentorScene('sam', 'explaining', '<p>Look at the sum</p>', '', { focus: 'Show me' })}<div data-mentor-target>48 + 125 + 24</div></section><div data-mentor-target>Unrelated</div>`);
  const target = document.querySelector('[data-mentor-target]');
  let focused = false, scroll;
  target.focus = () => { focused = true; };
  target.scrollIntoView = options => { scroll = options; };
  interactWithMentor(document.querySelector('[data-mentor-focus]'), { animate: false, announce() {}, react() {} });
  assert.equal(focused, true);
  assert.equal(scroll.behavior, 'instant');
  assert.equal(target.classList.contains('mentor-focus-target'), true);
  assert.equal(document.querySelectorAll('[tabindex="-1"]').length, 1);
});
