import { escapeHtml as escape } from '../core/engine.js';
import { roadmapStageKind } from '../core/roadmap-model.js';
import { mentorForTopic } from '../core/subject-mentor.js';
import { character } from './characters.js';
import { minoWaitScreen } from './mino-wait.js';
import { icon } from './icons.js';
import { courseLanguageField, t } from './language.js';

const TITLE = {
  roadmap: () => t('My learning path', 'Мой путь обучения', 'Оқу жолым'),
  quests: () => t('Daily quests', 'Задания дня', 'Күндік тапсырмалар'),
  shop: () => t('Gem shop', 'Магазин алмазов', 'Алмас дүкені'),
};
const experienceOptions = () => [
  ['new', 'leaf', t('I’m starting from scratch', 'Начинаю с нуля', 'Нөлден бастаймын')],
  ['some', 'layers', t('I’ve tried a few things', 'Уже кое-что пробовал', 'Біраз жасап көрдім')],
  ['comfortable', 'zap', t('I can use the basics on my own', 'Уже применяю основы', 'Негіздерін өзім қолдана аламын')],
];
const motivationOptions = () => [
  ['work', 'work', t('Use it at work', 'Применить на работе', 'Жұмыста қолдану')],
  ['personal', 'edit', t('Make something for myself', 'Сделать свой проект', 'Өз жобамды жасау')],
  ['career', 'cap', t('Explore a new career', 'Попробовать новую профессию', 'Жаңа мамандықты байқап көру')],
  ['curiosity', 'spark', t('Learn out of curiosity', 'Узнать новое для себя', 'Өзім үшін жаңа нәрсе үйрену')],
];
const durationOptions = () => [
  ['5', 'clock', t('5 minutes a day', '5 минут в день', 'Күніне 5 минут')],
  ['10', 'clock', t('10 minutes a day', '10 минут в день', 'Күніне 10 минут')],
  ['20', 'clock', t('20 minutes a day', '20 минут в день', 'Күніне 20 минут')],
];

function levelName(level) {
  switch (level) {
    case 'intermediate': return t('Intermediate', 'Средний', 'Орта деңгей');
    case 'advanced': return t('Advanced', 'Продвинутый', 'Жоғары деңгей');
    default: return t('Beginner', 'Начальный', 'Бастапқы деңгей');
  }
}

function radioOptions(name, options, selected) {
  return options.map(([value, symbol, label]) => `<label class="roadmap-option">
    <input name="${name}" type="radio" value="${value}"${String(selected) === value ? ' checked' : ''} required>
    <span class="roadmap-option-content">${icon(symbol, 22)}<span>${label}</span><span class="roadmap-option-mark">${icon('check', 16)}</span></span>
  </label>`).join('');
}

function roadmapWait(busy) {
  if (busy === 'stage') return minoWaitScreen(
    t('Preparing this lesson…', 'Готовим занятие…', 'Сабақ дайындалып жатыр…'),
    t('Think of one place where you could use this skill.', 'Подумай, где тебе может пригодиться этот навык.', 'Бұл дағдыны қайда қолдана алатыныңды ойлап көр.'),
  );
  if (busy === 'clarify') return minoWaitScreen(
    t('Finding useful directions for your goal…', 'Подбираем направления под твою цель…', 'Мақсатыңа сай бағыттар дайындалып жатыр…'),
    t('Think about what you want to be able to do by the end of the course.', 'Подумай, что хочешь уметь делать к концу курса.', 'Курстың соңында не істей алғың келетінін ойлап көр.'),
  );
  return minoWaitScreen(
    t('Building your learning path…', 'Строим твой путь обучения…', 'Оқу жолың құрылып жатыр…'),
    t('Pick a regular time for your next short lesson.', 'Выбери удобное время для следующего короткого занятия.', 'Келесі қысқа сабаққа ыңғайлы уақыт таңда.'),
  );
}

function feedback(error, notice) {
  return `${error ? `<p class="roadmap-feedback has-error" role="alert">${escape(error)}</p>` : ''}
    ${notice ? `<p class="roadmap-feedback" role="status">${escape(notice)}</p>` : ''}`;
}

