import { COURSES, escapeHtml as esc } from '../core/engine.js';
import { posterSvg } from '../core/poster.js';
import { courseNames, lessonNames, pageBanner } from './dashboard.js';
import { icon } from './icons.js';
import { character } from './characters.js';
import { uiText, quizCopy } from './lesson-copy.js';
import { budgetSession } from '../core/budget-session.js';
import { budgetBalanceField, budgetSessionPanel } from './budget-session.js';
import { t, currentLanguage } from './language.js';

// Keep this screen's styles inside the UI layer, without changing the app entrypoint.
if (typeof document !== 'undefined' && !document.getElementById('mindora-lesson-styles')) {
  const stylesheet = document.createElement('link');
  stylesheet.id = 'mindora-lesson-styles';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./lessons.css', import.meta.url).href;
  document.head.append(stylesheet);
}
if (typeof document !== 'undefined' && !document.getElementById('mindora-course-path-styles')) {
  const stylesheet = document.createElement('link');
  stylesheet.id = 'mindora-course-path-styles';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./course-path.css', import.meta.url).href;
  document.head.append(stylesheet);
}

const guide = id => id === 'design' ? 'mia' : 'sam';
const categories = {
  get design() { return t('Design','Дизайн','Дизайн'); },
  get budget() { return t('Spreadsheets','Таблицы','Кестелер'); },
};
const outcomes = {
  get design() { return t('Make a poster you can download and share.','Сделай постер, который можно скачать.','Жүктеп алуға болатын постер жаса.'); },
  get budget() { return t('Build a simple expense tracker.','Собери простую таблицу расходов.','Қарапайым шығындар кестесін құрастыр.'); },
};
const stepType = index => [
  t('Learn','Теория','Түсіндірме'), t('Quick check','Проверка знаний','Білімді тексеру'),
  t('Try it','Практика','Жаттығу'), t('Make it yours','Самостоятельная работа','Өздік жұмыс'),
][index];

function buddy(id, message, mood = 'explaining') {
  return `<div class="lesson-buddy">${character(guide(id), mood, 'lesson-character')}<div class="buddy-bubble"><span class="buddy-name">${id === 'design' ? t("Mia · your design buddy", "Миа · наставник по дизайну", "Миа · дизайн тәлімгерің") : t("Sam · your numbers buddy", "Сэм · наставник по таблицам", "Сэм · кестелер тәлімгерің")}</span><p>${message}</p></div></div>`;
}

function emptyView(title, text, button = t("Find my first course", "Найти курс", "Курс табу")) {
  return `<div class="empty-state">${character('mino', 'welcome', 'empty-character')}<h2>${title}</h2><p>${text}</p><button class="primary large" data-view="discover">${button}${icon('arrow', 18)}</button></div>`;
}

