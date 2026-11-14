/**
 * UI-only character contract.
 * character(kind, mood, className) returns a button; never nest it in another button/link.
 * Kinds: mino, leo/programmer, mia/designer, sam/teacher.
 * Moods: welcome, thinking, explaining/encourage, celebrate.
 * Size the outer .mindora-character from the screen's CSS. The inner square keeps
 * the 2×2 atlas undistorted even when the outer box is rectangular.
 * Call mountCharacters() once after mounting the shell. Later screen renders are
 * discovered automatically. A button[data-character-motion] becomes a motion
 * switch; optional [data-character-motion-status] receives the effective setting.
 * No course data, progress, controller hooks, or core storage are changed here.
 */
import { t } from './language.js';

const characters = Object.freeze({
  mino: { name: 'Mino', atlas: 'mino-poses-v3.png', fallback: 'capybara.png' },
  leo: { name: 'Leo', atlas: 'leo-poses-v3.png', fallback: 'programmer.png' },
  mia: { name: 'Mia', atlas: 'mia-poses-v3.png', fallback: 'designer.png' },
  sam: { name: 'Sam', atlas: 'sam-poses-v3.png', fallback: 'teacher.png' }
});
const aliases = { programmer: 'leo', designer: 'mia', teacher: 'sam', capybara: 'mino' };
const moods = new Set(['welcome', 'thinking', 'explaining', 'encourage', 'celebrate']);
const MOTION_KEY = 'mindora.characters.motion.v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
const asset = file => new URL(`./assets/${file}`, import.meta.url).href;
const helloTimers = new WeakMap();
const observed = new WeakSet();
const atlasLoads = new Map();
let mounted = false;
let preference = 'on';
let reducedMotion;
let resizeObserver;
let statusElement;

export function character(kind = 'mino', mood = 'welcome', className = '') {
  kind = aliases[kind] || kind;
  if (!Object.hasOwn(characters, kind)) kind = 'mino';
  mood = moods.has(mood) ? mood : 'welcome';
  const { name, fallback } = characters[kind];
  return `<button type="button" class="mindora-character character-${kind} ${escape(className)}" data-character-kind="${kind}" data-character-mood="${mood}" data-character-hello aria-label="Say hello to ${name}" title="Say hello to ${name}"><span class="character-frame" aria-hidden="true"><span class="character-art"><img class="character-fallback" src="${escape(asset(fallback))}" alt="" loading="lazy" decoding="async"></span></span></button>`;
}

function readPreference() {
  try { return localStorage.getItem(MOTION_KEY) === 'off' ? 'off' : 'on'; }
  catch { return 'on'; }
}

function updateMotion() {
  const deviceReduced = !!reducedMotion?.matches;
  const enabled = preference !== 'off' && !deviceReduced;
  document.documentElement.dataset.characterAnimations = enabled ? 'on' : 'off';
  document.querySelectorAll('[data-character-motion]').forEach(control => {
    control.setAttribute('role', 'switch');
    control.setAttribute('aria-checked', String(enabled));
    if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', 'Character motion');
    control.dataset.state = enabled ? 'on' : 'off';
    control.disabled = deviceReduced;
    control.setAttribute('aria-disabled', String(deviceReduced));
  });
  document.querySelectorAll('[data-character-motion-status]').forEach(element => {
    element.textContent = deviceReduced
      ? t('Your device reduces motion.','На устройстве включено уменьшение движения.','Құрылғыда қозғалыс азайтылған.')
      : enabled ? t('Motion is on.','Анимация включена.','Анимация қосулы.')
        : t('Motion is off.','Анимация выключена.','Анимация өшірулі.');
  });
}

function updateVisibility() {
  document.documentElement.dataset.characterPageHidden = document.hidden ? 'true' : 'false';
}

function fitFrame(element) {
  const size = Math.max(0, Math.min(element.clientWidth, element.clientHeight));
  if (size) element.style.setProperty('--character-frame-size', `${size}px`);
}

function applyAtlas(kind) {
  const loaded = atlasLoads.get(kind)?.status === 'ready';
  document.querySelectorAll(`.mindora-character[data-character-kind="${kind}"]`).forEach(element => element.classList.toggle('character-ready', loaded));
}

function loadAtlas(kind) {
  if (atlasLoads.has(kind)) { applyAtlas(kind); return; }
  const image = new Image();
  const entry = { status: 'loading', image };
  atlasLoads.set(kind, entry);
  image.onload = () => { entry.status = 'ready'; applyAtlas(kind); };
  image.onerror = () => { entry.status = 'failed'; applyAtlas(kind); };
  image.decoding = 'async';
  image.src = asset(characters[kind].atlas);
}

