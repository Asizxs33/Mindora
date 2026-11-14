import { character } from './characters.js';
import { escapeHtml as esc } from '../core/engine.js';
import { t } from './language.js';

const names = { mino: 'Mino', mia: 'Mia', sam: 'Sam', leo: 'Sam', artist: 'Ari', copywriter: 'Nora', smm: 'Zoe' };

// The caller supplies escaped HTML; hints remain plain text. This layer never
// grades work, advances a lesson or changes a learner's saved progress.
export function mentorScene(mentor, mood, content, extraClass = '', { hint = '', focus = '' } = {}) {
  const name = names[mentor] || 'Mino';
  return `<div class="ai-lesson-mentor mentor-scene ${esc(extraClass)}" data-mentor-scene data-mentor-tone="${esc(mood)}">
    <div class="mentor-figure">${character(mentor, mood, 'ai-lesson-mentor-character')}<span class="mentor-ground" aria-hidden="true"></span></div>
    <div class="ai-lesson-mentor-speech mentor-dialogue"><div class="mentor-speaker"><strong>${name}</strong></div><div data-mentor-message>${content}</div>
      ${hint ? `<div class="mentor-actions"><button type="button" data-mentor-help aria-expanded="false">${t('A little help', 'Подсказка', 'Көмек')}</button></div><div class="mentor-hint" data-mentor-hint hidden><p>${esc(hint)}</p>${focus ? `<button class="mentor-focus-button" type="button" data-mentor-focus>${esc(focus)} <span aria-hidden="true">↗</span></button>` : ''}</div>` : focus ? `<div class="mentor-actions"><button type="button" data-mentor-focus>${esc(focus)} <span aria-hidden="true">↗</span></button></div>` : ''}
    </div>
  </div>`;
}
