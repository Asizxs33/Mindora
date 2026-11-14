import { COURSES, escapeHtml } from '../core/engine.js';
import { resumeCursor } from '../core/resume.js';
import { learningStats } from '../core/progress.js';
import { icon } from './icons.js';
import { timeOptions } from './budget-session.js';
import { character } from './characters.js';
import { t, currentLanguage } from './language.js';

export const courseNames = {
  get design() { return t('Your first poster','Твой первый постер','Алғашқы постерің'); },
  get budget() { return t('Everyday spreadsheets','Таблицы на каждый день','Күнделікті кестелер'); },
};
export const lessonNames = {
  get design() { return t(['Make one thing stand out', 'Train your design eye', 'Make it yours', 'Try a fresh brief'], ['Выдели главное','Проверь знания','Сделай свой постер','Новый постер'], ['Ең маңыздысын көрсет','Біліміңді тексер','Өз постеріңді жаса','Жаңа постер']); },
  get budget() { return t(['Meet your first formula', 'Think in cells', 'Build your own tracker', 'A new set of numbers'], ['Первая формула','Разберись с ячейками','Собери свою таблицу','Новые данные'], ['Алғашқы формула','Ұяшықтарды түсін','Өз кестеңді жаса','Жаңа деректер']); },
};
const guide = id => id === 'design' ? 'designer' : 'sam';
const startedCourses = state => Object.keys(COURSES).filter(id => state.goals[id] || state.progress[id] || state.works[id]);

export function badge(icon, name, color, size = 22) {
  return `<span class="game-icon ${color}">${icon(name, size)}</span>`;
}

export function brandNav(icon, view, place, signedIn = false) {
  const items = [['courses', 'book', t('Courses','Курсы','Курстар')], ['profile', 'user', t('Profile','Профиль','Профиль')]];
  const profileViews = ['profile', 'work', 'practice', 'achievements', 'community', 'quests', 'shop'];
  return items.map(([key, symbol, name]) => {
    const active = key === (profileViews.includes(view) ? 'profile' : 'courses');
    return `<button class="nav-item ${active ? 'active' : ''}" data-view="${key}" ${active ? 'aria-current="page"' : ''}>${icon(symbol, place === 'bottom' ? 22 : 23)}<span>${name}</span></button>`;
  }).join('');
}

