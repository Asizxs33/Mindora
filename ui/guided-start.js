import { character } from './characters.js';
import { escapeHtml as esc } from '../core/engine.js';
import { t, languagePicker } from './language.js';
import { icon } from './icons.js';
import { lessonNames } from './dashboard.js';

export const startTopics = () => [
  { id: 'design', label: t('Make a poster', 'Создать постер', 'Постер жасау'), goal: 'Design a clear poster', icon: 'palette' },
  { id: 'budget', label: t('Use spreadsheets', 'Освоить таблицы', 'Кестелерді меңгеру'), goal: 'Track everyday expenses in a spreadsheet', icon: 'sheet' },
  { id: 'english', label: t('Speak English', 'Говорить по-английски', 'Ағылшынша сөйлеу'), goal: 'Practise everyday English conversations', icon: 'book' },
  { id: 'custom', label: t('My own topic', 'Своя тема', 'Өз тақырыбым'), goal: '', icon: 'spark' },
];

export function guidedStartView({ step = 0, name = '', topic = '', goal = '', minutes = 10, signedIn = false } = {}) {
  const prompts = [t('Hi, I’m Mino. Tell me what you’d like to learn.', 'Привет, я Мино. Чему хочешь научиться?', 'Сәлем, мен Миномын. Не үйренгің келеді?'),
    t('What should I call you?', 'Как тебя зовут?', 'Сені қалай атайын?'),
    name ? t(`Nice to meet you, ${name}. What interests you?`, `Рад знакомству, ${name}. Что тебе интересно?`, `Танысқаныма қуаныштымын, ${name}. Не қызықтырады?`) : t('What would you like to learn?', 'Чему хочешь научиться?', 'Не үйренгің келеді?'),
    t('How much time do you have today?', 'Сколько времени у тебя сегодня?', 'Бүгін қанша уақытың бар?')];
  const greeting = step === 0;
  const valid = greeting || step === 1 ? greeting || Boolean(name.trim()) : step === 2 ? Boolean(topic && (topic !== 'custom' || goal.trim().length >= 3)) : true;
  return `<section class="guided-start ${greeting ? 'guided-greeting' : ''}" data-guided-step="${step}">
    <header class="guided-header"><a class="guided-brand" href="#discover" data-home aria-label="Mindora">mindora<span>.</span></a><div class="guided-header-actions">${languagePicker()}${signedIn ? `<button type="button" class="guided-account" data-account-open="profile" aria-label="${t('My account','Мой аккаунт','Аккаунтым')}">${icon('user',21)}</button>` : ''}</div></header>
    ${greeting ? '' : `<div class="guided-progress"><button type="button" class="guided-back" data-intro-action="back" aria-label="${t('Back','Назад','Артқа')}">${icon('back',22)}</button><progress max="3" value="${step}" aria-label="${t('Getting started','Знакомство','Танысу')}"></progress><span>${step}/3</span></div>`}
    <div class="guided-content">
      <div class="guided-dialogue"><p id="guided-prompt" tabindex="-1">${esc(prompts[step])}</p></div>
      ${character('mino', ['map', 'listening', 'idea', 'break'][step] || 'listening', 'guided-mino')}
      ${greeting ? `<h1>${t('Your goal, one short lesson at a time.', 'К твоей цели — короткими уроками.', 'Мақсатыңа шағын сабақтармен жет.')}</h1>` : ''}
      ${step === 1 ? `<form id="intro-name-form" class="guided-field"><label for="intro-name">${t('Your name','Твоё имя','Атың')}</label><input id="intro-name" name="name" value="${esc(name)}" maxlength="80" autocomplete="given-name" required placeholder="${t('Your name','Твоё имя','Атың')}"></form>` : ''}
      ${step === 2 ? `<div class="guided-topics" role="group" aria-labelledby="guided-prompt">${startTopics().map(item => `<button type="button" class="guided-option" data-intro-topic="${item.id}" aria-pressed="${topic === item.id}">${icon(item.icon,23)}<span>${item.label}</span>${topic === item.id ? icon('check',19) : ''}</button>`).join('')}</div>${topic === 'custom' ? `<label class="guided-field" for="intro-goal"><span>${t('What do you want to do?','Что хочешь научиться делать?','Не істеуді үйренгің келеді?')}</span><input id="intro-goal" value="${esc(goal)}" minlength="3" maxlength="180" placeholder="${t('For example, edit my first video','Например, смонтировать первое видео','Мысалы, алғашқы видеомды өңдеу')}"></label>` : ''}` : ''}
      ${step === 3 ? `<div class="guided-pace" role="group" aria-labelledby="guided-prompt">${[5,10,20].map(value => `<button type="button" class="guided-option" data-intro-minutes="${value}" aria-pressed="${minutes === value}"><strong>${value}</strong><span>${t('minutes','минут','минут')}</span>${minutes === value ? icon('check',18) : ''}</button>`).join('')}</div><p class="guided-small">${t('You can pause whenever you need.', 'Можно остановиться в любой момент.', 'Кез келген уақытта үзіліс жасай аласың.')}</p>` : ''}
    </div>
    <footer class="guided-footer"><button type="button" class="primary" ${greeting ? 'data-view="new-course"' : `data-intro-action="${step === 3 ? 'start' : 'next'}"`} ${valid ? '' : 'disabled'}>${greeting ? t('Let’s begin','Начнём','Бастайық') : step === 3 ? t('Start learning','Начать обучение','Оқуды бастау') : t('Continue','Продолжить','Жалғастыру')}${icon('arrow',20)}</button>${greeting && !signedIn ? `<button type="button" class="guided-signin" data-account-open="signin">${t('I already have an account','У меня уже есть аккаунт','Менде аккаунт бар')}</button>` : ''}</footer>
  </section>`;
}