export function pathView(state) {
  const id = state.active, c = COURSES[id];
  if (!c) return emptyView(t("A little curiosity goes a long way", "Начнём с твоей цели", "Мақсатыңнан бастайық"), t("Tell Mino what you want to learn. We’ll start with one small step.", "Расскажи Мино, чему хочешь научиться.", "Миноға не үйренгің келетінін айт."));
  const p = Math.max(0, Math.min(4, Math.trunc(Number(state.progress[id]) || 0)));
  return `<div class="learning-path course-path"><button type="button" class="back-button" data-view="courses">${icon('back', 18)} ${t("My courses", "Мои курсы", "Курстарым")}</button>
    <header class="course-path-header"><div><span class="course-path-category">${categories[id]} <span>· with ${id === 'design' ? 'Mia' : 'Sam'}</span></span><h1>${courseNames[id]}</h1><p>${outcomes[id]}</p></div>${character(guide(id), p === 4 ? 'celebrate' : 'welcome', 'course-path-mentor')}</header>
    ${id === 'budget' ? budgetSessionPanel(state.minutes) : ''}
    <div class="course-path-progress"><span>${p === 4 ? t("All steps complete", "Все этапы завершены", "Барлық кезеңдер аяқталды") : t(`${p} of 4 steps complete`, `Пройдено ${p} из 4 этапов`, `4 кезеңнің ${p} аяқталды`)}</span><strong>${p * 25}%</strong><div role="progressbar" aria-label="${t("Course progress", "Прогресс курса", "Курс барысы")}" aria-valuenow="${p * 25}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${t(`${p} of 4 steps complete`, `Пройдено ${p} из 4 этапов`, `4 кезеңнің ${p} аяқталды`)}"><i style="width:${p * 25}%"></i></div></div>
    <ol class="course-path-route" aria-label="${t("Your learning path", "Твой маршрут обучения", "Оқу жолың")}">${c.steps.map((s, i) => {
      const done = i < p, current = i === p, locked = i > p, right = i % 2 === 1;
      const title = lessonNames[id][i], status = done ? t("Completed", "Завершён", "Аяқталды") : current ? t("Up next", "Следующий этап", "Келесі кезең") : t("Locked", "Закрыто", "Құлыптаулы");
      return `<li class="course-path-stop ${right ? 'on-right' : 'on-left'} ${done ? 'is-done' : current ? 'is-current' : 'is-locked'}">
        ${i < 3 ? `<svg class="course-path-connector ${i < p ? 'is-complete' : ''}" viewBox="0 0 100 148" preserveAspectRatio="none" aria-hidden="true"><path d="${right ? 'M80 0 C80 74 20 74 20 148' : 'M20 0 C20 74 80 74 80 148'}"/></svg>` : ''}
        <div class="course-path-node-wrap"><button type="button" class="course-path-node" data-step="${i}" ${locked ? 'disabled' : ''} ${current ? 'aria-current="step"' : ''} aria-label="${esc(`${done ? t("Revisit", "Повторить", "Қайталау") : locked ? t("Locked", "Закрыто", "Құлыптаулы") : t("Continue", "Продолжить", "Жалғастыру")}: ${title}`)}" aria-describedby="course-path-label-${i}">${icon(done ? 'check' : locked ? 'lock' : ['book', 'spark', 'edit', 'trophy'][i], 30)}</button>${current ? `<span class="course-path-here" aria-hidden="true">${t("You are here", "Ты здесь", "Сен осындасың")}</span>` : ''}</div>
        <div class="course-path-label" id="course-path-label-${i}"><span>${i + 1} · ${stepType(i)}</span><h2>${esc(title)}</h2><p>${status}</p></div></li>`;
    }).join('')}</ol>
    <section class="course-path-certificate ${p === 4 ? 'is-ready' : ''}" aria-labelledby="course-path-certificate-title"><span class="course-path-certificate-icon" aria-hidden="true">${icon('cap', 34)}<span>${icon(p === 4 ? 'check' : 'lock', 14)}</span></span><div><h2 id="course-path-certificate-title">${t("Your course certificate", "Сертификат курса", "Курс сертификаты")}</h2><p>${p === 4 ? t("You earned it. Make it yours.", "Ты заслужил сертификат. Получи его.", "Сен сертификатқа лайықсың. Оны ал.") : t("Complete all 4 steps to unlock it.", "Пройди все 4 этапа, чтобы получить его.", "Оны алу үшін барлық 4 кезеңді аяқта.")}</p>${p === 4 ? `<button type="button" class="course-path-certificate-action" data-action="certificate" data-id="${id}">${t("View certificate", "Открыть сертификат", "Сертификатты ашу")} ${icon('arrow', 17)}</button>` : ''}</div></section>
    <details class="learning-sources course-path-sources"><summary>${t("About this course & sources", "О курсе и материалы", "Курс туралы және материалдар")}</summary>${state.goals[id] ? `<p><strong>${t("Your goal:", "Твоя цель:", "Мақсатың:")}</strong> ${esc(uiText(state.goals[id]))}</p>` : ''}<p>${outcomes[id]} ${t("Take it one short step at a time.", "Двигайся шаг за шагом.", "Біртіндеп жалғастыр.")}</p>${c.sources.map(s => `<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(uiText(s.title))} ↗</a>`).join('')}${p >= 2 ? `<button type="button" class="text-link path-extra" data-action="mix">${icon('shuffle', 17)} ${t("Try a fresh challenge", "Новое задание", "Жаңа тапсырма")}</button>` : ''}</details>
    <div class="course-path-actions"><button type="button" class="primary" data-action="resume-course" data-id="${id}">${p === 4 ? t("Revisit course", "Повторить курс", "Курсты қайталау") : t("Continue learning", "Продолжить обучение", "Оқуды жалғастыру")} ${icon('arrow', 19)}</button></div></div>`;
}

