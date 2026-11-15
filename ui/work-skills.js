import { escapeHtml as esc } from '../core/engine.js';
import { REPORT_WEEKS } from '../core/weekly-report.js';
import { t } from './language.js';
import { icon } from './icons.js';

export const workHeadline = () => t('Build a work skill on your next break.', 'Освой рабочий навык за несколько перерывов.', 'Жұмысқа керек дағдыны үзілісте үйрен.');
export const workAudience = () => t('For working adults fitting learning around shifts and family. Bring a task, pick 5, 10 or 20 minutes, and start practising without searching for a course. Do another lesson if you have time, or come back to a short recap.', 'Для тех, кто совмещает работу, семью и учёбу. Выбери задачу и 5, 10 или 20 минут. Материал и практика уже собраны. Есть время — пройди ещё один урок. После долгой паузы вернись к короткому повторению.', 'Жұмыс пен отбасы арасында оқуға уақыт іздейтіндерге. Мақсатыңды жаз, 5, 10 немесе 20 минут таңда. Материал іздемей, жаттығуға кіріс. Уақыт болса, келесі сабақты да өт. Ұзақ үзілістен кейін қысқа қайталау көмектеседі.');
const reportTitle = () => t('Your weekly expense report', 'Еженедельный отчёт о расходах', 'Апталық шығын есебің');
export const priceLine = () => t('First personal course free. Additional courses will require Plus at $9.99/month. Paid sign-up is not open yet.', 'Первый личный курс бесплатно. Для следующих понадобится Plus за $9.99 в месяц. Платная подписка пока недоступна.', 'Бірінші жеке курс тегін. Келесі курстарға айына $9.99 тұратын Plus қажет. Ақылы жазылым әзірге ашылған жоқ.');
export function reportEntry() {
  return `<button type="button" data-view="weekly-report" class="report-entry"><span class="report-symbol">${icon('sheet',24)}</span><span><strong>${reportTitle()}</strong><small>${t('Today with a guide · Tomorrow with new numbers','Сегодня с подсказкой · Завтра с новыми цифрами','Бүгін үлгімен · Ертең жаңа дерекпен')}</small></span>${icon('arrow',18)}</button>`;
}
export function membershipView() {
  return `<section class="report-page"><h1>Mindora Plus</h1><p>${priceLine()}</p><p>${t('Your saved courses and public practice examples stay available.', 'Сохранённые курсы и открытые примеры можно проходить дальше.', 'Сақталған курстарың мен ашық жаттығуларды жалғастыра аласың.')}</p><button class="primary" data-view="courses">${t('Open my courses','Открыть курсы','Курстарымды ашу')}</button>${reportEntry()}</section>`;
}

