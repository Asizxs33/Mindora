import { escapeHtml as escape } from '../core/engine.js';

export const minoWalk = () => `<span class="mino-walk" aria-hidden="true"><span class="mino-walk-sprite"></span></span>`;

export function minoWaitScreen(title, tip) {
  return `<section class="mino-wait-screen" role="status" aria-atomic="true">
    ${minoWalk()}
    <p class="mino-wait-title">${escape(title)}</p>
    <p class="mino-wait-tip">${escape(tip)}</p>
  </section>`;
}