export function lesson(state, { step, question, questionCount, quizIndex, quizChoice, quizFeedback, draft, checks }) {
  const id = state.active, c = COURSES[id];
  if (!c) return emptyView(t("Let’s find your first course", "Найдём твой первый курс", "Алғашқы курсыңды табайық"), t("Start with something you would love to make.", "Начни с того, что хочешь сделать.", "Жасағың келетін нәрседен баста."));
  const progress = Math.round((step + (step === 1 ? quizIndex / questionCount : 0)) / 4 * 100);
  return `<div class="lesson-flow lesson-step-${step}"><header class="lesson-progress-head"><button class="lesson-exit" data-view="path" aria-label="${t("Save and return to my course", "Сохранить и вернуться к курсу", "Сақтап, курсқа оралу")}">${icon('back', 23)}</button><div class="progress-bar" role="progressbar" aria-label="${t("Course progress", "Прогресс курса", "Курс барысы")}" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><span>${stepType(step)}</span></header>
    ${step >= 2 ? `<div class="lesson-titleblock"><span class="eyebrow">${categories[id]} · with ${id === 'design' ? 'Mia' : 'Sam'}</span><h1>${lessonNames[id][step]}</h1></div>` : ''}
    ${step === 0 ? learnContent(id, questionCount) : step === 1 ? quizContent(id, question, quizIndex, questionCount, quizChoice, quizFeedback) : practiceContent(id, draft, step === 3, checks, state.minutes)}</div>`;
}

function learnContent(id, questionCount) {
  const design = id === 'design';
  const principles = design ? [
    [t("One big idea", "Одна главная мысль", "Бір негізгі ой"), t("Make the headline larger than everything else. It tells people where to look first.", "Сделай заголовок крупнее остального текста, чтобы сразу привлечь внимание.", "Назарды бірден аудару үшін тақырыпты басқа мәтіннен ірі қылып жаз.")],
    [t("Easy on the eyes", "Читаемый текст", "Оқуға ыңғайлы мәтін"), t("Dark words on a light background are a good place to start.", "Начни с тёмного текста на светлом фоне.", "Ашық фонда қою мәтін қолданып көр.")],
    [t("One next step", "Одно действие", "Бір әрекет"), t("Tell people what to do, where to go, or when to visit.", "Подскажи читателю, что сделать, куда пойти или когда прийти.", "Оқырманға не істеу, қайда бару немесе қашан келу керегін айт.")]
  ] : [
    [t("Every cell has an address", "У каждой ячейки есть адрес", "Әр ұяшықтың мекенжайы бар"), t("A letter tells you the column. A number tells you the row. B2 means column B, row 2.", "Буква обозначает столбец, число — строку. B2 находится во втором ряду столбца B.", "Әріп бағанды, сан жолды көрсетеді. B2 — B бағанындағы 2-жол.")],
    [t("A range is a group of cells", "Диапазон — это группа ячеек", "Ауқым — ұяшықтар тобы"), t("B2:B4 means B2, B3 and B4. The colon means “through”.", "B2:B4 включает ячейки B2, B3 и B4.", "B2:B4 ауқымына B2, B3 және B4 ұяшықтары кіреді.")],
    [t("SUM does the adding", "Формула SUM складывает", "SUM формуласы қосады"), t("Type =SUM(B2:B4) to add those three cells. Change a number and the total changes too.", "Введи =SUM(B2:B4), чтобы сложить три ячейки. При изменении числа сумма пересчитается.", "Үш ұяшықтың мәнін қосу үшін =SUM(B2:B4) деп жаз. Сан өзгерсе, сома қайта есептеледі.")]
  ];
  const tips = design ? [t("Start with one message. Make it the biggest text.", "Выдели главную мысль самым крупным текстом.", "Негізгі ойды ең ірі мәтінмен көрсет."), t("Choose colours that make the words easy to see.", "Выбери цвета, с которыми текст легко прочитать.", "Мәтін оңай оқылатын түстерді таңда."), t("Tell people exactly what to do next.", "Скажи читателю, что сделать дальше.", "Оқырманға келесі әрекетті айт.")] : [t("Find the column first, then the row.", "Сначала найди столбец, потом строку.", "Алдымен бағанды, содан кейін жолды тап."), t("A range includes both the first and last cell.", "Диапазон включает первую и последнюю ячейки.", "Ауқымға бірінші және соңғы ұяшықтар кіреді."), t("Every formula starts with an equals sign.", "Каждая формула начинается со знака равенства.", "Әр формула теңдік белгісінен басталады.")];
  const mentors = design ? ['mia', 'artist', 'copywriter'] : ['sam', 'sam', 'sam'];
  return `<div class="learn-deck" data-learn-deck="${id}"><div class="idea-count"><span data-learn-count>${t("Idea 1 of 3", "Идея 1 из 3", "3 ойдың 1-сі")}</span><span class="idea-dots" aria-hidden="true">${principles.map((_, i) => `<i data-learn-dot class="${i === 0 ? 'on' : ''}"></i>`).join('')}</span></div>
    ${principles.map(([title, text], i) => `<section class="learn-page" data-learn-page ${i ? 'hidden' : ''}><h1 tabindex="-1">${title}</h1><p class="idea-description">${text}</p><div class="lesson-scene ${design ? 'scene-design' : 'scene-sheet'}"><div class="scene-mentor">${character(mentors[i], i === 2 ? 'celebrate' : 'explaining', 'teaching-character')}</div><div class="scene-example">${design ? posterExample(i) : spreadsheetExample(i)}</div></div><aside class="key-idea">${icon('spark', 23)}<div><strong>${t("Remember this", "Запомни", "Есте сақта")}</strong><p>${tips[i]}</p></div></aside></section>`).join('')}
    <div class="lesson-actionbar learn-actions"><button class="lesson-prev" data-learn-prev hidden aria-label="${t("Previous idea", "Предыдущая идея", "Алдыңғы ой")}">${icon('back', 20)}</button><button class="primary" data-learn-next>${t("Continue", "Продолжить", "Жалғастыру")} ${icon('arrow', 19)}</button><button class="primary" data-action="finish-learn" hidden>${t("Let’s try it", "Попробовать", "Байқап көру")} ${icon('arrow', 19)}</button><p class="small-note">${t(`Next: ${questionCount} ${questionCount === 1 ? 'question' : 'questions'}.`, `Вопросов в тесте: ${questionCount}.`, `Тесттегі сұрақ саны: ${questionCount}.`)}</p></div></div>`;
}