function discover(root = document) {
  const elements = [];
  if (root instanceof Element && root.matches('.mindora-character')) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('.mindora-character'));
  for (const element of elements) {
    const kind = element.dataset.characterKind;
    if (!Object.hasOwn(characters, kind)) continue;
    if (!observed.has(element)) {
      observed.add(element);
      fitFrame(element);
      resizeObserver?.observe(element);
    }
    loadAtlas(kind);
  }
  updateMotion();
}

function release(root) {
  const elements = [];
  if (root instanceof Element && root.matches('.mindora-character')) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('.mindora-character'));
  for (const element of elements) {
    resizeObserver?.unobserve(element);
    observed.delete(element);
    const pending = helloTimers.get(element);
    if (pending) {
      clearTimeout(pending.timer);
      element.dataset.characterMood = pending.baseMood;
      element.classList.remove('character-hello');
      helloTimers.delete(element);
    }
  }
}

function greet(element) {
  const previous = helloTimers.get(element);
  if (previous) clearTimeout(previous.timer);
  const baseMood = previous?.baseMood || element.dataset.characterMood || 'welcome';
  const kind = element.dataset.characterKind;
  const name = characters[kind]?.name || 'Mino';
  const index = (previous?.index ?? Number(element.dataset.characterGreeting || 0)) + 1;
  element.dataset.characterGreeting = String(index);
  element.dataset.characterMood = 'welcome';
  element.classList.remove('character-hello');
  // Restart only this brief gesture, not the surrounding learning UI.
  void element.offsetWidth;
  element.classList.add('character-hello');
  const messages = [
    t(`${name}: Hi! I’m here with you.`, `${name}: Привет! Я рядом.`, `${name}: Сәлем! Қасыңдамын.`),
    t(`${name}: Keep going.`, `${name}: Продолжай.`, `${name}: Жалғастыра бер.`),
    t(`${name}: You’ve got this!`, `${name}: У тебя получится!`, `${name}: Қолыңнан келеді!`),
  ];
  if (statusElement) statusElement.textContent = messages[(index - 1) % messages.length];
  const timer = setTimeout(() => {
    if (element.isConnected) {
      element.classList.remove('character-hello');
      element.dataset.characterMood = baseMood;
      element.classList.add('character-restored');
    }
    helloTimers.delete(element);
  }, 1000);
  helloTimers.set(element, { baseMood, timer, index });
}

export function mountCharacters() {
  if (typeof document === 'undefined') return;
  if (mounted) { discover(); return; }
  mounted = true;
  if (!document.getElementById('mindora-character-styles')) {
    const stylesheet = document.createElement('link');
    stylesheet.id = 'mindora-character-styles';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./characters.css', import.meta.url).href;
    document.head.append(stylesheet);
  }
  preference = readPreference();
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.addEventListener?.('change', updateMotion);
  if ('ResizeObserver' in window) resizeObserver = new ResizeObserver(entries => entries.forEach(entry => fitFrame(entry.target)));
  else window.addEventListener('resize', () => document.querySelectorAll('.mindora-character').forEach(fitFrame), { passive: true });
  statusElement = document.createElement('div');
  statusElement.className = 'character-live-status';
  statusElement.setAttribute('role', 'status');
  statusElement.setAttribute('aria-live', 'polite');
  document.body.append(statusElement);
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const toggle = target?.closest('[data-character-motion]');
    if (toggle && !toggle.disabled) {
      preference = preference === 'off' ? 'on' : 'off';
      try { localStorage.setItem(MOTION_KEY, preference); } catch { /* Session preference still works. */ }
      updateMotion();
      return;
    }
    const element = target?.closest('.mindora-character[data-character-hello]');
    if (element && !element.disabled) greet(element);
  });
  document.addEventListener('visibilitychange', updateVisibility);
  window.addEventListener('storage', event => {
    if (event.key === MOTION_KEY) { preference = readPreference(); updateMotion(); }
  });
  window.addEventListener('online', () => {
    for (const [kind, entry] of atlasLoads) if (entry.status === 'failed') atlasLoads.delete(kind);
    discover();
  });
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.removedNodes) if (node instanceof Element) release(node);
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.mindora-character,[data-character-motion],[data-character-motion-status]') || node.querySelector('.mindora-character,[data-character-motion],[data-character-motion-status]')) discover(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  discover();
  updateVisibility();
}