/** A quiet entry to courses. Action attributes come from the controller. */
export function courseHomeView(state, { current = null, libraryHtml = '', readyHtml = '' } = {}) {
  const total = Math.max(1, Number(current?.total) || 1);
  const completed = Math.min(total, Math.max(0, Number(current?.completed) || 0));
  const percent = Math.round(completed / total * 100);
  return `<section class="course-home" data-language="${currentLanguage()}" aria-labelledby="course-home-title">
    <header class="course-home-heading" data-mentor-scene><div><h1 id="course-home-title">${t('What will you learn today?', 'Чему научимся сегодня?', 'Бүгін не үйренеміз?')}</h1><p class="course-home-greeting" data-mentor-message>${completed === total ? t('You did it!', 'У тебя получилось!', 'Жарайсың!') : t('Tell me your goal.', 'Расскажи о своей цели.', 'Мақсатыңды айтшы.')}</p></div>${character('mino', completed === total ? 'trophy' : 'welcome', 'course-home-mino')}</header>
    <form id="goal-form" class="course-home-composer">
      <label class="visually-hidden" for="goal-input">${t('What do you want to learn?', 'Чему хочешь научиться?', 'Не үйренгің келеді?')}</label>
      <input id="goal-input" name="goal" value="${escapeHtml(state.homeGoal || '')}" placeholder="${t('For example, make my first video', 'Например, сделать первое видео', 'Мысалы, алғашқы видеомды жасау')}" minlength="3" maxlength="180" required autocomplete="off" enterkeyhint="go">
      <div class="course-home-form-actions"><label class="course-home-time" for="time-select"><span>${t('Per lesson', 'На занятие', 'Бір сабаққа')}</span><select id="time-select" name="minutes">${[5, 10, 20].map(value => `<option value="${value}"${value === state.minutes ? ' selected' : ''}>${value} ${t('min', 'мин', 'мин')}</option>`).join('')}</select></label><button type="submit" class="primary">${t('Create a path', 'Создать путь', 'Оқу жолын құру')}${icon('arrow', 18)}</button></div>
    </form>
    ${current ? `<section class="course-home-current" aria-labelledby="course-home-current-title"><div class="course-home-current-heading"><span class="course-home-current-icon" aria-hidden="true">${icon('path', 25)}</span><div><span class="course-home-eyebrow">${completed === total ? t('Completed', 'Пройдено', 'Аяқталды') : t('Your next step', 'Твой следующий шаг', 'Келесі қадамың')}</span><h2 id="course-home-current-title">${escapeHtml(current.title)}</h2></div><span class="course-home-percent">${percent}%</span></div>${current.subtitle ? `<p class="course-home-next">${escapeHtml(current.subtitle)}</p>` : ''}<div class="course-home-progress"><progress max="${total}" value="${completed}" aria-label="${t('Course progress', 'Прогресс курса', 'Курс барысы')}"></progress><span>${completed}/${total}</span></div><div class="course-home-current-actions"><button type="button" class="primary course-home-resume" ${current.resumeAttributes || 'data-view="my-path"'}>${completed === total ? t('See result', 'Результат', 'Нәтижені көру') : t('Continue', 'Продолжить', 'Жалғастыру')}${icon('play', 17)}</button><button type="button" class="secondary course-home-path" ${current.pathAttributes || 'data-view="my-path"'}>${icon('path', 18)}${t('Learning path', 'Путь обучения', 'Оқу жолы')}</button></div></section>` : ''}
    ${libraryHtml ? `<details class="course-home-library"><summary>${icon('folder', 20)}<span>${t('Saved courses', 'Сохранённые курсы', 'Сақталған курстар')}</span>${icon('chevron', 18)}</summary><div data-course-library>${libraryHtml}</div></details>` : ''}
    ${readyHtml ? `<div class="course-home-ready">${readyHtml}</div>` : ''}
  </section>`;
}

function goalBanner(minutes, compact = false) {
  return `<section class="learn-home ${compact ? 'new-goal-section' : ''}" aria-labelledby="welcome-title">
    ${compact ? '' : `<div class="home-introduction"><div class="hero-character">${character('mino', 'welcome', 'home-character')}</div><div class="speech-bubble"><span class="home-guide-label">${t('Mino · your learning buddy', 'Мино · учимся вместе', 'Мино · бірге үйренеміз')}</span><p>${t("Hi! Tell me your goal. We’ll take it one small step at a time.", "Привет! Расскажи о своей цели. Будем разбираться вместе, шаг за шагом.", "Сәлем! Мақсатыңды айт. Бірге, шағын қадамдармен үйренеміз.")}</p></div></div>`}
    <div class="goal-copy">
      <${compact ? 'h2' : 'h1'} id="welcome-title">${t('What do you want to learn?', 'Чему ты хочешь научиться?', 'Не үйренгің келеді?')}</${compact ? 'h2' : 'h1'}>
      <p>${t('Choose a goal to see a learning path that fits your time.', 'Выбери цель и получи путь обучения под свой темп.', 'Мақсатыңды таңда да, өз қарқыныңа сай оқу жолын ал.')}</p>
    </div>
    <form id="goal-form" class="goal-form">
      <label class="visually-hidden" for="goal-input">${t('What do you want to learn?', 'Чему ты хочешь научиться?', 'Не үйренгің келеді?')}</label>
      <input id="goal-input" name="goal" placeholder="${t('I want to learn how to…','Я хочу научиться…','Үйренгім келетіні…')}" minlength="3" maxlength="180" required autocomplete="off">
      <label class="field"><span>${t('Time for each lesson','Время на занятие','Сабақ уақыты')}</span><select id="time-select" class="profile-select">${timeOptions(minutes)}</select></label>
      <button type="submit" class="primary large">${t('Plan my learning','Построить путь','Оқу жолын құру')} ${icon('arrow', 19)}</button>
    </form>
    <div class="topic-shortcuts" aria-label="${t("Available learning topics", "Доступные темы", "Қолжетімді тақырыптар")}">
      <button class="topic-shortcut" data-course="design">${icon('palette', 18)} ${t("Make a poster", "Сделать постер", "Постер жасау")}</button>
      <button class="topic-shortcut" data-course="budget">${icon('sheet', 18)} ${t("Learn spreadsheets", "Изучить таблицы", "Кестелерді үйрену")}</button>
    </div>
    <p class="home-note">${t("Posters and spreadsheets are available now.", "Готовые курсы: постеры и таблицы.", "Дайын курстар: постерлер мен кестелер.")}</p>
    ${compact ? '' : `<p class="home-account-link">${t('New here?', 'Впервые здесь?', 'Алғаш рет келдің бе?')} <button class="text-link" data-account-open="signup">${t("Create account", "Создать аккаунт", "Аккаунт жасау")}</button></p>`}
  </section>`;
}