function posterExample(index) {
  if (index === 1) return `<figure class="contrast-example"><div class="contrast-sample gentle"><span>${t("A little coffee.", "Чашка кофе.", "Бір кесе кофе.")}</span><small>${t("Harder to read", "Сложнее прочитать", "Оқу қиынырақ")}</small></div><div class="contrast-sample clear"><span>${t("A little coffee.", "Чашка кофе.", "Бір кесе кофе.")}</span><small>${icon('check', 16)} ${t("Easy to read", "Легко прочитать", "Оқу оңай")}</small></div><figcaption>${t("Same words. A clearer colour.", "Те же слова. Более читаемый цвет.", "Сол сөздер. Анығырақ түс.")}</figcaption></figure>`;
  return `<figure class="poster-example"><div class="mini-poster"><span class="poster-label">${t("YOUR NEIGHBOURHOOD CAFÉ", "КАФЕ ПО СОСЕДСТВУ", "КӨРШІ КАФЕ")}</span><span class="coffee-doodle" aria-hidden="true">${icon('spark', 36)}</span><h2 class="${index === 0 ? 'idea-highlight' : ''}">${t("A little coffee.", "Чашка кофе.", "Бір кесе кофе.")}<br>${t("A lovely day.", "Прекрасный день.", "Тамаша күн.")}</h2><p>${t("Fresh coffee. Good company.", "Свежий кофе. Хорошая компания.", "Балғын кофе. Жақсы орта.")}</p><span class="sample-cta ${index === 2 ? 'idea-highlight' : ''}">${t("Visit Saturday · 10 am–4 pm", "Приходи в субботу · 10:00–16:00", "Сенбі күні кел · 10:00–16:00")}</span></div><figcaption>${index === 0 ? t("Your headline is the first thing people notice.", "Первым читатель замечает заголовок.", "Оқырман алдымен тақырыпты байқайды.") : t("A day, a time, and a reason to visit.", "День, время и повод прийти.", "Күн, уақыт және келуге себеп.")}</figcaption></figure>`;
}

function spreadsheetExample(index) {
  return `<figure class="cell-example cell-example-${index}"><div class="cell-demo"><table><caption class="sr-only">${index === 0 ? t("B2 is the highlighted cell.", "Выделена ячейка B2.", "B2 ұяшығы белгіленген.") : t("Cells B2 through B4 are highlighted.", "Выделены ячейки B2–B4.", "B2–B4 ұяшықтары белгіленген.")}</caption><thead><tr><th></th><th scope="col">A</th><th scope="col" class="column-b">B</th></tr></thead><tbody><tr><th scope="row">1</th><td>${t("Expense", "Расход", "Шығын")}</td><td>${t("Amount", "Сумма", "Сома")}</td></tr>${[48, 125, 24].map((n, i) => `<tr><th scope="row" class="${i === 0 ? 'row-two' : ''}">${i + 2}</th><td>${[t("Transport", "Транспорт", "Көлік"), t("Groceries", "Продукты", "Азық-түлік"), t("Subscriptions", "Подписки", "Жазылымдар")][i]}</td><td class="${i === 0 || index > 0 ? 'selected-cell' : ''}"><strong>${n}</strong>${index === 0 && i === 0 ? '<span class="cell-address">B2</span>' : ''}</td></tr>`).join('')}</tbody></table>${index === 2 ? '<div class="sum-result"><code>=SUM(B2:B4)</code><strong>197</strong></div>' : ''}</div><figcaption>${index === 0 ? t("Column B · Row 2 → B2", "Столбец B · Строка 2 → B2", "B бағаны · 2-жол → B2") : index === 1 ? t("<code>B2:B4</code> means B2, B3 and B4", "<code>B2:B4</code> — это B2, B3 и B4", "<code>B2:B4</code> — B2, B3 және B4") : t("48 + 125 + 24 = 197. Done!", "48 + 125 + 24 = 197. Готово!", "48 + 125 + 24 = 197. Дайын!")}</figcaption></figure>`;
}

