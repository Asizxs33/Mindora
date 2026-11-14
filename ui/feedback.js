import { escapeHtml } from '../core/engine.js';
import { icon } from './icons.js';
import { posterHtml } from './views.js';
import { character } from './characters.js';
import { t } from './language.js';

export function dialogContent(type, data) {
  const content = {
    about: ['Small steps. Something real.', `<ol class="dialog-steps"><li>${icon('book', 25)}<div><strong>Learn one simple idea</strong><p>A short explanation, with an example you can see.</p></div></li><li>${icon('edit', 25)}<div><strong>Give it a little try</strong><p>Answer a question. Then make something yourself.</p></div></li><li>${icon('folder', 25)}<div><strong>Keep what you make</strong><p>Download your poster or spreadsheet from My work.</p></div></li></ol><p class="small-note">This version has two starter courses. Your progress stays in this browser.</p>`],
    programming: ['Meet Leo, our coding buddy.', '<p>Coding lessons are still on the way. You can start with a poster or an everyday spreadsheet today.</p><div class="modal-buttons"><button class="primary" data-course="design">Make a poster</button><button class="secondary" data-course="budget">Try a spreadsheet</button></div>'],
    notifications: ['A little step for today', `<p>${data?.today ? 'You’ve already taken a step today. Well done!' : 'Your next lesson is ready whenever you have a little time.'}</p><button class="primary" data-view="discover">Back to learning ${icon('arrow', 18)}</button>`],
  };

  const [title, body] = type === 'unsupported'
    ? ['Let’s find your first little step.', `<p>You want to learn: <strong>${escapeHtml(data.goal)}</strong></p><p>We don’t have that course yet. These two projects are ready to explore:</p><div class="modal-buttons"><button class="primary" data-course="design">Make a poster</button><button class="secondary" data-course="budget">Learn spreadsheets</button></div>`]
    : (content[type] || content.about);
  return `<div class="modal-buddy">${character(type === 'programming' ? 'leo' : 'mino', type === 'unsupported' ? 'thinking' : 'explaining')}</div><h2 id="modal-title">${title}</h2>${body}`;
}

export function resetWorkCheck() {
  const panel = document.querySelector('#checks-container');
  if (panel) panel.replaceChildren();
  const button = document.querySelector('[data-action="check-work"]');
  if (button) button.innerHTML = `${t('Check my work','Проверить работу','Жұмысты тексеру')} ${icon('arrow', 16)}`;
  const buddy = document.querySelector('.lesson-buddy [data-character-mood]');
  if (buddy) buddy.dataset.characterMood = 'explaining';
  const message = document.querySelector('.lesson-buddy .buddy-bubble p');
  if (message) message.textContent = t('Check your work again when you’re ready.','Проверь работу снова, когда будешь готов.','Дайын болғанда жұмысыңды қайта тексер.');
}

export function refreshPosterPreview(draft) {
  const preview = document.querySelector('[data-poster-stage] [data-poster-preview]');
  if (preview) preview.outerHTML = posterHtml(draft);
  const titleSize = document.querySelector('#title-size');
  const subtitleSize = document.querySelector('#subtitle-size');
  if (titleSize) titleSize.textContent = `${draft.titleSize}px`;
  if (subtitleSize) subtitleSize.textContent = `${draft.subtitleSize}px`;
  for (const button of document.querySelectorAll('[data-color]')) {
    const selected = button.dataset.color === draft.bgColor;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

export function clearBudgetTotal() {
  const total = document.querySelector('[data-budget-total]');
  if (total) total.textContent = '?';
}
