import { t } from './language.js';
import { character } from './characters.js';
import { icon } from './icons.js';

const copy = () => ({
  design: {
    title: t("A quick design refresh.", "Повторим основы дизайна.", "Дизайн негіздерін қайталайық."),
    reminder: t("One big headline. Words that are easy to read. A clear next step. These three ideas make a useful poster.", "Крупный заголовок, читаемый текст и понятный призыв к действию — три основы хорошего постера.", "Ірі тақырып, оқуға ыңғайлы мәтін және түсінікті әрекет — жақсы постердің үш негізі."),
    questions: [
      { text: t("What should people notice first?", "Что читатель должен заметить первым?", "Оқырман алдымен нені байқауы керек?"), choices: [t("The smallest details", "Мелкие детали", "Ұсақ мәліметтер"), t("The main headline", "Главный заголовок", "Негізгі тақырып"), t("Every word at once", "Все слова одновременно", "Барлық сөздерді бірден")], answer: 1, tip: t("Make the main headline the biggest text. It leads the way.", "Главный заголовок должен быть самым крупным — он направляет внимание.", "Негізгі тақырып ең ірі мәтін болуы керек — ол назарды бағыттайды.") },
      { text: t("Your café has an event. Pick the clearest invitation.", "В кафе пройдёт событие. Выбери понятное приглашение.", "Кафеде іс-шара өтеді. Ең түсінікті шақыруды таңда."), choices: [t("See you sometime!", "Как-нибудь увидимся!", "Бір күні кездесерміз!"), t("Coffee is lovely.", "Кофе — это прекрасно.", "Кофе тамаша."), t("Join us Saturday at 10 am", "Приходи в субботу в 10:00", "Сенбі күні 10:00-де кел")], answer: 2, tip: t("A day, a time, and an action tell people what to do next.", "День, время и действие подсказывают читателю следующий шаг.", "Күн, уақыт және әрекет оқырманға келесі қадамды көрсетеді.") },
    ],
  },
  budget: {
    title: t("A quick spreadsheet refresh.", "Повторим основы таблиц.", "Кесте негіздерін қайталайық."),
    reminder: t("A cell has an address, like B2. B2:B4 means B2 through B4. =SUM(B2:B4) adds those cells for you.", "У ячейки есть адрес, например B2. B2:B4 — диапазон от B2 до B4. Формула =SUM(B2:B4) складывает их значения.", "Ұяшықтың B2 сияқты мекенжайы бар. B2:B4 — B2-ден B4-ке дейінгі ауқым. =SUM(B2:B4) формуласы олардың мәндерін қосады."),
    questions: [
      { text: t("Which formula adds B2, B3 and B4?", "Какая формула складывает B2, B3 и B4?", "B2, B3 және B4 мәндерін қай формула қосады?"), choices: ['=SUM(B2:B4)', '=SUM(B2)', 'B2 + B4'], answer: 0, tip: t("Use =SUM(B2:B4). The range includes all three cells.", "Используй =SUM(B2:B4). Диапазон включает все три ячейки.", "=SUM(B2:B4) қолдан. Ауқымға үш ұяшық та кіреді.") },
      { text: t("B2 is 10, B3 is 20 and B4 is 5. What is the total?", "B2 = 10, B3 = 20, B4 = 5. Чему равна сумма?", "B2 = 10, B3 = 20, B4 = 5. Қосындысы қанша?"), choices: ['30', '35', '15'], answer: 1, tip: t("Add all three numbers: 10 + 20 + 5 = 35.", "Сложи три числа: 10 + 20 + 5 = 35.", "Үш санды қос: 10 + 20 + 5 = 35.") },
    ],
  },
});

export const recapQuestion = (id, index) => copy()[id].questions[index];

export function recapView(id, { phase = 0, choice = null, checked = false } = {}) {
  const item = copy()[id], q = phase ? item.questions[phase - 1] : null;
  const correct = q && choice === q.answer;
  return `<div class="lesson-flow recap-flow"><header class="lesson-progress-head"><button class="lesson-exit" data-view="path" aria-label="${t("Return to my course", "Вернуться к курсу", "Курсқа оралу")}">${icon('back', 23)}</button><div class="progress-bar" role="progressbar" aria-label="${t("Refresher progress", "Прогресс повторения", "Қайталау барысы")}" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${phase}"><i style="width:${phase / 3 * 100}%"></i></div><span>${t("Quick refresh", "Повторение", "Қайталау")}</span></header>
    <div class="lesson-buddy">${character(id === 'design' ? 'mia' : 'sam', checked && correct ? 'celebrate' : phase ? 'thinking' : 'welcome', 'lesson-character')}<div class="buddy-bubble"><p>${phase ? t("No rush. Let’s remember together.", "Не спеши. Вспомним вместе.", "Асықпа. Бірге еске түсірейік.") : t("Welcome back! Let’s warm up for a moment.", "С возвращением! Немного повторим.", "Қайта келгеніңе қуаныштымыз! Аздап қайталайық.")}</p></div></div>
    <section class="mini-quiz"><div class="quiz-count">${phase ? `${phase === 1 ? t("Remember", "Вспомни", "Еске түсір") : t("Try it", "Попробуй", "Байқап көр")} · ${t(`${phase} of 2`, `${phase} из 2`, `2 сұрақтың ${phase}-сі`)}` : t("About 1 minute", "Около 1 минуты", "Шамамен 1 минут")}</div><h1>${q ? q.text : item.title}</h1>
    ${!q ? `<p class="idea-description">${item.reminder}</p><aside class="key-idea">${icon('book', 23)}<div><strong>${t("Your place is saved.", "Мы сохранили, где ты остановился.", "Тоқтаған жерің сақталды.")}</strong><p>${t("Two little questions, then straight back to your course.", "Два коротких вопроса — и вернёмся к курсу.", "Екі қысқа сұрақтан кейін курсқа ораламыз.")}</p></div></aside>` : `<div class="quiz-options">${q.choices.map((text, i) => `<button class="quiz-option ${choice === i ? 'selected' : ''} ${checked && choice === i ? correct ? 'correct' : 'wrong' : ''}" data-recap-choice="${i}" aria-pressed="${choice === i}" ${checked && correct ? 'disabled' : ''}><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${text}</span></button>`).join('')}</div>${checked ? `<div class="answer-feedback ${correct ? 'success' : 'try-again'}" role="status"><div><strong>${correct ? t("You’ve got it!", "Верно!", "Дұрыс!") : t("Let’s try once more.", "Попробуем ещё раз.", "Қайталап көрейік.")}</strong><p>${q.tip}</p></div></div>` : ''}`}</section>
    <div class="lesson-actionbar"><button class="primary" data-action="${!phase || (checked && correct) ? 'recap-next' : 'recap-check'}" ${phase && choice === null ? 'disabled' : ''}>${!phase ? t("Let’s remember", "Вспомнить", "Еске түсіру") : checked && correct ? phase === 2 ? t("Continue my course", "Продолжить курс", "Курсты жалғастыру") : t("Continue", "Продолжить", "Жалғастыру") : t("Check answer", "Проверить ответ", "Жауапты тексеру")} ${icon('arrow', 19)}</button></div></div>`;
}