function resumeCard(state) {
  const id = state.active, completed = state.progress[id], current = resumeCursor(state, id).step, done = completed === 4;
  return `<section class="return-home" aria-labelledby="return-title">
    <div class="return-heading"><h1 id="return-title">${done ? t("You did it!", "Отличная работа!", "Жарайсың!") : t("Welcome back.", "С возвращением.", "Қайта келгеніңе қуаныштымыз.")}</h1></div>
    <section class="resume-card ${id}">
      <div class="resume-mentor">${character(guide(id), done ? 'celebrate' : 'explaining', 'resume-character')}<span><strong>${id === 'design' ? 'Mia' : 'Sam'}</strong>${done ? t('Look what you made! Let’s celebrate your progress.', 'Посмотри, что получилось! Отличная работа.', 'Не жасағаныңды қарашы! Жарайсың.') : t('I’ll show you an example. Then we’ll try it together.', 'Я покажу пример. А потом попробуем вместе.', 'Алдымен мысал көрсетемін. Сосын бірге жасап көреміз.')}</span></div>
      <div class="resume-body"><h2>${courseNames[id]}</h2>
        <div class="resume-progress"><span>${done ? t("Course complete", "Курс завершён", "Курс аяқталды") : t(`${completed * 25}% complete`, `Пройдено ${completed * 25}%`, `${completed * 25}% аяқталды`)}</span></div>
        <div class="progress-bar" role="progressbar" aria-label="${t("Course progress", "Прогресс курса", "Курс барысы")}" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${completed}"><i style="width:${completed * 25}%"></i></div>
        <p class="resume-next">${done ? t("Your finished project is saved.", "Готовая работа сохранена.", "Дайын жұмысың сақталды.") : lessonNames[id][current]}</p>
        <button class="primary large" data-action="${done ? 'certificate' : 'resume-course'}" data-id="${id}">${done ? t("My certificate", "Мой сертификат", "Сертификатым") : state.sessions?.[id] || completed ? t("Continue learning", "Продолжить обучение", "Оқуды жалғастыру") : t("Start learning", "Начать обучение", "Оқуды бастау")} ${icon('arrow', 19)}</button>
        <button class="text-link resume-path-link" data-view="path">${t("View my course", "Открыть курс", "Курсты ашу")} ${icon('path', 16)}</button>
      </div>
    </section>
  </section>`;
}

