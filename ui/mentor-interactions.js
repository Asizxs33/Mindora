// A small presentation controller. It only reveals supplied hints and focuses
// real lesson content, leaving all assessment and persistence to core.
import { t } from './language.js';

const timers = new WeakMap();
export function interactWithMentor(target, { animate, announce, react }) {
  const scene = target.closest('[data-mentor-scene]');
  if (!scene) return false;
  const help = target.closest('[data-mentor-help]');
  const focus = target.closest('[data-mentor-focus]');
  const portrait = target.closest('[data-character-hello]');
  if (!help && !focus && !portrait) return false;
  const mentor = scene.querySelector('[data-character-kind]');
  const hint = scene.querySelector('[data-mentor-hint]');
  if (focus) {
    const scope = scene.closest('[data-learn-page], .lesson-template, .ai-lesson-page, .lesson-flow');
    const content = scope?.querySelector('[data-mentor-target], .ai-lesson-example, .ai-lesson-choices, .ai-lesson-criterion');
    if (!content) return false;
    clearTimeout(timers.get(content));
    content.classList.add('mentor-focus-target');
    if (!content.hasAttribute('tabindex')) content.setAttribute('tabindex', '-1');
    content.focus({ preventScroll: true });
    content.scrollIntoView({ behavior: animate ? 'smooth' : 'instant', block: 'center' });
    timers.set(content, setTimeout(() => content.classList.remove('mentor-focus-target'), 3000));
    announce(t('Here it is. Take a closer look.', 'Вот пример. Посмотри внимательнее.', 'Міне, мұқият қарап көр.'));
  } else if (hint) {
    hint.hidden = help ? !hint.hidden : false;
    scene.querySelector('[data-mentor-help]')?.setAttribute('aria-expanded', String(!hint.hidden));
    if (!hint.hidden) announce(hint.textContent);
  } else {
    announce(scene.querySelector('[data-mentor-message]')?.textContent || '');
  }
  clearTimeout(timers.get(scene));
  scene.classList.remove('mentor-is-speaking');
  if (animate) { void scene.offsetWidth; scene.classList.add('mentor-is-speaking'); }
  timers.set(scene, setTimeout(() => scene.classList.remove('mentor-is-speaking'), 1400));
  if (mentor) react(mentor);
  return true;
}