function quizContent(id, original, quizIndex, questionCount, quizChoice, quizFeedback) {
  const q = quizCopy(original), correct = quizChoice === original.correctIndex;
  const answered = quizFeedback && correct;
  return `${buddy(id, quizFeedback ? correct ? t("That’s right!", "Верно!", "Дұрыс!") : t("Look at the explanation and try again.", "Посмотри объяснение и попробуй снова.", "Түсіндірмені оқып, қайталап көр.") : t("Take your time. You can try again.", "Не спеши. Ответ можно изменить.", "Асықпа. Жауабыңды өзгерте аласың."), quizFeedback ? correct ? 'celebrate' : 'explaining' : 'thinking')}
    <section class="mini-quiz"><div class="quiz-count"><span>${t(`Question ${quizIndex + 1} of ${questionCount}`, `Вопрос ${quizIndex + 1} из ${questionCount}`, `${questionCount} сұрақтың ${quizIndex + 1}-сі`)}</span><div class="quiz-dots" aria-hidden="true">${Array.from({ length: questionCount }, (_, i) => `<i class="${i <= quizIndex ? 'on' : ''}"></i>`).join('')}</div></div><h1>${esc(q.question)}</h1><div class="quiz-options">${q.choices.map((text, i) => `<button class="quiz-option ${quizChoice === i ? 'selected' : ''} ${quizFeedback && quizChoice === i ? correct ? 'correct' : 'wrong' : ''}" data-choice="${i}" aria-pressed="${quizChoice === i}" ${answered ? 'disabled' : ''}><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${esc(text)}</span>${quizFeedback && correct && quizChoice === i ? icon('check', 20) : ''}</button>`).join('')}</div>
    ${quizFeedback ? `<div class="answer-feedback ${correct ? 'success' : 'try-again'}" role="status" aria-live="polite">${icon(correct ? 'check' : 'spark', 23)}<div><strong>${correct ? t("Nicely done!", "Верно!", "Дұрыс!") : t("Almost. Try another answer.", "Попробуй другой ответ.", "Басқа жауапты байқап көр.")}</strong><p>${esc(q.explanation)}</p></div></div>` : ''}</section>
    <div class="lesson-actionbar ${answered ? 'has-success' : ''}"><button class="primary" data-action="${answered ? 'next-question' : 'check-quiz'}" ${quizChoice === null ? 'disabled' : ''}>${answered ? quizIndex === questionCount - 1 ? t('Finish this step','Завершить этап','Кезеңді аяқтау') : t('Continue','Продолжить','Жалғастыру') : t('Check answer','Проверить ответ','Жауапты тексеру')} ${icon('arrow', 19)}</button></div>`;
}

export function posterHtml(p) {
  // Translate only known placeholder copy. The learner’s draft stays untouched.
  const preview = { ...p, title: p.title || 'Your big idea', subtitle: p.subtitle || 'A few details that make it yours.', cta: p.cta || 'Tell people what to do next' };
  return `<div class="poster-preview poster-svg" data-poster-preview>${posterSvg(preview, false).replace('>СОЗДАНО В MINDORA</text>', '>MADE WITH MINDORA</text>')}</div>`;
}

const briefs = [
  'Make a poster for a Saturday plant swap. Include the event, one useful detail, and an invitation to join.',
  'Make a poster for a Sunday book swap. Include the event, one useful detail, and an invitation to join.',
  'Make a poster for a Friday pottery workshop. Include the event, one useful detail, and an invitation to join.'
];