export function weeklyReportView({ day, days }, checks) {
  const draft = days[day], done = draft.completed;
  const { amounts, budget } = REPORT_WEEKS[day];
  const sum = amounts.reduce((a, b) => a + b, 0);
  const items = [t('Supplies','Материалы','Материалдар'), t('Delivery','Доставка','Жеткізу'), t('Printing','Печать','Баспа'), t('Packing','Упаковка','Қаптама')];
  const formulaHint = t('Include every expense in column B, starting at B2.', 'Включи все расходы столбца B, начиная с B2.', 'B2 ұяшығынан бастап В бағанындағы барлық шығынды қамты.');
  const totalHint = t('Add the amounts in the table.', 'Сложи суммы в таблице.', 'Кестедегі сомаларды қос.');
  const decisionHint = t('Compare your total with $100.', 'Сравни итог со $100.', 'Жалпы соманы $100 шегімен салыстыр.');
  const error = (key, msg) => checks?.[key] === false ? `<small class="report-error">${msg}</small>` : '';
  return `<article class="report-page"><button class="text-link" data-view="courses">${icon('back',18)} ${t('Courses','Курсы','Курстар')}</button>
    <h1>${reportTitle()}</h1><p>${t('You coordinate a small team. On Friday your manager asks how much the team spent and whether it stayed within its $100 budget.', 'Ты координируешь небольшую команду. В пятницу руководителю нужен итог расходов за неделю и ответ, уложились ли вы в $100.', 'Шағын топтың жұмысын үйлестіресің. Жұма күні басшыңа апталық шығынды және топтың $100 бюджетке сыйғанын хабарлау керек.')}</p>
    <ol class="report-plan"><li>${t('Today · 5 min','Сегодня · 5 мин','Бүгін · 5 мин')}<small>${t('Total three expenses with a guide.','Сложи три расхода по образцу.','Үлгімен үш шығынды есепте.')}</small></li><li>${t('Tomorrow · 5 min','Завтра · 5 мин','Ертең · 5 мин')}<small>${t('Recall the formula and report on a new week.','Вспомни формулу и составь новый отчёт.','Формуланы еске түсіріп, жаңа аптаға есеп бер.')}</small></li></ol>
    <section class="report-sheet"><h2>${day ? t('Week 2 · Try it yourself','Неделя 2 · Самостоятельно','2-апта · Өз бетіңше') : t('Week 1 · Guided report','Неделя 1 · С подсказкой','1-апта · Үлгімен есептеу')}</h2>
    <p>${day ? t('One more expense arrived. Which cells should the formula cover now?', 'Появилась ещё одна статья расходов. Какие ячейки нужно включить в формулу?', 'Тағы бір шығын қосылды. Енді формула қай ұяшықтарды қамтуы керек?') : t('Row 1 holds the headers. Type =SUM(B2:B4) to include all three amounts, then calculate the total and choose what to tell your manager.', 'В строке 1 заголовки. Введи =SUM(B2:B4), чтобы учесть три суммы. Посчитай итог и выбери вывод для руководителя.', '1-жолда баған атаулары тұр. Үш шығынды қамту үшін =SUM(B2:B4) деп жаз. Сомасын есептеп, басшыға айтатын қорытындыны таңда.')}</p>
    <table><thead><tr><th>#</th><th>A · ${t('Expense','Расход','Шығын')}</th><th>B · USD</th></tr></thead><tbody>${amounts.map((n,i)=>`<tr><th scope="row">${i+2}</th><td>${items[i]}</td><td>$${n}</td></tr>`).join('')}</tbody></table>
    ${done ? `<div role="status" class="report-outcome"><strong>${t('Report ready','Отчёт готов','Есеп дайын')}</strong><p>${t(`We spent $${sum} this week, $${Math.abs(sum-budget)} ${sum>budget?'over':'under'} budget.`,`Расходы за неделю — $${sum}, на $${Math.abs(sum-budget)} ${sum>budget?'выше':'ниже'} бюджета.`,`Апталық шығын — $${sum}. Бюджеттен $${Math.abs(sum-budget)} ${sum>budget?'артық':'кем'}.`)}</p></div>
      ${day ? `<button class="primary" data-view="courses">${t('Back to courses','Вернуться к курсам','Курстарға оралу')}</button>` : `<p>${t('Come back tomorrow on this browser to practise from memory, or try the second week now.', 'Вернись завтра в этом браузере для проверки по памяти или пройди вторую неделю сейчас.', 'Ертең осы браузерге оралып, есте қалғанын тексер. Уақытың болса, екінші аптаны қазір де бастай аласың.')}</p><button class="primary" data-report-next>${t('Open week 2','Открыть неделю 2','2-аптаны ашу')}</button>`}` : `<form id="weekly-report-form"><label>${t('Formula','Формула','Формула')}<input name="formula" maxlength="80" value="${esc(draft.formula)}" required autocomplete="off" spellcheck="false"></label>${error('formula',formulaHint)}
    <label>${t('Weekly total in USD','Сумма за неделю в USD','Апталық сома, USD')}<input name="total" value="${esc(draft.total)}" maxlength="12" inputmode="decimal" required></label>${error('total',totalHint)}
    <label>${t('What will you report?','Какой вывод передашь?','Қандай қорытынды айтасың?')}<select name="decision" required><option value="">—</option><option value="within" ${draft.decision==='within'?'selected':''}>${t('Within budget','В пределах бюджета','Бюджетке сыйдық')}</option><option value="over" ${draft.decision==='over'?'selected':''}>${t('Over budget','Бюджет превышен','Бюджеттен астық')}</option></select></label>${error('decision',decisionHint)}
    <button class="primary">${t('Check my report','Проверить отчёт','Есепті тексеру')}</button></form>`}</section></article>`;
}
