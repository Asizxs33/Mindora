import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { getStarterCourse, splitLibraryCourses, starterCourses } from '../core/starter-courses.js';
import { phoneCourseLibrary, readyCoursesView } from '../ui/dashboard.js';
import { learningLibraryView } from '../ui/learning-library.js';
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


function storedMini(template, id, language, minutes, completed) {
  const { plan } = getStarterCourse(template, language, minutes);
  return { id, title: plan.title, goal: plan.goal, language, minutes, completed, totalSteps: plan.steps.length };
}

test('personal courses stay first and catalog editions resume by their saved ID across locales', () => {
  const english = storedMini('python-basics', 'stored-en', 'en', 10, 0);
  const russian = storedMini('python-basics', 'stored-ru', 'ru', 5, 1);
  const studio = storedMini('drawing-studio', 'stored-lab', 'kk', 20, 2);
  const custom = { ...english, id: 'my-custom', goal: 'Write an inventory import for my team' };
  const linked = { ...custom, id: 'stage-2' };
  const path = { id: 'own-roadmap', title: 'SQL for my monthly reports', goal: 'Query data tables', progress: [{ courseId: linked.id }] };
  const active = { ...english, completed: 1 };
  const { personal, minis } = splitLibraryCourses([english, russian, studio, custom, linked], [path], active);
  assert.deepEqual(personal.map(item => item.id), [custom.id]);
  assert.deepEqual(minis.map(item => item.templateId), ['python-basics', 'python-basics', 'drawing-studio']);
  const state = { goals: { budget: true }, progress: { budget: 2, design: 0 }, works: {} };
  const personalHtml = learningLibraryView({ courses: personal, roadmaps: [path] }, { guest: true });
  const miniHtml = readyCoursesView(starterCourses('en', 10), 10, { minis, state });
  const root = parseHTML(phoneCourseLibrary(personalHtml, miniHtml)).document.querySelector('.course-library');
  const mine = root.querySelector('.course-saved-section'), shelf = mine.nextElementSibling;
  assert.ok(shelf.matches('details.phone-catalog'));
  assert.ok(!shelf.hasAttribute('open'));
  assert.ok(mine.querySelector('[data-learning-roadmap="own-roadmap"]'));
  assert.ok(mine.querySelector('.glyph-database'));
  assert.ok(mine.querySelector('[data-learning-open="my-custom"]'));
  assert.equal(mine.querySelectorAll('.learning-library-card').length, 2);
  assert.equal(shelf.querySelectorAll('[data-starter-course="python-basics"]').length, 0);
  assert.match(shelf.querySelector('.mini-enrollments [data-learning-open="stored-en"]').textContent, /1\/3/);
  assert.match(shelf.querySelector('.mini-enrollments [data-learning-open="stored-ru"]').textContent, /1\/2 · Русский/);
  assert.match(shelf.querySelector('.mini-enrollments [data-learning-open="stored-lab"]').textContent, /2\/4 · Қазақша/);
  assert.match(shelf.querySelector('.mini-enrollments [data-course="budget"]').textContent, /2\/4/);
  assert.equal(shelf.querySelectorAll('[data-course="budget"]').length, 1);
  assert.ok(shelf.querySelector('[data-course="design"]'));
  assert.ok(filterCourses(root, russian.title) > 0);
  assert.equal(shelf.open, true);
});

test('a device-only personal course is available from the guest library', () => {
  const current = { id:'local', title:'Capacity planning', goal:'Plan next week', language:'en', minutes:10, completed:0, totalSteps:3 };
  const { personal, minis } = splitLibraryCourses([], [], current);
  assert.deepEqual(personal, [current]);
  assert.deepEqual(minis, []);
  assert.match(learningLibraryView({courses:personal}, {guest:true}), /data-view="course-path"/);
});
