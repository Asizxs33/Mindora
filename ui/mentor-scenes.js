import { character } from './characters.js';
import { escapeHtml as esc } from '../core/engine.js';
import { t } from './language.js';

const names = { mino: 'Mino', mia: 'Mia', sam: 'Sam', leo: 'Sam', artist: 'Ari', copywriter: 'Nora', smm: 'Zoe' };

// The caller supplies escaped HTML; hints remain plain text. This layer never
// grades work, advances a lesson or changes a learner's saved progress.
export function mentorScene(mentor, mood, content, extraClass = '', { hint = '', focus = '' } = {}) {
  const name = names[mentor] || 'Mino';
  const state = mood === 'celebrate' ? t('Nicely done!', 'Отличная работа!', 'Жарайсың!')
    : mood === 'thinking' ? t('Let’s think together', 'Подумаем вместе', 'Бірге ойланайық')
      : mood === 'encourage' || mood === 'incorrect' ? t('We can try again', 'Попробуем ещё раз', 'Қайта байқап көреміз')
        : t('Your learning buddy', 'Твой наставник', 'Сенің тәлімгерің');
  return `<div class="ai-lesson-mentor mentor-scene ${esc(extraClass)}" data-mentor-scene data-mentor-tone="${esc(mood)}">
    <div class="mentor-figure">${character(mentor, mood, 'ai-lesson-mentor-character')}<span class="mentor-ground" aria-hidden="true"></span></div>
    <div class="ai-lesson-mentor-speech mentor-dialogue"><div class="mentor-speaker"><strong>${name}</strong><span>${state}</span></div><div data-mentor-message>${content}</div>
      ${hint ? `<div class="mentor-hint" data-mentor-hint hidden><span>${t('A little hint', 'Подсказка', 'Кішкентай көмек')}</span><p>${esc(hint)}</p></div>` : ''}
    </div>
    ${hint || focus ? `<div class="mentor-actions">${hint ? `<button type="button" data-mentor-help aria-expanded="false"><span aria-hidden="true">✦</span> ${t('Give me a hint', 'Дай подсказку', 'Көмектесші')}</button>` : ''}${focus ? `<button type="button" data-mentor-focus><span aria-hidden="true">↗</span> ${esc(focus)}</button>` : ''}</div>` : ''}
  </div>`;
}