function practiceContent(id, d, challenge, checks, minutes) {
  return `${buddy(id, checks ? checks.passed ? t("You did it! Save your work and keep this little win.", "Работа прошла проверку. Сохрани её.", "Жұмыс тексеруден өтті. Оны сақтап қой.") : t("A few small tweaks and you’ll be there. Check my notes below.", "Посмотри, что нужно поправить.", "Нені түзету керегін төменнен көр.") : challenge ? t("Try the new task independently.", "Реши новую задачу самостоятельно.", "Жаңа тапсырманы өз бетіңше орында.") : id === 'design' ? t("Let’s make your first poster. Start with a headline you love.", "Начни свой постер с заголовка.", "Постерді тақырыптан баста.") : t("Let’s add your expenses. I’ll be right here if you need a hint.", "Внеси расходы в таблицу.", "Шығындарды кестеге енгіз."), checks?.passed ? 'celebrate' : checks ? 'explaining' : 'welcome')}
    ${challenge ? `<div class="practice-brief"><span class="eyebrow">${t("Your fresh challenge", "Самостоятельное задание", "Өздік жұмыс")}</span><p>${id === 'design' ? briefs[d.seed % briefs.length] : t("Here are three new expenses. Write a formula for B2:B4, then work out the total.", "Запиши формулу для B2:B4 и посчитай сумму трёх новых расходов.", "B2:B4 үшін формула жазып, үш жаңа шығынның сомасын есепте.")}</p></div>` : ''}
    ${id === 'design' ? posterEditor(d) : budgetEditor(d, challenge, checks, minutes)}
    ${!challenge ? `<details class="practice-hint"><summary>${icon('spark', 18)} ${t("A little hint", "Подсказка", "Кеңес")}</summary><p>${id === 'design' ? t("Make your headline at least 1.5 times the size of the detail text. Choose colours that are easy to read and add a clear next step.", "Сделай заголовок в 1,5 раза крупнее текста. Выбери читаемые цвета и добавь призыв к действию.", "Тақырыпты мәтіннен кемінде 1,5 есе үлкейт. Оқуға ыңғайлы түс таңдап, әрекетке шақыру қос.") : t("SUM needs the first and last cells of a range. Include B2, B3 and B4, then add all three numbers.", "Для SUM укажи первую и последнюю ячейку. Сложи значения B2, B3 и B4.", "SUM үшін ауқымның бірінші және соңғы ұяшықтарын көрсетіп, B2, B3 және B4 мәндерін қос.")}</p></details>` : ''}
    <div id="checks-container">${checks ? renderChecks(checks, id, challenge) : ''}</div>
    <div class="lesson-actionbar"><button class="primary" data-action="check-work">${checks?.passed ? t("Save my work", "Сохранить работу", "Жұмысты сақтау") : t("Check my work", "Проверить работу", "Жұмысты тексеру")} ${icon(checks?.passed ? 'check' : 'arrow', 19)}</button><p class="small-note">${t("Your draft is saved as you go.", "Черновик сохраняется автоматически.", "Нобай автоматты сақталады.")}</p></div>`;
}

function posterEditor(d) {
  return `<section class="studio-workspace"><div class="studio-canvas"><div class="editor-stage" data-poster-stage>${posterHtml(d)}</div><p class="canvas-caption">${icon('edit', 15)} ${t("Your live preview", "Предпросмотр", "Алдын ала көрініс")}</p></div><form id="poster-form" class="studio-controls" autocomplete="off">
    <label class="field"><span>${t("What’s your big idea?", "Какая главная мысль?", "Негізгі ой қандай?")}</span><input name="title" maxlength="48" value="${esc(d.title)}" placeholder="${t("Your poster headline", "Заголовок постера", "Постер тақырыбы")}" required></label>
    <label class="field"><span>${t("Add a little detail", "Добавь детали", "Мәлімет қос")}</span><textarea name="subtitle" maxlength="100" placeholder="${t("What should people know?", "Что нужно знать читателю?", "Оқырман нені білуі керек?")}" required>${esc(d.subtitle)}</textarea></label>
    <label class="field"><span>${t("What should people do?", "Что нужно сделать?", "Не істеу керек?")}</span><input name="cta" maxlength="55" value="${esc(d.cta)}" placeholder="Join us on Saturday at 10 am" required></label>
    <details class="style-disclosure"><summary>${t('Adjust style','Оформление','Безендіру')} ${icon('edit', 16)}</summary><div class="style-fields"><label class="field"><span class="range-label">${t("Headline size", "Размер заголовка", "Тақырып өлшемі")} <output id="title-size">${Number(d.titleSize) || 34}px</output></span><input type="range" name="titleSize" min="20" max="56" value="${Number(d.titleSize) || 34}"></label>
    <label class="field"><span class="range-label">${t("Detail text size", "Размер текста", "Мәтін өлшемі")} <output id="subtitle-size">${Number(d.subtitleSize) || 16}px</output></span><input type="range" name="subtitleSize" min="10" max="24" value="${Number(d.subtitleSize) || 16}"></label>
    <div class="field"><span>${t("Pick a background", "Цвет фона", "Фон түсі")}</span><div class="palette">${[['#f7d667', 'Sunshine'], ['#e3ecf7', 'Sky'], ['#d6eadd', 'Sage'], ['#f3d9d1', 'Peach']].map(([color, name]) => `<button type="button" class="color-swatch ${d.bgColor === color ? 'selected' : ''}" data-color="${color}" aria-label="${name} background" aria-pressed="${d.bgColor === color}" style="background:${color}"></button>`).join('')}</div></div>
    <label class="field"><span>${t("Text colour", "Цвет текста", "Мәтін түсі")}</span><select name="textColor"><option value="#263c31" ${d.textColor === '#263c31' ? 'selected' : ''}>${t("Forest green", "Тёмно-зелёный", "Қою жасыл")}</option><option value="#243e6a" ${d.textColor === '#243e6a' ? 'selected' : ''}>${t("Midnight blue", "Тёмно-синий", "Қою көк")}</option><option value="#ffffff" ${d.textColor === '#ffffff' ? 'selected' : ''}>${t("White", "Белый", "Ақ")}</option></select></label>
    </div></details></form></section>`;
}

