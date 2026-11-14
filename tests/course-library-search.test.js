import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { filterCourses } from '../ui/course-library.js';

function library(extra = '') {
  return parseHTML(`<section class="course-library"><p data-course-search-status></p><button data-course-search-clear hidden></button>
    <section class="course-saved-section"><div class="learning-library" aria-busy="false">${extra}
      <li class="learning-library-card"><h3>Python for work</h3></li><article class="course-row"><h2>Менің алғашқы постерім</h2></article>
    </div></section><section class="phone-catalog"><button class="ready-course"><span class="ready-course-copy">First Python program</span></button>
      <button class="ready-course"><span class="ready-course-copy">Everyday English</span></button></section></section>`).document.querySelector('.course-library');
}

test('course search matches saved and ready titles, any word order and Unicode case', () => {
  const root = library();
  assert.equal(filterCourses(root, ' PYTHON '), 2);
  assert.equal(filterCourses(root, 'work python'), 1);
  assert.equal(root.querySelector('.phone-catalog').hidden, true);
  assert.equal(filterCourses(root, 'МЕНІҢ ПОСТЕРІМ'), 1);
  assert.equal(root.querySelector('.course-row').hidden, false);
  assert.equal(filterCourses(root, 'ｐｙｔｈｏｎ'), 2);
});

test('an empty search has a recovery action and clearing restores every course', () => {
  const root = library();
  assert.equal(filterCourses(root, 'unmatched topic'), 0);
  assert.match(root.querySelector('[data-course-search-status]').textContent, /Try another word/);
  assert.equal(root.querySelector('[data-course-search-clear]').hidden, false);
  assert.equal(filterCourses(root, ''), 4);
  assert.equal(root.querySelectorAll('[hidden]').length, 1);
  assert.equal(root.querySelector('[data-course-search-status]').textContent, '');
});

test('filtering cannot hide a loading, failed or pending-import library', () => {
  for (const extra of ['<p class="learning-library-status is-error">Retry</p>', '<div class="learning-library-import">Import</div>']) {
    const root = library(extra); filterCourses(root, 'English');
    assert.equal(root.querySelector('.course-saved-section').hidden, false);
  }
  const root = library(); root.querySelector('.learning-library').setAttribute('aria-busy', 'true');
  filterCourses(root, 'English'); assert.equal(root.querySelector('.course-saved-section').hidden, false);
});