export function quietHomeView(state) {
  const saved = state.lastLearningType === 'builtin' && state.active ? null : state.learningPlan, id = state.active;
  const steps = saved ? saved.plan.steps.map(step => step.title) : lessonNames[id];
  if (!steps?.length) return '';
  const completed = saved ? saved.completed : state.progress[id] || 0;
  const done = completed === steps.length;
  const minutes = saved ? saved.plan.minutes : state.minutes;
  const hasStarted = completed > 0 || Boolean(saved ? saved.study?.some(step => step.page > 0) : state.sessions?.[id]);
  const currentLabel = hasStarted ? t('Continue', 'Продолжить', 'Жалғастыру') : t('Start', 'Начать', 'Бастау');
  const title = saved ? saved.plan.title : id === 'design' ? t('Your first poster','Твой первый постер','Алғашқы постерің') : t('Everyday spreadsheets','Таблицы на каждый день','Күнделікті кестелер');
  const resumeAction = saved ? 'data-view="learning-plan"' : `data-action="${done ? 'certificate' : 'resume-course'}" data-id="${id}"`;
  return `<section class="quiet-home learning-hub" aria-labelledby="learning-hub-title">
    <header class="learning-hub-heading"><div><span>${t('Your learning path','Твой путь обучения','Сенің оқу жолың')} · ${minutes} ${t('min','мин','мин')}</span><h1 id="learning-hub-title"${saved ? ` lang="${esc(saved.plan.language)}"` : ''}>${esc(title)}</h1></div><button type="button" class="icon-button" data-view="courses" aria-label="${t('Choose a course','Выбрать курс','Курс таңдау')}">${icon('book',23)}<span class="learning-hub-course-label">${t('My courses','Мои курсы','Курстарым')}</span></button></header>
    <div class="learning-hub-progress">
      <span>${t('Course progress', 'Прогресс курса', 'Курс барысы')}</span>
      <strong>${t(`${completed} of ${steps.length} steps`, `${completed} из ${steps.length} шагов`, `${steps.length} қадамның ${completed}-і`)}</strong>
      <progress value="${completed}" max="${steps.length}" aria-label="${t('Course progress', 'Прогресс курса', 'Курс барысы')}"></progress>
    </div>
    <div class="learning-hub-journey"><ol class="learning-hub-path" aria-label="${t('Course steps','Шаги курса','Курс қадамдары')}">${steps.map((label,index) => {
      const passed = index < completed, current = index === completed;
      const final = index === steps.length - 1;
      return `<li class="${passed ? 'is-done' : current ? 'is-current' : 'is-locked'}">${final ? '' : '<span class="learning-hub-connector" aria-hidden="true"></span>'}<div class="learning-hub-stop">${current ? `<span class="learning-hub-start" aria-hidden="true">${currentLabel}</span>` : ''}<button type="button" class="learning-hub-node" ${current ? resumeAction : passed && !saved ? `data-step="${index}"` : 'disabled'} ${current ? 'aria-current="step"' : ''} aria-label="${current ? `${currentLabel} — ` : ''}${esc(label)}${passed ? ` — ${t('completed','пройдено','аяқталды')}` : current ? '' : ` — ${t('next','дальше','келесі')}`}">${icon(passed ? 'check' : current ? 'play' : final ? 'trophy' : 'book',32)}</button><span class="learning-hub-label"${saved ? ` lang="${esc(saved.plan.language)}"` : ''}>${esc(label)}</span></div></li>`;
    }).join('')}</ol><aside class="learning-hub-guide"><div class="guided-dialogue"><strong>${t('Mino', 'Мино', 'Мино')}</strong><p>${done ? t('All steps complete. Your result is ready.', 'Все шаги пройдены. Можно посмотреть результат.', 'Барлық қадам аяқталды. Нәтижең дайын.') : t('Take a break anytime. You can pick up where you left off.', 'Можно сделать паузу и продолжить с того же места.', 'Үзіліс жасап, тоқтаған жерден жалғастыра аласың.')}</p></div>${character('mino', done ? 'trophy' : saved ? 'map' : id === 'design' ? 'drawing' : 'chart', 'quiet-mentor')}</aside></div>
    <div class="learning-hub-actions"><button type="button" class="primary" ${resumeAction}>${done ? t('See my result','Мой результат','Нәтижем') : hasStarted ? t('Continue learning','Продолжить','Жалғастыру') : t('Start lesson','Начать урок','Сабақты бастау')}${icon('arrow',20)}</button><button type="button" class="text-link" data-view="courses">${t('Ready mini-courses','Готовые мини-курсы','Дайын мини-курстар')}</button></div>
  </section>`;
}