function sheetTable(values, editable, total = '—') {
  return `<table class="expense-table"><caption class="sr-only">${t("Expense tracker. Values in cells B2 to B4.", "Таблица расходов. Значения в ячейках B2–B4.", "Шығындар кестесі. Мәндер B2–B4 ұяшықтарында.")}</caption><thead><tr><th aria-label="${t("Row number", "Номер строки", "Жол нөмірі")}"></th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody><tr><th scope="row">1</th><td class="sheet-heading">${t("Expense", "Расход", "Шығын")}</td><td class="sheet-heading">${t("Amount", "Сумма", "Сома")}</td></tr>${values.map((v, i) => `<tr><th scope="row">${i + 2}</th><td>${[t("Transport", "Транспорт", "Көлік"), t("Groceries", "Продукты", "Азық-түлік"), t("Subscriptions", "Подписки", "Жазылымдар")][i]}</td><td class="number-cell">${editable ? `<input type="number" inputmode="decimal" min="0" max="1000000" step="0.01" data-expense="${i}" value="${esc(v)}" aria-label="${[t("Transport", "Транспорт", "Көлік"), t("Groceries", "Продукты", "Азық-түлік"), t("Subscriptions", "Подписки", "Жазылымдар")][i]} expense, cell B${i + 2}">` : esc(v)}</td></tr>`).join('')}<tr class="total-row"><th scope="row">5</th><td>${t("Total", "Итого", "Барлығы")}</td><td data-budget-total>${esc(total)}</td></tr></tbody></table>`;
}

function budgetEditor(d, challenge, checks, minutes) {
  const { limit } = budgetSession(minutes);
  const total = checks?.passed ? d.values.reduce((sum, value) => sum + Number(value), 0).toFixed(2) : '—';
  return `${budgetSessionPanel(minutes)}<section class="budget-workspace">
    <div class="sheet-toolbar">${icon('grid', 19)} ${t('My expense tracker','Моя таблица расходов','Шығындар кестем')}</div>
    ${sheetTable(d.values, !challenge && minutes !== 5, total)}
    <div class="budget-controls">
      <label class="field"><span>${t('Write your formula','Напиши формулу','Формуланы жаз')}</span><input id="budget-formula" value="${esc(d.formula)}" placeholder="=SUM(...)" autocomplete="off" autocapitalize="characters" spellcheck="false"${minutes === 5 && !challenge ? ' readonly' : ''}></label>
      <label class="field"><span>${t('What’s the total?','Какая общая сумма?','Жалпы сома қанша?')}</span><input id="budget-answer" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.answer)}"></label>
      ${budgetBalanceField(d, limit)}
    </div></section><section class="game-card simple-panel" data-cloud-panel="editor"></section>`;
}

function renderChecks(r, id, challenge) {
  return `<section class="check-panel ${r.passed ? 'all-passed' : ''}" role="status" aria-live="polite"><h2>${r.passed ? t("Looking good!", "Всё верно!", "Бәрі дұрыс!") : t("Let’s make a few small tweaks", "Что можно поправить", "Нені түзетуге болады")}</h2><ul>${r.checks.map(c => `<li class="${c.passed ? 'passed' : 'needs-work'}"><span class="check-indicator">${icon(c.passed ? 'check' : 'edit', 17)}</span><div><strong>${esc(uiText(c.label))}</strong><p>${esc(uiText(c.detail))}</p></div></li>`).join('')}</ul>${id === 'design' && challenge ? '<p class="small-note">One last look: does your poster match the challenge?</p>' : ''}</section>`;
}