function wizardView(wizard, error) {
  const { step, goal, experience, evidence, motivation, minutes } = wizard;
  const compact = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 920px)').matches;
  const choosingDirection = step === 1 && !wizard.directionConfirmed;
  const prompts = [
    [t('What would you like to learn?', 'Чему хочешь научиться?', 'Не үйренгің келеді?'),
      t('Tell Mino what you want to be able to do.', 'Расскажи Мино, что хочешь уметь делать.', 'Миноға не істей алғың келетінін айт.')],
    [t('What can you already do?', 'Что ты уже умеешь?', 'Қазір не істей аласың?'),
      t('A small example helps us find your starting point.', 'Один пример поможет подобрать уровень.', 'Бір мысал бастапқы деңгейіңді анықтауға көмектеседі.')],
    [t('Where will you use this skill?', 'Где пригодится этот навык?', 'Бұл дағдыны қайда қолданасың?'),
      t('We’ll use this to pick practice for your goal.', 'Подберём практику под твою задачу.', 'Мақсатыңа сай жаттығуларды таңдаймыз.')],
    [t('How much time do you have?', 'Сколько времени в день у тебя есть?', 'Күніне қанша уақытың бар?'),
      t('We’ll plan each lesson to fit the time you choose.', 'Каждое занятие уложится в выбранное время.', 'Әр сабақ таңдаған уақытыңа сай болады.')],
  ];
  const [title, hint] = choosingDirection
    ? [wizard.clarification?.question || t('What would you like to make?', 'Какой результат хочешь получить?', 'Қандай нәтижеге қол жеткізгің келеді?'),
      wizard.originalGoal]
    : prompts[step] || prompts[0];
  const stepText = t(`Question ${step + 1} of 4`, `Вопрос ${step + 1} из 4`, `4 сұрақтың ${step + 1}-і`);
  let fields;
  if (choosingDirection) {
    fields = wizard.clarification ? `<div class="roadmap-directions">${wizard.clarification.directions.map((direction, index) => `<label class="roadmap-option">
      <input name="direction" type="radio" value="${index}"${wizard.direction === String(index) ? ' checked' : ''} required>
      <span class="roadmap-option-content">${icon('target', 22)}<span><strong>${escape(direction.title)}</strong><small>${escape(direction.goal)}</small></span><span class="roadmap-option-mark">${icon('check', 16)}</span></span>
    </label>`).join('')}${radioOptions('direction', [['custom', 'edit', t('My own result', 'Свой результат', 'Өз нәтижем')]], wizard.direction)}
      <label class="field roadmap-custom-goal"><span>${t('Your own result (if you chose it above)', 'Свой результат, если выбрал этот вариант', 'Осы нұсқаны таңдасаң, нәтижеңді жаз')}</span><input name="customGoal" maxlength="180" value="${escape(wizard.customGoal || '')}" placeholder="${t('For example, make a weekly meal budget', 'Например, рассчитать бюджет питания на неделю', 'Мысалы, апталық тамақ бюджетін есептеу')}"></label></div>` : '';
  } else if (step === 1) {
    const choices = compact ? [
      ['new', 'leaf', t('New to this', 'С нуля', 'Жаңадан')],
      ['some', 'layers', t('Some experience', 'Пробовал', 'Біраз білемін')],
      ['comfortable', 'zap', t('Know the basics', 'Знаю основы', 'Негізін білемін')],
    ] : experienceOptions();
    fields = `<div class="roadmap-experience">${radioOptions('experience', choices, experience)}</div>
      <div class="roadmap-diagnostic">
        <label class="field"><span>${t('Try a small example', 'Попробуй маленький пример', 'Шағын мысалды орындап көр')}</span>
          <span class="roadmap-diagnostic-question">${escape(wizard.diagnosticQuestion || '')}</span>
          <textarea name="diagnosticAnswer" rows="3" maxlength="600" placeholder="${t('Your answer and a short explanation', 'Твой ответ и короткое объяснение', 'Жауабың және қысқаша түсіндірме')}">${escape(wizard.diagnosticAnswer || '')}</textarea>
        </label>
        <label class="roadmap-unknown"><input name="diagnosticUnknown" type="checkbox"${wizard.diagnosticUnknown ? ' checked' : ''}><span>${t('I don’t know yet — help me start', 'Пока не знаю — помоги начать', 'Әзірге білмеймін — бастауға көмектес')}</span></label>
      </div>
      ${compact ? `<details class="roadmap-extra-context"${evidence ? ' open' : ''}><summary>${t('Add context (optional)', 'Добавить контекст (необязательно)', 'Қосымша мәлімет (міндетті емес)')}</summary>` : ''}
      <label class="field roadmap-evidence"><span>${t('What have you tried? (optional)', 'Что уже пробовал? (необязательно)', 'Не жасап көрдің? (міндетті емес)')}</span>
      <textarea name="evidence" rows="2" maxlength="360" placeholder="${t('Something you have already made or tried', 'Что уже делал или пробовал по этой теме', 'Осы тақырыпта не жасап көрдің')}">${escape(evidence)}</textarea></label>${compact ? '</details>' : ''}`;
  } else if (step === 2) {
    fields = radioOptions('motivation', motivationOptions(), motivation);
  } else if (step === 3) {
    fields = radioOptions('minutes', durationOptions(), minutes);
  } else {
    fields = `<label class="field"><span class="visually-hidden">${title}</span>
      <input name="goal" minlength="3" maxlength="180" required autocomplete="off" value="${escape(goal)}" placeholder="${t('I want to build a budget spreadsheet', 'Хочу собрать таблицу для бюджета', 'Бюджет кестесін жасауды үйренгім келеді')}"></label>${courseLanguageField(wizard.language)}`;
  }
  return `<section class="roadmap-wizard" aria-labelledby="roadmap-title">
    <div class="roadmap-wizard-progress">
      ${step > 0 ? `<button class="icon-button" type="button" data-roadmap-action="back" aria-label="${t('Back', 'Назад', 'Артқа')}">${icon('back')}</button>` : ''}
      <div><progress value="${step + 1}" max="4" aria-label="${stepText}"></progress><p>${stepText}</p></div>
    </div>
    <header class="roadmap-wizard-intro">
      ${character('mino', step === 0 ? 'listening' : 'idea', 'roadmap-guide')}
      <div><h1 id="roadmap-title" tabindex="-1">${escape(title)}</h1><p>${escape(hint)}</p></div>
    </header>
    <form id="roadmap-form">
      <fieldset aria-labelledby="roadmap-title">${fields}</fieldset>
      ${feedback(error)}
      <div class="roadmap-wizard-actions">
        <button type="button" class="text-link" data-roadmap-action="skip">${t('Later', 'Позже', 'Кейін')}</button>
        <button class="primary" type="submit">${choosingDirection && !wizard.clarification && error ? t('Try again', 'Попробовать снова', 'Қайта байқап көру') : step === 3 ? t('Build my path', 'Построить путь', 'Оқу жолын құру') : t('Continue', 'Дальше', 'Жалғастыру')} ${icon('arrow', 18)}</button>
      </div>
    </form>
  </section>`;
}

