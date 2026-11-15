import { escapeHtml as esc } from '../core/engine.js';
import { restorePlan } from '../core/learning-plan.js';
import { drawingSvg } from '../core/lab-models.js';
import { restorePracticeAnswer } from '../core/lesson-practice.js';
import { practiceResult } from './lesson-practice.js';
import { icon } from './icons.js';
import { t } from './language.js';

export function learningProjects(saved) {
  saved = restorePlan(saved);
  if (!saved?.completed) return '';
  return `<section class="lesson-projects"><h2>${t('Completed tasks in this course', 'Завершённые задания этого курса', 'Осы курста аяқталған тапсырмалар')}</h2><p class="small-note">${t('Open another saved course to find its answers.', 'Ответы из другого курса доступны после его открытия в «Мои курсы».', 'Басқа курстың жауаптарын «Курстарым» бөлімінен сол курсты ашып көре аласың.')}</p><div class="portfolio-grid">${saved.plan.steps.slice(0, saved.completed).map((step, index) => {
    const answer = saved.answers[index], parsed = restorePracticeAnswer(step.practice, answer);
    const svg = step.practice?.type === 'drawing';
    const text = parsed?.type === 'code' ? `${parsed.code}\n\n${parsed.output}\n\n${parsed.explanation}` : answer;
    const href = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawingSvg(parsed.strokes))}` : `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
    return `<article class="work-item"><div class="work-item-body"><span class="eyebrow">${icon(svg ? 'palette' : parsed?.type === 'code' ? 'code' : 'document', 18)} ${esc(saved.plan.title)}</span><h3>${esc(step.title)}</h3><div class="project-answer">${practiceResult(step.practice, answer)}</div><a class="secondary project-download" href="${esc(href)}" download="mindora-task-${index + 1}.${svg ? 'svg' : 'txt'}">${icon('download', 17)} ${t('Download my result', 'Скачать результат', 'Нәтижені жүктеу')}</a></div></article>`;
  }).join('')}</div></section>`;
}
