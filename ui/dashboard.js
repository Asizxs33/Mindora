import { COURSES, escapeHtml } from '../core/engine.js';
import { resumeCursor } from '../core/resume.js';
import { learningStats } from '../core/progress.js';
import { icon } from './icons.js';
import { timeOptions } from './budget-session.js';
import { character } from './characters.js';
import { t } from './language.js';

export const courseNames = {
  get design() { return t('Your first poster','Твой первый постер','Алғашқы постерің'); },
  get budget() { return t('Everyday spreadsheets','Таблицы на каждый день','Күнделікті кестелер'); },
};
export const lessonNames = {
  get design() { return t(['Make one thing stand out', 'Train your design eye', 'Make it yours', 'Try a fresh brief'], ['Выдели главное','Проверь знания','Сделай свой постер','Новый постер'], ['Ең маңыздысын көрсет','Біліміңді тексер','Өз постеріңді жаса','Жаңа постер']); },
  get budget() { return t(['Meet your first formula', 'Think in cells', 'Build your own tracker', 'A new set of numbers'], ['Первая формула','Разберись с ячейками','Собери свою таблицу','Новые данные'], ['Алғашқы формула','Ұяшықтарды түсін','Өз кестеңді жаса','Жаңа деректер']); },
};
const descriptions = {
  get design() { return t('Make a poster with a clear message.', 'Сделай постер с понятной идеей.', 'Ойы анық постер жаса.'); },
  get budget() { return t('Track expenses with a simple formula.', 'Считай расходы простой формулой.', 'Шығындарды қарапайым формуламен есепте.'); },
};
const guide = id => id === 'design' ? 'designer' : 'sam';
const guideLabel = id => id === 'design' ? t("Your design guide", "Твой наставник по дизайну", "Дизайн тәлімгерің") : t("Your numbers guide", "Твой наставник по таблицам", "Кестелер тәлімгерің");
const startedCourses = state => Object.keys(COURSES).filter(id => state.goals[id] || state.progress[id] || state.works[id]);

export function badge(icon, name, color, size = 22) {
  return `<span class="game-icon ${color}">${icon(name, size)}</span>`;
}

export function brandNav(icon, view, place) {
  const items = [['discover', 'home', t('Learn','Обучение','Оқу')], ['courses', 'book', t('My courses','Мои курсы','Курстарым')], ['work', 'folder', t('My work','Мои работы','Жұмыстарым')], ['profile', 'user', t('Profile','Профиль','Профиль')]];
  return items.map(([key, symbol, name]) => {
    const active = view === key || (key === 'discover' && ['path', 'lesson', 'learning-plan', 'recap', 'result', 'certificate'].includes(view))
      || (key === 'profile' && ['practice', 'achievements', 'community'].includes(view));
    return `<button class="nav-item ${active ? 'active' : ''}" data-view="${key}" ${active ? 'aria-current="page"' : ''}>${icon(symbol, place === 'bottom' ? 22 : 23)}<span>${name}</span></button>`;
  }).join('');
}