function metricValues(rewards) {
  return [
    ['flame', rewards.streak, t('Day streak', 'Дней подряд', 'Қатарынан күн'), 'quests'],
    ['gem', rewards.gems, t('Gems', 'Алмазы', 'Алмас'), 'shop'],
    ['heart', rewards.hearts, t('Lives', 'Жизни', 'Өмір'), 'shop'],
  ];
}

export function rewardBalance(rewards) {
  return rewards ? `<div class="header-rewards">${rewardMetrics(rewards, true)}</div>` : '';
}

export function rewardMetrics(rewards, compact = false) {
  if (!rewards) return '';
  const phone = compact && typeof window !== 'undefined' && window.matchMedia('(max-width: 920px)').matches;
  return `<div class="roadmap-metrics${compact ? ' is-compact' : ''}">${metricValues(rewards).map(([symbol, value, label, view]) => {
    const displayed = phone ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : value;
    return `<button type="button" class="roadmap-metric roadmap-${symbol}" data-view="${view}" aria-label="${label} ${value}" title="${label} · ${value}">
      ${icon(symbol, compact ? 22 : 30)}
      <strong>${displayed}</strong>${compact ? '' : `<span aria-hidden="true">${label}</span>`}
    </button>`;
  }).join('')}</div>`;
}

function questDefinition(id) {
  if (id === 'finish-lesson') return ['flag', t('Finish a lesson today', 'Заверши занятие сегодня', 'Бүгін бір сабақты аяқта')];
  return ['target', t('Answer two exercises correctly', 'Реши два упражнения верно', 'Екі жаттығуды дұрыс орында')];
}