export function result(state) {
  const id = state.active;
  if (!COURSES[id]) return emptyView('Your next little win is waiting', 'Choose a course and make something of your own.');
  const finished = state.progress[id] === 4;
  return `<section class="result-screen">${character(guide(id), 'celebrate', 'result-character')}<span class="tag">${finished ? t("Course complete", "Курс завершён", "Курс аяқталды") : t("Practice complete", "Практика завершена", "Жаттығу аяқталды")} ${icon('check', 15)}</span><h1>${t("Look at you go!", "Отличная работа!", "Жарайсың!")}</h1><p>${finished ? t("You learned it. You tried it. You made it your own.", "Ты применил навык в самостоятельной работе.", "Дағдыңды өздік жұмыста қолдандың.") : t("You turned a new idea into something real.", "Твоя работа готова.", "Жұмысың дайын.")}</p><div class="result-card"><div class="result-symbol">${icon(id === 'design' ? 'edit' : 'grid', 28)}</div><h2>${id === 'design' ? t("Your poster is ready", "Постер готов", "Постерің дайын") : t("Your expense tracker is ready", "Таблица расходов готова", "Шығындар кестесі дайын")}</h2><p>${outcomes[id]}</p><div class="result-stats"><div><strong>${state.progress[id]} / 4</strong><span>${t("Steps complete", "Этапов завершено", "Кезең аяқталды")}</span></div><div><strong>1</strong><span>${t("Thing you made", "Готовая работа", "Дайын жұмыс")}</span></div></div><div class="result-actions">${finished ? `<button class="primary" data-action="certificate" data-id="${id}">${icon('cap', 19)} ${t('Get my certificate','Получить сертификат','Сертификат алу')}</button>` : ''}<button class="${finished ? 'secondary' : 'primary'}" data-action="download" data-id="${id}">${icon('download', 19)}${t(" Download ", " Скачать ", " Жүктеп алу ")}${id === 'design' ? t("poster", "постер", "постер") : t("tracker", "таблицу", "кесте")}</button><button class="secondary" data-view="work">${t("See my work", "Мои работы", "Жұмыстарым")} ${icon('arrow', 18)}</button></div><p class="small-note">${t("Saved in this browser, ready when you are.", "Работа сохранена в этом браузере.", "Жұмысың осы браузерде сақталды.")}</p></div><button class="text-link" data-action="mix">${icon('shuffle', 17)} ${t("Try a fresh challenge", "Новое задание", "Жаңа тапсырма")}</button></section>`;
}

export function workView(state) {
  const entries = Object.entries(state.works).filter(([id]) => COURSES[id]);
  return `${pageBanner(t("Made by you", "Мои работы", "Жұмыстарым"), t("Small steps. Real things you can be proud of.", "Твои сохранённые учебные работы.", "Сақталған оқу жұмыстарың."), 'celebrate')}${!entries.length ? emptyView(t("Your ideas belong here", "Здесь будут твои работы", "Жұмыстарың осы жерде көрінеді"), t("Finish a practice to save your first poster or expense tracker.", "Заверши практику, чтобы сохранить постер или таблицу.", "Постерді не кестені сақтау үшін жаттығуды аяқта."), t("Make something", "Начать практику", "Жаттығуды бастау")) : `<div class="portfolio-summary"><strong>${entries.length} ${entries.length === 1 ? 'project' : 'projects'}</strong><span>Every one started with a little curiosity.</span></div><div class="portfolio-grid">${entries.map(([id, w]) => `<article class="work-item"><div class="work-thumb">${id === 'design' ? posterHtml(w.data) : sheetTable(w.data.values, false, w.data.values.reduce((a, b) => a + Number(b), 0).toFixed(2))}</div><div class="work-item-body"><span class="eyebrow">${categories[id]}</span><h2>${id === 'design' ? esc(w.data.title) : 'My expense tracker'}</h2><p>${w.challenge ? t("Independent challenge", "Самостоятельная работа", "Өздік жұмыс") : t("Guided practice", "Практика с подсказками", "Нұсқаумен жаттығу")} · ${new Date(w.savedAt).toLocaleDateString(currentLanguage(), { month: 'short', day: 'numeric' })}</p><button class="secondary" data-action="download" data-id="${id}">${icon('download', 17)}${t(" Download ", " Скачать ", " Жүктеп алу ")}${id === 'design' ? 'SVG' : 'CSV'}</button><button class="text-link" data-course="${id}">${t("Keep learning ", "Продолжить обучение ", "Оқуды жалғастыру ")}${icon('arrow', 16)}</button><label class="field reflection-field"><span>${t("What would you like to remember?", "Что хочешь запомнить?", "Нені есте сақтағың келеді?")}</span><textarea class="notes-area" data-note="${id}" maxlength="600" placeholder="${t("A little note to your future self…", "Заметка для себя…", "Өзіңе арналған жазба…")}">${esc(state.notes[id] || '')}</textarea></label></div></article>`).join('')}</div>`}`;
}