export function dashboard(state) {
  const saved = state.learningPlan;
  const hasPath = state.learningRoadmap || saved || Object.hasOwn(COURSES, state.active);
  const pathLink = hasPath ? `<button type="button" class="text-link roadmap-home-link" data-view="my-path">${icon('path', 18)} ${t("Open my learning path", "Открыть мой путь", "Оқу жолымды ашу")}</button>` : '';
  const newGoal = `<details class="goal-disclosure"><summary><span>${t("Learn something else", "Выбрать другую цель", "Басқа мақсат таңдау")}</span>${icon('chevron', 18)}</summary>${goalBanner(state.minutes, true)}</details>`;
  if (saved) {
    const total = saved.plan.steps.length;
    const completed = Math.min(total, Math.max(0, saved.completed));
    const done = completed === total;
    const progress = total ? Math.round(completed / total * 100) : 0;
    const next = saved.plan.steps[completed];
    return `<section class="return-home" aria-labelledby="return-title">
      <div class="return-heading"><h1 id="return-title">${done ? t("You did it!", "Отличная работа!", "Жарайсың!") : t("Welcome back.", "С возвращением.", "Қайта келгеніңе қуаныштымыз.")}</h1></div>
      <section class="resume-card personalized">
        <div class="resume-mentor">${character('mino', done ? 'celebrate' : 'explaining', 'resume-character')}<span><strong>Mino</strong>${done ? t("Let’s see what you learned.", "Посмотрим, чему ты научился.", "Не үйренгеніңді көрейік.") : t("Ready for your next small step?", "Продолжим с того же места?", "Тоқтаған жерден жалғастырайық па?")}</span></div>
        <div class="resume-body"><h2>${escapeHtml(saved.plan.title)}</h2>
          <div class="resume-progress"><span>${t(`${completed} of ${total} tasks complete`, `Выполнено ${completed} из ${total} заданий`, `${total} тапсырманың ${completed} орындалды`)}</span></div>
          <div class="progress-bar" role="progressbar" aria-label="${t("Lesson progress", "Прогресс занятия", "Сабақ барысы")}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><i style="width:${progress}%"></i></div>
          <p class="resume-next">${done ? t("Your answers and feedback are ready to review.", "Твои ответы и подсказки можно посмотреть снова.", "Жауаптарың мен кеңестерді қайта көре аласың.") : escapeHtml(next?.title || t("Continue with your next task.", "Продолжи со следующего задания.", "Келесі тапсырмадан жалғастыр."))}</p>
          <button class="primary large" data-view="learning-plan">${done ? t('View my lesson result','Посмотреть результат','Нәтижені көру') : t('Resume my lesson','Продолжить занятие','Сабақты жалғастыру')} ${icon('arrow', 19)}</button>
          <button class="text-link resume-path-link" data-view="courses">${t("My courses", "Мои курсы", "Курстарым")} ${icon('book', 16)}</button>
        </div>
      </section>
    </section>${pathLink}${newGoal}`;
  }
  return state.active && COURSES[state.active]
    ? `${resumeCard(state)}${pathLink}${newGoal}`
    : `${goalBanner(state.minutes)}${pathLink}`;
}

export function readyCoursesView(extraCourses = [], minutes = 10) {
  const courses = [
    { id: 'design', title: courseNames.design, minutes, mentor: 'Mia', icon: 'palette', builtin: true },
    { id: 'budget', title: courseNames.budget, minutes, mentor: 'Sam', icon: 'sheet', builtin: true },
    ...extraCourses,
  ];
  const mentorNames = { mino: 'Mino', mia: 'Mia', sam: 'Sam', artist: 'Ari', copywriter: 'Nora', smm: 'Zoe' };
  return `<section class="ready-courses" aria-labelledby="ready-courses-title"><h2 id="ready-courses-title">${t('Ready mini-courses', 'Готовые мини-курсы', 'Дайын шағын курстар')}</h2><fieldset class="course-pace"><legend>${t('Time for your next lesson','Время на новое занятие','Келесі сабаққа арналған уақыт')}</legend><div>${[5,10,20].map(value => `<button type="button" data-course-minutes="${value}" aria-pressed="${minutes === value}"><strong>${value}</strong> ${t('min','мин','мин')}</button>`).join('')}</div></fieldset><p class="course-pace-note">${t('A little learning, at your pace. Your unfinished lessons stay saved.', 'Учись в своём темпе. Начатые занятия остаются сохранёнными.', 'Өз қарқыныңмен үйрен. Бастаған сабақтарың сақталады.')}</p><div class="ready-course-grid">${courses.map(course => `<button type="button" class="ready-course" ${course.builtin ? `data-course="${escapeHtml(course.id)}" data-course-path` : `data-starter-course="${escapeHtml(course.id)}" data-starter-minutes="${course.minutes}"`}><span class="ready-course-symbol" aria-hidden="true">${icon(course.icon, 24)}</span><strong>${escapeHtml(course.title)}</strong><span class="ready-course-meta"><span>${escapeHtml(mentorNames[course.mentor] || course.mentor)} · ${course.minutes} ${t('min', 'мин', 'мин')}</span>${icon('arrow', 17)}</span></button>`).join('')}</div></section>`;
}