export function questRow(quest, { compact = false } = {}) {
  const [symbol, title] = questDefinition(quest.id);
  if (compact) {
    const done = quest.progress >= quest.target;
    const compactTitle = quest.id === 'correct-check'
      ? t('Get 2 exercises right', 'Реши 2 упражнения верно', '2 жаттығуды дұрыс орында')
      : title;
    const claim = t(`Claim ${quest.reward} gems`, `Забрать алмазы: +${quest.reward}`, `Алмаз алу: +${quest.reward}`);
    return `<li class="study-quest-row${done ? ' is-finished' : ''}">
      <span class="study-quest-marker" aria-hidden="true">${done ? icon('check', 19) : ''}</span>
      <div class="study-quest-copy">
        <h3>${compactTitle}</h3>
        <div class="study-quest-progress"><span>${quest.progress} / ${quest.target}</span><progress value="${quest.progress}" max="${quest.target}" aria-label="${compactTitle}"></progress></div>
      </div>
      ${quest.claimable ? `<button type="button" class="icon-button study-quest-gift" data-roadmap-claim="${escape(quest.id)}" aria-label="${claim}" title="${claim}">${icon('gift', 23)}</button>`
        : quest.claimed ? `<span class="visually-hidden">${t('Reward claimed', 'Награда получена', 'Марапат алынды')}</span>` : ''}
    </li>`;
  }
  return `<div class="roadmap-quest">
    <span class="roadmap-symbol">${icon(symbol, 22)}</span>
    <div><h3>${title}</h3><progress value="${quest.progress}" max="${quest.target}" aria-label="${title}"></progress>
      <small>${quest.progress} / ${quest.target} <span class="roadmap-gem">${icon('gem', 15)} +${quest.reward}</span></small>
    </div>
    ${quest.claimed ? `<span class="roadmap-complete-label">${icon('check', 17)} ${t('Claimed', 'Получено', 'Алдың')}</span>` : quest.claimable
      ? `<button type="button" class="primary" data-roadmap-claim="${escape(quest.id)}">${icon('check', 16)} ${t('Claim', 'Забрать', 'Алу')}</button>`
      : ''}
  </div>`;
}

