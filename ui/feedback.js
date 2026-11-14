import { escapeHtml } from '../core/engine.js';
import { icon } from './icons.js';
import { posterHtml } from './views.js';

export function dialogContent(type, data) {
  const content = {
    about: ['Как устроена Mindora', '<p>Выбери цель, пройди урок и потренируйся без подсказок. Готовые проекты появятся в разделе «Мои работы».</p><p>В демоверсии доступны дизайн постера и таблицы расходов. Прогресс сохраняется в этом браузере.</p>'],
    programming: ['Программирование', '<p>Курс по программированию в планах. Сейчас можно сделать постер или таблицу расходов.</p>'],
    notifications: ['Уведомления', `<p>${data?.today ? 'Сегодняшняя задача уже выполнена.' : 'Сегодняшняя задача: пройди следующий этап своего курса.'}</p>`],
  };

  const [title, body] = type === 'unsupported'
    ? ['Выбери учебный путь', `<p>Твоя цель: <strong>${escapeHtml(data.goal)}</strong></p><p>Сейчас доступны два практикума. Выбери один, чтобы начать.</p><div class="modal-buttons"><button class="primary" data-course="design">Сделать постер</button><button class="secondary" data-course="budget">Собрать таблицу</button></div>`]
    : content[type];
  return `<h2 id="modal-title">${title}</h2>${body}`;
}

export function resetWorkCheck() {
  const panel = document.querySelector('#checks-container');
  if (panel) panel.replaceChildren();
  const button = document.querySelector('[data-action="check-work"]');
  if (button) button.innerHTML = `Проверить работу ${icon('arrow', 16)}`;
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