export function coursesPage(state, { showHeading = true, showCurrentLesson = true, showReadyCourses = false, readyCourses = [] } = {}) {
  const ids = startedCourses(state);
  // A combined library can supply the heading and the current account lesson.
  const saved = showCurrentLesson && !state.learningCourse ? state.learningPlan : null;
  const otherCoursesShown = Boolean(state.learningCourse || !showCurrentLesson);
  const newCourse = `<button type="button" class="secondary new-course-button" data-intro-action="new">${icon('plus', 18)} ${t('Learn something new', 'Изучить новое', 'Жаңа нәрсе үйрену')}</button>`;
  let personalCourse = '';
  if (saved) {
    const total = saved.plan.steps.length;
    const completed = Math.min(total, Math.max(0, saved.completed));
    const done = completed === total;
    const progress = total ? Math.round(completed / total * 100) : 0;
    personalCourse = `<article class="game-card catalog-tile course-row personalized">
      <div class="course-row-summary"><h2>${escapeHtml(saved.plan.title)}</h2>
      <div class="course-row-progress"><div class="progress-bar" role="progressbar" aria-label="${t("Lesson progress", "Прогресс занятия", "Сабақ барысы")}" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="${total}"><i style="width:${progress}%"></i></div><span>${done ? t("Completed", "Завершён", "Аяқталды") : `${progress}%`}</span></div></div>
      <button class="primary" data-view="learning-plan">${done ? t("View my lesson result", "Посмотреть результат", "Нәтижені көру") : t("Resume my lesson", "Продолжить занятие", "Сабақты жалғастыру")} ${icon('arrow', 18)}</button>
    </article>`;
  }
  const hasCourses = ids.length || saved;
  return `<section class="my-courses">${showHeading ? pageBanner(t("My courses", "Мои курсы", "Курстарым"), '') : ''}
    ${hasCourses ? `<div class="course-grid">${personalCourse}${ids.map(id => {
      const completed = state.progress[id], done = completed === 4;
      return `<article class="game-card catalog-tile course-row ${id}">
        <div class="course-row-summary"><h2>${courseNames[id]}</h2>
        <div class="course-row-progress"><div class="progress-bar" role="progressbar" aria-label="${courseNames[id]} progress" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="4"><i style="width:${completed * 25}%"></i></div><span>${done ? t("Completed", "Завершён", "Аяқталды") : `${completed * 25}%`}</span></div></div>
        <button class="primary" data-course="${id}" data-course-path>${done ? t("Review course", "Повторить курс", "Курсты қайталау") : t("Open course", "Открыть курс", "Курсты ашу")} ${icon('arrow', 18)}</button>
      </article>`;
    }).join('')}</div>` : otherCoursesShown || showReadyCourses ? '' : `<div class="empty-state courses-empty">${character('copywriter', 'thinking', 'empty-character')}<h2>${t("Start your first course", "Начни первый курс", "Алғашқы курсыңды баста")}</h2><p>${t("Choose what you’d like to learn.", "Выбери, чему хочешь научиться.", "Не үйренгің келетінін таңда.")}</p><button class="primary large" data-intro-action="new">${t("Choose a topic", "Выбрать тему", "Тақырып таңдау")} ${icon('arrow', 18)}</button></div>`}
    ${showReadyCourses ? readyCoursesView(readyCourses, state.minutes) : ''}${hasCourses || otherCoursesShown || showReadyCourses ? newCourse : ''}
  </section>`;
}

export function pageBanner(title, description, mood = 'study') {
  const kind = mood === 'smm' ? 'smm' : 'mino';
  const pose = mood === 'cheer' ? 'celebrate' : mood === 'smm' ? 'explaining' : mood;
  return `<section class="page-banner page-banner-${escapeHtml(mood)}"><div><h1>${escapeHtml(title)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>${mood === 'study' ? '' : character(kind, pose, 'page-character')}</section>`;
}