function goalBanner(minutes, compact = false) {
  return `<section class="learn-home ${compact ? 'new-goal-section' : ''}" aria-labelledby="welcome-title">
    ${compact ? '' : `<div class="hero-character">${character('mino', 'welcome', 'home-character')}</div><div class="speech-bubble" aria-live="polite">${t("Hi! I’m Mino. Let’s learn something.", "Привет! Я Мино.", "Сәлем! Мен Мино.")}</div>`}
    <div class="goal-copy">
      <${compact ? 'h2' : 'h1'} id="welcome-title">${t('What do you want to learn?', 'Чему ты хочешь научиться?', 'Не үйренгің келеді?')}</${compact ? 'h2' : 'h1'}>
      <p>${t('Choose a goal and get a lesson that fits your time.', 'Выбери цель и укажи, сколько времени у тебя есть.', 'Мақсатыңды жазып, сабаққа қанша уақытың барын таңда.')}</p>
    </div>
    <form id="goal-form" class="goal-form">
      <label class="visually-hidden" for="goal-input">${t('What do you want to learn?', 'Чему ты хочешь научиться?', 'Не үйренгің келеді?')}</label>
      <input id="goal-input" name="goal" placeholder="${t('I want to learn how to…','Я хочу научиться…','Үйренгім келетіні…')}" minlength="3" maxlength="180" required autocomplete="off">
      <label class="field"><span>${t('Time for this lesson','Время на занятие','Сабақ уақыты')}</span><select id="time-select" class="profile-select">${timeOptions(minutes)}</select></label>
      <button type="submit" class="primary large">${t('Build my lesson','Построить занятие','Сабақ құру')} ${icon('arrow', 19)}</button>
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
      <div class="resume-mentor">${character(guide(id), done ? 'celebrate' : 'explaining', 'resume-character')}<span>${guideLabel(id)}</span></div>
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
  const session = saved ? `<section class="game-card simple-panel">
    <h2>${escapeHtml(saved.plan.title)}</h2>
    <p>${t(`${saved.completed} of ${saved.plan.steps.length} tasks complete`, `Выполнено ${saved.completed} из ${saved.plan.steps.length} заданий`, `${saved.plan.steps.length} тапсырманың ${saved.completed} орындалды`)}</p>
    <button class="primary" data-view="learning-plan">${saved.completed === saved.plan.steps.length ? t('View my lesson result','Посмотреть результат','Нәтижені көру') : t('Resume my lesson','Продолжить занятие','Сабақты жалғастыру')}</button>
  </section>` : '';
  return state.active && COURSES[state.active]
    ? `${session}${resumeCard(state)}<details class="goal-disclosure"><summary><span>${t("Learn something else", "Выбрать другую цель", "Басқа мақсат таңдау")}</span>${icon('chevron', 18)}</summary>${goalBanner(state.minutes, true)}</details>`
    : `${session}${goalBanner(state.minutes)}`;
}

export function coursesPage(state) {
  const ids = startedCourses(state);
  return `<section class="my-courses">${pageBanner(t("My courses", "Мои курсы", "Курстарым"), ids.length ? t("Pick up where you left off.", "Продолжи с того же места.", "Тоқтаған жерден жалғастыр.") : '')}
    ${ids.length ? `<div class="course-grid">${ids.map(id => {
      const completed = state.progress[id], done = completed === 4;
      return `<article class="game-card catalog-tile ${id}">
        <div class="course-tile-top"><span class="course-symbol">${icon(id === 'design' ? 'palette' : 'sheet', 26)}</span><span class="course-state ${done ? 'complete' : ''}">${done ? t("Completed", "Завершён", "Аяқталды") : t(`${completed * 25}% complete`, `Пройдено ${completed * 25}%`, `${completed * 25}% аяқталды`)}</span></div>
        <h2>${courseNames[id]}</h2><p>${descriptions[id]}</p>
        <div class="progress-bar" role="progressbar" aria-label="${courseNames[id]} progress" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="4"><i style="width:${completed * 25}%"></i></div>
        <button class="primary" data-course="${id}">${done ? t("Review course", "Повторить курс", "Курсты қайталау") : t("Open course", "Открыть курс", "Курсты ашу")} ${icon('arrow', 18)}</button>
      </article>`;
    }).join('')}</div><button class="secondary new-course-button" data-home>${icon('plus', 18)} ${t("Find a new course", "Найти новый курс", "Жаңа курс табу")}</button>` : `<div class="empty-state courses-empty">${character('copywriter', 'thinking', 'empty-character')}<h2>${t("Start your first course", "Начни первый курс", "Алғашқы курсыңды баста")}</h2><p>${t("Choose what you’d like to learn.", "Выбери, чему хочешь научиться.", "Не үйренгің келетінін таңда.")}</p><button class="primary large" data-home>${t("Choose a topic", "Выбрать тему", "Тақырып таңдау")} ${icon('arrow', 18)}</button></div>`}
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

export function sidePage(view, state) {
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
  return `${pageBanner(t("Profile", "Профиль", "Профиль"), '', 'smm')}
    <section class="account-profile-card" data-account-summary><h2 data-account-name>${t("Make yourself at home", "Добро пожаловать", "Қош келдің")}</h2><p data-account-description>${t("Create your profile and choose what you enjoy.", "Создай профиль и выбери, что тебе интересно.", "Профиль жасап, қызығушылығыңды таңда.")}</p><button class="primary" data-account-open="signup">${t("Create account", "Создать аккаунт", "Аккаунт жасау")}</button><button class="text-link" data-account-secondary data-account-open="signin">${t("Already a member? Sign in", "Уже есть аккаунт? Войти", "Аккаунтың бар ма? Кіру")}</button></section>
    <section class="profile-overview" aria-label="${t("Your progress", "Твой прогресс", "Оқу барысың")}"><div class="profile-stats"><div><strong>${stats.total}</strong><span>${t("Steps completed", "Пройдено этапов", "Аяқталған кезеңдер")}</span></div><div><strong>${Object.keys(state.works).length}</strong><span>${t("Projects saved", "Сохранено работ", "Сақталған жұмыстар")}</span></div></div></section>
    <section class="profile-settings"><div><h2>${t("Daily learning time", "Время на обучение", "Оқу уақыты")}</h2></div><label class="visually-hidden" for="profile-minutes">${t("Daily learning time", "Время на обучение", "Оқу уақыты")}</label><select class="profile-select" id="profile-minutes">${timeOptions(state.minutes)}</select></section>
    <section class="profile-settings motion-preference"><div><h2>${t("Character motion", "Анимация персонажей", "Кейіпкер анимациясы")}</h2><small data-character-motion-status></small></div><button type="button" class="motion-switch" role="switch" data-character-motion aria-label="${t("Character motion", "Анимация персонажей", "Кейіпкер анимациясы")}"><span data-character-motion-label>${t("Character motion", "Анимация персонажей", "Кейіпкер анимациясы")}</span></button></section>
    <nav class="profile-links" aria-label="${t("Learning tools", "Инструменты обучения", "Оқу құралдары")}">${[['practice', 'edit', t("Practice", "Практика", "Жаттығу")], ['achievements', 'trophy', t("Milestones", "Достижения", "Жетістіктер")]].map(([target, symbol, title]) => `<button data-view="${target}"><span class="profile-link-icon">${icon(symbol, 23)}</span><span><strong>${title}</strong></span>${icon('arrow', 18)}</button>`).join('')}<button data-action="about"><span class="profile-link-icon">${icon('leaf', 23)}</span><span><strong>${t("About Mindora", "О Mindora", "Mindora туралы")}</strong></span>${icon('arrow', 18)}</button></nav>
    <section class="game-card simple-panel" data-cloud-panel="profile"></section>
    <p class="profile-note">${icon('lock', 14)} ${t("Progress is saved in this browser.", "Прогресс сохраняется в этом браузере.", "Оқу барысы осы браузерде сақталады.")}</p>`;
}