function stageRows(roadmap, active, busy) {
  const statusLabels = {
    completed: t('View result', 'Результат', 'Нәтиже'),
    active: t('Continue lesson', 'Продолжить', 'Жалғастыру'),
    ready: t('Start lesson', 'Начать', 'Бастау'),
    available: t('Open lesson', 'Открыть урок', 'Сабақты ашу'),
  };
  const milestones = new Map(roadmap.curriculumVersion === 2
    ? roadmap.modules.map((module, index) => [module.startIndex, { ...module, index }]) : []);
  const kindLabels = {
    lesson: t('Lesson', 'Урок', 'Сабақ'),
    practice: t('Practice', 'Практика', 'Жаттығу'),
    review: t('Review', 'Повторение', 'Қайталау'),
    'mini-project': t('Mini-project', 'Мини-проект', 'Шағын жоба'),
  };
  return roadmap.stages.map((stage, index) => {
    const status = active[index]?.status || (index === 0 ? 'ready' : 'available');
    const current = status === 'ready' || status === 'active';
    const milestone = milestones.get(index);
    const milestoneComplete = milestone && active.slice(index, index + milestone.count).filter(item => item.status === 'completed').length === milestone.count;
    const milestoneCurrent = milestone && active.slice(index, index + milestone.count).some(item => item.status === 'ready' || item.status === 'active');
    const titleTag = roadmap.curriculumVersion === 2 ? 'h3' : 'h2';
    const kind = roadmapStageKind(stage);
    const symbol = { lesson: 'book', practice: 'edit', review: 'target', 'mini-project': index === roadmap.stages.length - 1 ? 'trophy' : 'work' }[kind];
    const statusSymbol = status === 'completed' ? 'check' : 'play';
    return `<li class="roadmap-stage kind-${kind} is-${status}${milestone ? ' has-milestone' : ''}${milestones.has(index + 1) ? ' before-milestone' : ''}" data-roadmap-kind="${kind}"${current ? ' aria-current="step"' : ''}>
      ${milestone ? `<header class="roadmap-milestone${milestoneComplete ? ' is-completed' : milestoneCurrent ? ' is-current' : ''}" data-roadmap-milestone="${milestone.index}"><span class="roadmap-milestone-label">${milestoneComplete ? icon('check', 13) : icon('flag', 13)} ${t(`Milestone ${milestone.index + 1}`, `Цель ${milestone.index + 1}`, `${milestone.index + 1}-мақсат`)}</span><h2>${escape(milestone.title)}</h2><p class="visually-hidden">${escape(milestone.outcome)}</p></header>` : ''}
      ${index < roadmap.stages.length - 1 ? `<svg class="roadmap-stage-connector" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${index % 2 ? 'M75 0 H38 Q25 0 25 18 V100' : 'M25 0 H62 Q75 0 75 18 V100'}"/></svg>` : ''}
      <div class="roadmap-stage-stop">
        ${current ? `<span class="roadmap-start-bubble" aria-hidden="true">${status === 'active' ? t('Continue', 'Продолжить', 'Жалғастыру') : t('Start here', 'Начать', 'Бастау')}</span>` : ''}
        <button type="button" class="roadmap-stage-marker roadmap-stage-node" data-roadmap-action="start" data-roadmap-stage="${index}" aria-label="${escape(`${kindLabels[kind]}. ${statusLabels[status]}: ${stage.title}`)}" aria-describedby="roadmap-stage-detail-${index}"${busy ? ' disabled' : ''}><span class="roadmap-stage-kind-icon" aria-hidden="true">${icon(symbol, 34)}</span>${status === 'available' ? '' : `<span class="roadmap-stage-status" aria-hidden="true">${icon(statusSymbol, 14)}</span>`}</button>
        <div class="roadmap-stage-text"><span class="roadmap-stage-kind-label">${kindLabels[kind]}</span><${titleTag}>${escape(stage.title)}</${titleTag}><p class="${current ? 'roadmap-stage-objective' : 'visually-hidden'}" id="roadmap-stage-detail-${index}">${escape(stage.objective)}</p></div>
      </div>
    </li>`;
  }).join('');
}

function syllabusSources(roadmap) {
  if (roadmap.curriculumVersion !== 2) return '';
  if (roadmap.sourceStatus !== 'verified') return `<p class="roadmap-source-notice">${t('Course sources could not be confirmed yet. This outline is provisional; lesson materials are checked when each lesson is prepared.', 'Источники программы пока не удалось подтвердить. Это предварительный план; материалы проверяются при подготовке каждого занятия.', 'Курс көздері әзірге расталмады. Бұл алдын ала жоспар; әр сабақ дайындалғанда материалдар тексеріледі.')}</p>`;
  return `<section class="roadmap-sources"><h3>${t('Sources behind this course', 'Источники программы', 'Курс бағдарламасының көздері')}</h3><ul>${roadmap.sources.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)} ${icon('arrow', 14)}</a></li>`).join('')}</ul></section>`;
}

function syllabusView(roadmap, active, busy) {
  return `<ol class="roadmap-stages${roadmap.curriculumVersion === 2 ? ' roadmap-continuous' : ''}" aria-label="${t('Lessons in order', 'Порядок занятий', 'Сабақтар реті')}">${stageRows(roadmap, active, busy)}</ol>`;
}

export function roadmapView({ roadmap, wizard, active = [], busy = false, error = '', notice = '', rewards, quests = rewards?.quests ?? [] } = {}) {
  if (wizard) return busy ? roadmapWait(busy) : wizardView(wizard, error);
  if (!roadmap) return `<section class="roadmap-empty" aria-labelledby="roadmap-title">
    ${character('mino', 'map', 'roadmap-guide')}
    <h1 id="roadmap-title">${TITLE.roadmap()}</h1>
    <p>${t('Tell me your goal. I’ll help you practise it in 5, 10 or 20 minutes at a time.', 'Расскажи о своей цели. Будем практиковаться короткими уроками по 5, 10 или 20 минут.', 'Мақсатыңды айт. Оған жету үшін 5, 10 немесе 20 минуттық сабақтармен жаттығамыз.')}</p>
    ${feedback(error, notice)}
    <button type="button" class="primary" data-roadmap-action="setup">${t('Set my goal', 'Выбрать цель', 'Мақсат таңдау')} ${icon('arrow', 18)}</button>
  </section>`;
  const finished = active.filter(stage => stage.status === 'completed').length;
  const all = roadmap.stages.length;
  const progressLabel = t(`${finished} of ${all} lessons done`, `Пройдено ${finished} из ${all} занятий`, `${all} сабақтың ${finished}-і аяқталды`);
  const complete = all > 0 && finished === all;
  const resumeIndex = active.findIndex(stage => stage.status === 'ready' || stage.status === 'active');
  const resumeStage = roadmap.stages[resumeIndex];
  const resumeLabel = active[resumeIndex]?.status === 'active'
    ? t('Continue lesson', 'Продолжить занятие', 'Сабақты жалғастыру')
    : t('Start lesson', 'Начать занятие', 'Сабақты бастау');
  return `${busy ? roadmapWait(busy) : ''}
  <section class="roadmap-layout" aria-labelledby="roadmap-title"${busy ? ' inert' : ''}>
    <div class="roadmap-main-column">
      <header class="roadmap-heading">
        <div><h1 id="roadmap-title" tabindex="-1" lang="${escape(roadmap.language)}">${escape(roadmap.title)}</h1></div>
        <div class="roadmap-heading-progress"><span aria-hidden="true">${finished}/${all}</span><progress value="${finished}" max="${Math.max(1, all)}" aria-label="${progressLabel}"></progress></div>
      </header>
      <div class="roadmap-intro">
        ${character(mentorForTopic(`${roadmap.originalGoal || ''} ${roadmap.goal} ${roadmap.title}`), busy ? 'thinking' : complete ? 'celebrate' : 'explaining', 'roadmap-guide')}
        ${resumeStage && roadmap.curriculumVersion === 2 ? `<div class="roadmap-resume"><span lang="${escape(roadmap.language)}">${escape(resumeStage.title)}</span><button type="button" class="primary" data-roadmap-action="start" data-roadmap-stage="${resumeIndex}" aria-label="${escape(`${resumeLabel}: ${resumeStage.title}`)}"${busy ? ' disabled' : ''}>${icon('play', 17)} ${resumeLabel}</button></div>` : ''}
      </div>
      <details class="roadmap-about"><summary>${icon('book', 17)} ${t('Course details', 'О курсе', 'Курс туралы')}</summary><div><p lang="${escape(roadmap.language)}">${escape(roadmap.outcome)}</p><p>${levelName(roadmap.level)} · ${roadmap.minutes} ${t('min per lesson','мин на занятие','мин / сабақ')}</p>${syllabusSources(roadmap)}</div></details>
      ${feedback(error, notice)}
      ${syllabusView(roadmap, active, busy)}
      <button type="button" class="text-link roadmap-new-goal" data-roadmap-action="setup">${icon('plus', 17)} ${t('Set another goal', 'Выбрать другую цель', 'Басқа мақсат таңдау')}</button>
    </div>
    ${rewards ? `<aside class="roadmap-aside">
      <details class="roadmap-extra"><summary>${icon('gem', 18)} ${t('Activity & rewards', 'Активность и награды', 'Белсенділік пен марапаттар')}</summary><div class="roadmap-extra-content">${rewardMetrics(rewards)}
      <section class="roadmap-side-quests"><h2>${TITLE.quests()}</h2>${quests.slice(0, 1).map(questRow).join('')}
        <button type="button" class="text-link" data-view="quests">${t('All quests', 'Все задания', 'Барлық тапсырма')} ${icon('arrow', 16)}</button>
      </section>
      <button type="button" class="text-link" data-view="shop">${icon('store', 17)} ${TITLE.shop()}</button></div></details>
    </aside>` : ''}
  </section>`;
}

function shopDefinition(id) {
  if (id === 'hearts') return ['heart', t('Refill lives', 'Восстановить жизни', 'Өмірді қалпына келтіру'), t('Restore all five lives now. One life returns each hour.', 'Верни все пять жизней сразу. Одна жизнь восстанавливается каждый час.', 'Бес өмірді бірден қалпына келтір. Сағат сайын бір өмір қайтады.')];
  return ['shield', t('Streak freeze', 'Заморозка серии', 'Серияны қатыру'), t('Protect your streak for one missed day. You can keep one freeze.', 'Защищает серию за один пропущенный день. Можно хранить одну заморозку.', 'Бір күн өткізіп алсаң, серияң сақталады. Бір қатыруды сақтай аласың.')];
}

function shopRow(item, rewards) {
  const [symbol, title, detail] = shopDefinition(item.id);
  const unavailable = item.id === 'hearts' && rewards.hearts >= rewards.maxHearts
    ? t('Lives are full', 'Жизни полные', 'Өмір толы')
    : item.id === 'freeze' && rewards.freezes > 0
      ? t('Already owned', 'Уже есть', 'Бар')
      : t('Not enough gems', 'Не хватает алмазов', 'Алмас жеткіліксіз');
  return `<article class="roadmap-shop-item">
    <span class="roadmap-symbol roadmap-${symbol}">${icon(symbol, 27)}</span>
    <div><h2>${title}</h2><p>${detail}</p></div>
    <button type="button" class="secondary reward-cost" data-roadmap-buy="${escape(item.id)}"${item.available ? '' : ' disabled'} aria-label="${item.available ? t(`Buy ${title} for ${item.cost} gems`, `Купить «${title}» за ${item.cost} алмазов`, `${title} үшін ${item.cost} алмас төлеу`) : unavailable}">${icon('gem', 18)} ${item.cost}</button>
    ${item.available ? '' : `<small>${unavailable}</small>`}
  </article>`;
}

export function rewardsView(section, { rewards, quests = rewards?.quests ?? [], items = rewards?.items ?? [], error = '', notice = '' } = {}) {
  if (section === 'profile') {
    if (!rewards) return '';
    return `<section class="roadmap-profile" aria-label="${t('Learning activity', 'Учебная активность', 'Оқу белсенділігі')}">
      ${rewardMetrics(rewards)}
      <dl class="roadmap-profile-stats">
        <div><dt>${t('Lessons finished', 'Занятий пройдено', 'Аяқталған сабақтар')}</dt><dd>${rewards.lessons}</dd></div>
        <div><dt>${t('Correct exercises today', 'Верных упражнений сегодня', 'Бүгінгі дұрыс жаттығулар')}</dt><dd>${rewards.correct}</dd></div>
        <div><dt>${t('Streak freezes', 'Заморозки серии', 'Серия қатырулары')}</dt><dd>${rewards.freezes}</dd></div>
      </dl>
      <div class="roadmap-profile-links"><button type="button" class="text-link" data-view="roadmap">${icon('path', 18)} ${TITLE.roadmap()}</button>
        <button type="button" class="text-link" data-view="quests">${icon('flag', 18)} ${TITLE.quests()}</button>
        <button type="button" class="text-link" data-view="shop">${icon('store', 18)} ${TITLE.shop()}</button></div>
    </section>`;
  }
  const heading = t('Rewards', 'Награды', 'Марапаттар');
  const rewardTabs = `<nav class="reward-tabs" aria-label="${heading}">${[
    ['quests', 'flag', TITLE.quests()], ['shop', 'store', TITLE.shop()],
  ].map(([view, symbol, label]) => `<button type="button" data-view="${view}"${section === view ? ' aria-current="page"' : ''}>${icon(symbol, 19)}<span>${label}</span></button>`).join('')}</nav>`;
  if (!rewards) return `<section class="roadmap-empty"><h1>${heading}</h1><p>${t('Sign in to keep your activity and rewards.', 'Войди, чтобы сохранять прогресс и награды.', 'Барысың мен марапаттарыңды сақтау үшін кір.')}</p><button type="button" class="primary" data-account-open="signin">${t('Sign in', 'Войти', 'Кіру')}</button></section>`;
  return `<section class="roadmap-rewards" aria-labelledby="roadmap-rewards-title">
    <header class="roadmap-rewards-heading"><div><h1 id="roadmap-rewards-title">${heading}</h1><p>${section === 'shop'
      ? t('Earn gems in lessons and quests, then use them here.', 'Зарабатывай алмазы в занятиях и заданиях и трать их здесь.', 'Сабақтар мен тапсырмалардан алмас жинап, осында жұмса.')
      : t('Complete these while you study to earn extra gems.', 'Выполняй задания во время учёбы и получай алмазы.', 'Оқу кезінде тапсырмаларды орындап, алмас ал.')}</p></div>
      <span class="rewards-emblem" aria-hidden="true">${icon('gift', 34)}</span>
    </header>
    ${rewardMetrics(rewards)}
    ${rewardTabs}
    ${feedback(error, notice)}
    <div class="roadmap-rewards-list">${section === 'shop' ? items.map(item => shopRow(item, rewards)).join('') : quests.map(questRow).join('')}</div>
    <button type="button" class="text-link" data-view="roadmap">${icon('back', 17)} ${t('Back to my path', 'Вернуться к пути', 'Оқу жолына қайту')}</button>
  </section>`;
}