export function achievementsCard(state, stats, icon, full = false) {
  const awards = [
    ['flame', t("Keep going", "Продолжай", "Жалғастыр"), t("Learn 5 days in a row", "Учись 5 дней подряд", "5 күн қатарынан оқы"), stats.streak >= 5],
    ['book', t("Curious mind", "Любознательный ученик", "Ізденімпаз оқушы"), t("Complete 4 learning steps", "Пройди 4 этапа", "4 кезеңді аяқта"), stats.total >= 4],
    ['star', t("Independent maker", "Самостоятельный автор", "Өздік жұмыс авторы"), t("Finish 2 projects on your own", "Заверши 2 самостоятельные работы", "2 өздік жұмысты аяқта"), Object.values(state.works).filter(work => work.challenge).length >= 2],
  ];
  return `<section class="game-card game-achievements">
    ${full ? '' : `<div class="game-card-top"><h2>${t("Milestones", "Достижения", "Жетістіктер")}</h2><button class="text-link" data-action="achievements">${t("See all", "Посмотреть все", "Барлығын көру")} ${icon('arrow', 16)}</button></div>`}
    <p class="milestone-summary">${t(`${awards.filter(([, , , earned]) => earned).length} of ${awards.length} badges earned`, `Получено ${awards.filter(([, , , earned]) => earned).length} из ${awards.length} наград`, `${awards.length} марапаттың ${awards.filter(([, , , earned]) => earned).length} алынды`)}</p>
    <div class="awards">${awards.map(([symbol, title, detail, earned]) => `<div class="award ${earned ? 'earned' : ''}"><span class="award-icon">${icon(symbol, 27)}</span><strong>${title}</strong><small>${earned ? t("Earned", "Получено", "Алдың") : detail}</small></div>`).join('')}</div>
  </section>`;
}

