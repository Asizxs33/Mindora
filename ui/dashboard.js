import { COURSES, escapeHtml } from '../core/engine.js';
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
  design: 'Make a clear, colourful poster. Keep it as your own SVG file.',
  budget: 'Add up everyday expenses with a simple formula. Keep your table as a CSV file.',
};
const guide = id => id === 'design' ? 'mia' : 'sam';
const guideName = id => id === 'design' ? 'Mia' : 'Sam';

export function badge(icon, name, color, size = 22) {
  return `<span class="game-icon ${color}">${icon(name, size)}</span>`;
}

export function brandNav(icon, view, place) {
  const items = [['discover', 'home', t('Learn','Обучение','Оқу')], ['courses', 'book', t('My courses','Мои курсы','Курстарым')], ['work', 'folder', t('My work','Мои работы','Жұмыстарым')], ['profile', 'user', t('Profile','Профиль','Профиль')]];
  return items.map(([key, symbol, name]) => {
    const active = view === key || (key === 'discover' && ['path', 'lesson', 'result', 'learning-plan'].includes(view))
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
    <div class="topic-shortcuts" aria-label="Available learning topics">
      <button class="topic-shortcut" data-course="design">${icon('palette', 18)} Make a poster</button>
      <button class="topic-shortcut" data-course="budget">${icon('sheet', 18)} Learn spreadsheets</button>
    </div>
  </section>`;
}

function resumeCard(state) {
  const id = state.active, completed = state.progress[id], current = Math.min(completed, 3), done = completed === 4;
  return `<section class="return-home" aria-labelledby="return-title">
    <div class="return-heading"><span class="eyebrow">${t("YOUR LITTLE LEARNING SPACE", "ТВОЁ ОБУЧЕНИЕ", "ОҚУЫҢ")}</span><h1 id="return-title">${done ? t("Look how far you’ve come.", "Посмотри на свой результат", "Нәтижеңді көр") : t("Ready for a little more?", "Продолжим обучение?", "Оқуды жалғастырамыз ба?")}</h1><p>${done ? t("Your project is ready. Keep exploring when you feel like it.", "Твоя работа готова.", "Жұмысың дайын.") : t("Your place is saved. Let’s take the next small step.", "Ты можешь продолжить с того же места.", "Тоқтаған жерден жалғастыра аласың.")}</p></div>
    <section class="resume-card ${id}">
      <div class="resume-mentor">${character(guide(id), done ? 'celebrate' : 'explaining', 'resume-character')}<span>${guideName(id)}, your learning buddy</span></div>
      <div class="resume-body"><span class="eyebrow">${done ? t("COURSE COMPLETE", "КУРС ЗАВЕРШЁН", "КУРС АЯҚТАЛДЫ") : t("PICK UP WHERE YOU LEFT OFF", "ПРОДОЛЖИ ОБУЧЕНИЕ", "ОҚУДЫ ЖАЛҒАСТЫР")}</span><h2>${courseNames[id]}</h2>
        <div class="resume-progress"><span>${completed} of 4 steps complete</span><strong>${completed * 25}%</strong></div>
        <div class="progress-bar" role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${completed}"><i style="width:${completed * 25}%"></i></div>
        <p class="resume-next">${done ? 'One new skill. One project of your own.' : `Next: ${lessonNames[id][current]}`}</p>
        <button class="primary large" ${done ? 'data-view="work"' : `data-step="${current}"`}>${done ? t("See my work", "Мои работы", "Жұмыстарым") : completed ? t("Continue learning", "Продолжить обучение", "Оқуды жалғастыру") : t("Start my first lesson", "Начать первый урок", "Алғашқы сабақты бастау")} ${icon('arrow', 19)}</button>
        <button class="text-link" data-view="path">${done ? t("Revisit my learning path", "Вернуться к курсу", "Курсқа оралу") : t("See my learning path", "Открыть маршрут", "Оқу жолын ашу")} ${icon('map', 16)}</button>
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
    ? `${session}${resumeCard(state)}${goalBanner(state.minutes, true)}`
    : `${session}${goalBanner(state.minutes)}`;
}

export function coursesPage(state) {
  const ids = Object.keys(COURSES);
  return `<section class="my-courses">${pageBanner(t('My courses','Мои курсы','Курстарым'), t("Choose a course to practise.", "Выбери готовый курс для практики.", "Жаттығу үшін дайын курсты таңда."))}
    <div class="course-grid">${ids.map(id => {
      const completed = state.progress[id], done = completed === 4;
      return `<article class="game-card catalog-tile ${id}">
        <div class="course-tile-top"><span class="course-symbol">${icon(id === 'design' ? 'palette' : 'sheet', 26)}</span><span class="course-state ${done ? 'complete' : ''}">${done ? t("Completed", "Завершён", "Аяқталды") : `${completed} of 4 steps`}</span></div>
        <h2>${courseNames[id]}</h2><p>${descriptions[id]}</p>
        <div class="progress-bar" role="progressbar" aria-label="${courseNames[id]} progress" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="4"><i style="width:${completed * 25}%"></i></div>
        <button class="primary" data-course="${id}">${done ? t("Revisit course", "Повторить курс", "Курсты қайталау") : t("Open my course", "Открыть курс", "Курсты ашу")} ${icon('arrow', 18)}</button>
      </article>`;
    }).join('')}</div><button class="secondary new-course-button" data-home>${icon('plus', 18)} ${t("Explore another goal", "Выбрать другую цель", "Басқа мақсат таңдау")}</button>
  </section>`;
}

export function pageBanner(title, description, mood = 'study') {
  const pose = mood === 'cheer' ? 'celebrate' : mood === 'study' ? 'explaining' : mood;
  return `<section class="page-banner page-banner-${mood}"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${character('mino', pose, 'page-character')}</section>`;
}

export function achievementsCard(state, stats, icon, full = false) {
  const awards = [
    ['flame', t("A little every day", "Каждый день понемногу", "Күн сайын аздап"), t("Learn on 5 days in a row", "Учись 5 дней подряд", "5 күн қатарынан оқы"), stats.streak >= 5],
    ['book', t("Curious mind", "Любознательный ученик", "Ізденімпаз оқушы"), t("Complete 4 learning steps", "Пройди 4 этапа", "4 кезеңді аяқта"), stats.total >= 4],
    ['star', t("Made by you", "Своя работа", "Өз жұмысың"), t("Finish 2 independent projects", "Заверши 2 самостоятельные работы", "2 өздік жұмысты аяқта"), Object.values(state.works).filter(work => work.challenge).length >= 2],
  ];
  return `<section class="game-card game-achievements">
    ${full ? '' : `<div class="game-card-top"><h2>Your little milestones</h2><button class="text-link" data-action="achievements">See all ${icon('arrow', 16)}</button></div>`}
    <div class="level-row"><div class="level-chip"><span class="level-medal">${icon('spark', 26)}</span><div><strong>Level ${stats.level}</strong><small>A curious explorer</small></div></div><div class="xp-track"><strong>${stats.xp} XP</strong><div class="xp-bar"><i style="width:${(stats.xp % 200) / 2}%"></i></div><small>${200 - stats.xp % 200} XP to level ${stats.level + 1}</small></div></div>
    <div class="awards">${awards.map(([symbol, title, detail, earned]) => `<div class="award ${earned ? 'earned' : ''}"><span class="award-icon">${icon(symbol, 27)}</span><strong>${title}</strong><small>${earned ? t("You earned this!", "Получено!", "Алдың!") : detail}</small></div>`).join('')}</div>
  </section>`;
}

export function sidePage(view, state) {
  const stats = learningStats(state);
  if (view === 'practice') {
    return `${pageBanner(t("A little practice", "Практика", "Жаттығу"), t("Try an idea. Make something. Learn by doing.", "Попробуй ещё одно практическое задание.", "Тағы бір жаттығу орында."))}
      <div class="course-grid">${Object.keys(COURSES).map(id => {
        const unlocked = state.progress[id] >= 2;
        return `<section class="game-card practice-tile ${id}"><span class="course-symbol">${icon(id === 'design' ? 'palette' : 'sheet', 26)}</span><h2>${courseNames[id]}</h2><p>${unlocked ? t("A fresh little challenge to make your new skill stick.", "Новое задание для закрепления навыка.", "Дағдыны бекітуге арналған жаңа тапсырма.") : t("Finish the lesson and three questions to unlock this practice.", "Пройди урок и тест, чтобы открыть практику.", "Жаттығуды ашу үшін сабақ пен тестті аяқта.")}</p><button class="${unlocked ? 'primary' : 'secondary'}" ${unlocked ? `data-action="practice" data-id="${id}"` : `data-course="${id}"`}>${unlocked ? t("Let me try", "Начать практику", "Жаттығуды бастау") : t("Go to my lessons", "Открыть уроки", "Сабақтарды ашу")} ${icon(unlocked ? 'arrow' : 'lock', 18)}</button></section>`;
      }).join('')}</div>`;
  }
  if (view === 'achievements') return `${pageBanner(t("Look at you grow.", "Твои достижения", "Жетістіктерің"), t("Every small step counts.", "Твой прогресс в обучении.", "Оқу барысың."), 'cheer')}${achievementsCard(state, stats, icon, true)}`;
  if (view === 'community') return `${pageBanner(t("Learning, together.", "Сообщество", "Қауымдастық"), t("A little space for curious people.", "Место для общения учеников.", "Оқушылардың араласатын орны."))}<section class="game-card community-preview"><span class="course-symbol">${icon('users', 28)}</span><h2>${t("Our community is still growing.", "Сообщество в разработке.", "Қауымдастық әзірленіп жатыр.")}</h2><p>${t("Sharing and discussions aren’t available yet. For now, keep your projects in My work.", "Готовые проекты доступны в разделе «Мои работы».", "Дайын жобалар «Жұмыстарым» бөлімінде.")}</p><button class="secondary" data-view="work">See my work ${icon('arrow', 18)}</button></section>`;
  return `${pageBanner(t('My profile','Мой профиль','Профилім'), t('Learning settings and drafts.','Настройки обучения и черновики.','Оқу баптаулары мен нобайлар.'))}
    <section class="profile-overview"><div class="profile-identity"><span class="profile-avatar">${icon('user', 25)}</span><div><h2>${t("Curious learner", "Ученик", "Оқушы")}</h2><p>${t("Guest profile · Level ", "Гостевой профиль · Уровень ", "Қонақ профилі · Деңгей ")}${stats.level}</p></div></div>
      <div class="profile-stats"><div><strong>${stats.total}</strong><span>${t("Steps learned", "Пройдено этапов", "Аяқталған кезеңдер")}</span></div><div><strong>${Object.keys(state.works).length}</strong><span>${t("Projects made", "Готовых работ", "Дайын жұмыстар")}</span></div><div><strong>${stats.xp}</strong><span>${t("XP earned", "Получено XP", "Жиналған XP")}</span></div></div>
    </section>
    <section class="profile-settings"><div><h2>${t('Your daily pace','Время на обучение','Оқу уақыты')}</h2><p>${t('Choose your usual lesson duration.','Выбери привычное время занятия.','Сабақтың әдеттегі ұзақтығын таңда.')}</p></div><label class="visually-hidden" for="profile-minutes">${t('Daily learning time','Время на обучение','Оқу уақыты')}</label><select class="profile-select" id="profile-minutes">${timeOptions(state.minutes)}</select></section>
    <section class="profile-settings motion-preference"><div><h2>${t('Character motion','Анимация персонажей','Кейіпкер анимациясы')}</h2><small data-character-motion-status></small></div><button type="button" class="motion-switch" role="switch" data-character-motion aria-label="${t('Character motion','Анимация персонажей','Кейіпкер анимациясы')}"><span data-character-motion-label>${t('Character motion','Анимация персонажей','Кейіпкер анимациясы')}</span></button></section>
    <nav class="profile-links" aria-label="More to explore">${[['practice', 'edit', t("A little practice", "Практика", "Жаттығу"), t("Try something you’ve learned", "Закрепи навык", "Үйренгеніңді қолданып көр")], ['achievements', 'trophy', t("My milestones", "Мои достижения", "Жетістіктерім"), t("Track your progress", "Посмотри свой прогресс", "Оқу барысын көр")], ['community', 'users', t("Community", "Сообщество", "Қауымдастық"), t("Community space", "Пространство сообщества", "Қауымдастық кеңістігі")]].map(([target, symbol, title, text]) => `<button data-view="${target}"><span class="profile-link-icon">${icon(symbol, 23)}</span><span><strong>${title}</strong><small>${text}</small></span>${icon('arrow', 18)}</button>`).join('')}<button data-action="about"><span class="profile-link-icon">${icon('leaf', 23)}</span><span><strong>${t("About Mindora", "О Mindora", "Mindora туралы")}</strong><small>Small steps. Real things you can make.</small></span>${icon('arrow', 18)}</button></nav>
    <section class="game-card simple-panel" data-cloud-panel="profile"></section>
    <p class="profile-note">${icon('lock', 14)} ${t("Your progress and finished projects stay in this browser.", "Прогресс и готовые работы сохраняются в этом браузере.", "Ілгерілеу мен дайын жұмыстар осы браузерде сақталады.")}</p>`;
}
