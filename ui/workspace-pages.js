import { labCourseCards } from '../core/lab-courses.js';
import { courseIllustration } from './course-cover.js';
import { icon } from './icons.js';
import { currentLanguage, t } from './language.js';

export function projectLaunchers(state) {
  const projects = [
    ['design', 'poster', 'palette', 'SVG',
      t('Design a poster', 'Сделай постер', 'Постер жаса'),
      t('Arrange text and colour for an event poster you can download.', 'Собери афишу события из текста и цвета, затем скачай её.', 'Мәтін мен түс арқылы іс-шара афишасын жасап, жүктеп ал.'),
      t('Open poster practice', 'Сделать постер', 'Постер жасау')],
    ['budget', 'spreadsheets', 'sheet', 'CSV',
      t('Build an expense tracker', 'Собери таблицу расходов', 'Шығындар кестесін құрастыр'),
      t('Use a formula to add up your expenses and export your table.', 'Посчитай расходы формулой и скачай готовую таблицу.', 'Шығынды формуламен есептеп, дайын кестені жүктеп ал.'),
      t('Open spreadsheet practice', 'Собрать таблицу', 'Кесте құрастыру')],
  ];
  return `<div class="workshop-grid">${projects.map(([id, cover, symbol, format, title, description, action]) => {
    const hasDraft = Object.keys(state.drafts ?? {}).some(key => key.startsWith(`${id}-`));
    const open = hasDraft ? `data-course="${id}" data-course-path` : `data-action="practice" data-id="${id}"`;
    return `<article class="workshop-tile workshop-tile-${id}">
    <div class="workshop-art">${courseIllustration({ id: cover }, symbol)}</div>
    <div class="workshop-copy"><span class="workshop-format" aria-label="${t('Download format', 'Формат скачивания', 'Жүктеу пішімі')} ${format}">${format}</span>
      <h3>${title}</h3><p>${description}</p>
      <button class="text-link" type="button" ${open}>${hasDraft ? t('Open course', 'Открыть курс', 'Курсты ашу') : action} ${icon('arrow', 17)}</button>
    </div>
  </article>`;
  }).join('')}</div>`;
}

export function practiceView(state) {
  const labs = labCourseCards(currentLanguage(), state.minutes);
  return `<div class="learning-workspace-page">
    <header class="workspace-heading"><div><h1>${t('Practice', 'Практика', 'Жаттығу')}</h1>
      <p>${t('Pick something to make or try a skill in an interactive exercise.', 'Выбери, что сделать, или попробуй навык в интерактивном задании.', 'Жасайтын жұмысты таңда немесе дағдыны интерактивті тапсырмада сына.')}</p></div>
      <button class="secondary" type="button" data-view="work">${icon('work', 18)} ${t('My projects', 'Мои проекты', 'Жобаларым')}</button>
    </header>
    <section class="workspace-section"><h2>${t('Make something to keep', 'Сделай работу, которую можно сохранить', 'Сақтауға болатын жұмыс жаса')}</h2>${projectLaunchers(state)}</section>
    <section class="workspace-section"><h2>${t('Interactive practice', 'Интерактивные задания', 'Интерактивті тапсырмалар')}</h2>
      <ul class="workshop-labs">
        <li><button type="button" data-view="weekly-report"><span class="workshop-lab-icon">${icon('chart', 23)}</span>
          <span><strong>${t('Weekly work report', 'Еженедельный отчёт', 'Апталық есеп')}</strong><small>${t('Turn a table of work data into a short report with a decision.', 'Собери из рабочих данных короткий отчёт и предложи решение.', 'Жұмыс деректерінен қысқа есеп жасап, шешім ұсын.')}</small></span>${icon('arrow', 19)}</button></li>
        ${labs.map(lab => `<li><button type="button" data-starter-course="${lab.id}"><span class="workshop-lab-icon">${icon(lab.icon, 23)}</span>
          <span><strong>${lab.title}</strong><small>${lab.description}</small></span>${icon('arrow', 19)}</button></li>`).join('')}
      </ul>
    </section>
  </div>`;
}

export function profileLearningPanels(rewardProfile) {
  return `${rewardProfile ? `<details class="profile-rewards profile-learning-panel"><summary>${icon('chart', 20)}<span>${t('Learning activity', 'Учебная активность', 'Оқу белсенділігі')}</span>${icon('chevron', 18)}</summary>${rewardProfile}</details>` : ''}
    <details class="profile-draft profile-learning-panel"><summary>${icon('sheet', 20)}<span>${t('Spreadsheet draft', 'Черновик таблицы', 'Кесте нобайы')}</span>${icon('chevron', 18)}</summary>
      <div class="profile-draft-actions"><button type="button" class="text-link" data-course="budget" data-course-path>${t('Open spreadsheet course', 'Открыть курс по таблицам', 'Кестелер курсын ашу')} ${icon('arrow', 17)}</button></div>
      <section class="game-card simple-panel" data-cloud-panel="profile"></section>
    </details>`;
}