export function sidePage(view, state, rewardProfile = '') {
  const stats = learningStats(state);
  if (view === 'practice') {
    return `${pageBanner(t("Practice", "Практика", "Жаттығу"), t("Put your new skills to work.", "Примени новые навыки.", "Жаңа дағдыларыңды қолдан."))}
      <div class="course-grid">${Object.keys(COURSES).map(id => {
        const unlocked = state.progress[id] >= 2;
        return `<section class="game-card practice-tile ${id}"><span class="course-symbol">${icon(id === 'design' ? 'palette' : 'sheet', 26)}</span><h2>${courseNames[id]}</h2><p>${unlocked ? t("Try a new task.", "Попробуй новое задание.", "Жаңа тапсырма орында.") : t("Complete the lesson and quiz to unlock practice.", "Пройди урок и тест, чтобы открыть практику.", "Жаттығуды ашу үшін сабақ пен тестті аяқта.")}</p><button class="${unlocked ? 'primary' : 'secondary'}" ${unlocked ? `data-action="practice" data-id="${id}"` : `data-course="${id}"`}>${unlocked ? t("Practise", "Начать практику", "Жаттығуды бастау") : t("Open lessons", "Открыть уроки", "Сабақтарды ашу")} ${icon(unlocked ? 'arrow' : 'lock', 18)}</button></section>`;
      }).join('')}</div>`;
  }
  if (view === 'achievements') return `${pageBanner(t("Milestones", "Достижения", "Жетістіктер"), t("See what you’ve achieved.", "Посмотри на свои достижения.", "Жетістіктеріңді көр."), 'cheer')}${achievementsCard(state, stats, icon, true)}`;
  if (view === 'community') return `${pageBanner(t("Learning, together.", "Сообщество", "Қауымдастық"), t("A little space for curious people.", "Место для общения учеников.", "Оқушылардың араласатын орны."))}<section class="game-card community-preview"><span class="course-symbol">${icon('users', 28)}</span><h2>${t("Our community is still growing.", "Сообщество в разработке.", "Қауымдастық әзірленіп жатыр.")}</h2><p>${t("Sharing and discussions aren’t available yet. For now, keep your projects in My work.", "Готовые проекты доступны в разделе «Мои работы».", "Дайын жобалар «Жұмыстарым» бөлімінде.")}</p><button class="secondary" data-view="work">${t("See my work", "Мои работы", "Жұмыстарым")} ${icon('arrow', 18)}</button></section>`;
  return `<div class="simple-profile"><header class="simple-profile-heading"><h1>${t('Profile', 'Профиль', 'Профиль')}</h1><span>${t('Your learning, your pace.', 'Учись в своём темпе.', 'Өз қарқыныңмен үйрен.')}</span></header>
    <section class="account-profile-card" data-account-summary><span class="profile-avatar" aria-hidden="true">${icon('user', 25)}</span><h2 data-account-name>${t("Make yourself at home", "Добро пожаловать", "Қош келдің")}</h2><p data-account-description>${t("Create your profile and choose what you enjoy.", "Создай профиль и выбери, что тебе интересно.", "Профиль жасап, қызығушылығыңды таңда.")}</p><button class="secondary" data-account-open="signup">${t("Create account", "Создать аккаунт", "Аккаунт жасау")}</button><button class="text-link" data-account-secondary data-account-open="signin">${t("Already a member? Sign in", "Уже есть аккаунт? Войти", "Аккаунтың бар ма? Кіру")}</button><button type="button" class="secondary profile-signout" data-account-signout hidden>${t("Sign out of account", "Выйти из аккаунта", "Аккаунттан шығу")}</button></section>
    <section class="profile-overview" aria-label="${t("Your progress", "Твой прогресс", "Оқу барысың")}"><div class="profile-stats"><div><strong>${stats.total}</strong><span>${t("Steps completed", "Пройдено этапов", "Аяқталған кезеңдер")}</span></div><div><strong>${Object.keys(state.works).length}</strong><span>${t("Projects saved", "Сохранено работ", "Сақталған жұмыстар")}</span></div></div></section>
    <section class="profile-settings"><div><h2>${t("Daily learning time", "Время на обучение", "Оқу уақыты")}</h2></div><label class="visually-hidden" for="profile-minutes">${t("Daily learning time", "Время на обучение", "Оқу уақыты")}</label><select class="profile-select" id="profile-minutes">${timeOptions(state.minutes)}</select></section>
    <section class="profile-settings motion-preference"><div><h2>${t("Character motion", "Анимация персонажей", "Кейіпкер анимациясы")}</h2><small data-character-motion-status></small></div><button type="button" class="motion-switch" role="switch" data-character-motion aria-label="${t("Character motion", "Анимация персонажей", "Кейіпкер анимациясы")}"><span data-character-motion-label>${t("Character motion", "Анимация персонажей", "Кейіпкер анимациясы")}</span></button></section>
    <nav class="profile-links" aria-label="${t("Learning tools", "Инструменты обучения", "Оқу құралдары")}">${[['work', 'folder', t('My work', 'Мои работы', 'Жұмыстарым')], ['practice', 'edit', t("Practice", "Практика", "Жаттығу")], ['achievements', 'trophy', t("Milestones", "Достижения", "Жетістіктер")]].map(([target, symbol, title]) => `<button data-view="${target}"><span class="profile-link-icon">${icon(symbol, 23)}</span><span><strong>${title}</strong></span>${icon('arrow', 18)}</button>`).join('')}<button data-action="about"><span class="profile-link-icon">${icon('leaf', 23)}</span><span><strong>${t("About Mindora", "О Mindora", "Mindora туралы")}</strong></span>${icon('arrow', 18)}</button></nav>
    ${rewardProfile ? `<details class="profile-rewards"><summary>${t('Learning activity', 'Учебная активность', 'Оқу белсенділігі')}${icon('chevron', 18)}</summary>${rewardProfile}</details>` : ''}
    <section class="game-card simple-panel" data-cloud-panel="profile"></section>
    <p class="profile-note">${icon('lock', 14)} ${t("Progress is saved in this browser.", "Прогресс сохраняется в этом браузере.", "Оқу барысы осы браузерде сақталады.")}</p></div>`;
}
