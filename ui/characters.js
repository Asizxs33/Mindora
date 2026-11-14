/** Original illustrations and the supplied Mia pointing animation.
 * GIF playback is explicitly stopped for reduced motion, hidden tabs and offscreen
 * mentors. Supplied SVG rigs provide a network-error fallback. State stays in core.
 */
import { t } from './language.js';
import { rigMarkup } from './character-rigs.js';

const characters = Object.freeze({
  mino: { name: 'Mino', atlas: 'mino-poses-v3.png', fallback: 'capybara.png' },
  mia: { name: 'Mia', role: 'graphic_designer', image: 'graphic-designer-v3.png', order: 0,
    motion: { image: 'mia-pointing.gif', still: 'mia-pointing-still.png', width: 360, height: 720, duration: 1240, pause: 5800 } },
  sam: { name: 'Sam', role: 'programmer', image: 'programmer-v3.png', order: 1 },
  leo: { name: 'Sam', role: 'programmer', image: 'programmer-v3.png', order: 1 },
  artist: { name: 'Ari', role: 'artist', image: 'artist-v3.png', order: 2 },
  copywriter: { name: 'Nora', role: 'copywriter', image: 'copywriter-v3.png', order: 3 },
  smm: { name: 'Zoe', role: 'smm', image: 'smm-v3.png', order: 4 },
});
const aliases = { programmer: 'leo', designer: 'mia', graphic_designer: 'mia', teacher: 'sam', capybara: 'mino', art: 'artist', writing: 'copywriter', social: 'smm' };
const moods = new Set(['welcome', 'thinking', 'explaining', 'encourage', 'celebrate', 'incorrect']);
const MOTION_KEY = 'mindora.characters.motion.v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
const asset = file => new URL(`./assets/${file}`, import.meta.url).href;
const helloTimers = new WeakMap(), observed = new WeakSet(), atlasLoads = new Map();
const animatedMedia = new WeakMap();
let mounted = false, preference = 'on', reducedMotion, resizeObserver, visibilityObserver, statusElement;

export function character(kind = 'mino', mood = 'welcome', className = '') {
  kind = aliases[kind] || kind;
  if (!Object.hasOwn(characters, kind)) kind = 'mino';
  mood = moods.has(mood) ? mood : 'welcome';
  const model = characters[kind], human = Boolean(model.role);
  const art = human
    ? `<img class="human-source-image" ${model.motion ? 'data-character-animation ' : ''}src="${escape(asset(`team/${model.motion?.still || model.image}`))}" alt="" width="${model.motion?.width || 1024}" height="${model.motion?.height || 1536}" decoding="async" draggable="false"><span class="human-source-fallback">${rigMarkup(model.role)}</span>`
    : `<img class="character-fallback" src="${escape(asset(model.fallback))}" alt="" loading="lazy" decoding="async">`;
  const position = human ? ` style="--character-idle-delay:-${model.order * 1.37}s;--character-aspect-ratio:${model.motion ? '1/2' : '2/3'}"` : '';
  return `<button type="button" class="mindora-character character-${kind} ${human ? 'character-human character-portrait' : 'character-atlas'} ${model.motion ? 'character-animated-source' : ''} ${escape(className)}" data-character-kind="${kind}" data-character-mood="${mood}" data-character-hello${position} aria-label="${t(`Say hello to ${model.name}`, `Поздороваться: ${model.name}`, `Сәлемдесу: ${model.name}`)}" title="${t(`Say hello to ${model.name}`, `Поздороваться: ${model.name}`, `Сәлемдесу: ${model.name}`)}"><span class="character-frame" aria-hidden="true"><span class="character-art">${art}</span></span><span class="character-reaction" aria-hidden="true">${t('Hi there!', 'Привет!', 'Сәлем!')}</span></button>`;

}

function readPreference() {
  try { return localStorage.getItem(MOTION_KEY) === 'off' ? 'off' : 'on'; }
  catch { return 'on'; }
}

function canAnimate(element) {
  return preference !== 'off' && !reducedMotion?.matches && !document.hidden
    && element.isConnected && element.dataset.characterVisible !== 'false';
}

function syncAnimatedCharacter(element, restart = false) {
  const motion = characters[element.dataset.characterKind]?.motion;
  const image = element.querySelector('[data-character-animation]');
  if (!motion || !image) return;
  const still = asset(`team/${motion.still}`), animation = asset(`team/${motion.image}`);
  let playback = animatedMedia.get(element);
  if (!playback) {
    playback = { enabled: false, failed: false, timer: null };
    animatedMedia.set(element, playback);
    image.addEventListener('load', () => {
      if (image.src !== animation || !playback.enabled || !canAnimate(element)) return;
      clearTimeout(playback.timer);
      element.dataset.characterPlaying = 'true';
      playback.timer = setTimeout(() => {
        image.src = still; element.dataset.characterPlaying = 'false';
        playback.timer = setTimeout(() => syncAnimatedCharacter(element, true), motion.pause);
      }, motion.duration);
    });
    image.addEventListener('error', () => {
      playback.failed = true; playback.enabled = false; clearTimeout(playback.timer);
      element.dataset.characterPlaying = 'false';
      // A failed GIF still leaves the original supplied portrait available.
      const fallback = asset(`team/${characters[element.dataset.characterKind].image}`);
      if (image.src !== fallback) image.src = fallback;
    });
  }
  const enabled = canAnimate(element) && !playback.failed;
  if (!enabled) {
    clearTimeout(playback.timer); playback.enabled = false;
    element.dataset.characterPlaying = 'false';
    if (!playback.failed && image.src !== still) image.src = still;
    return;
  }
  if (playback.enabled && !restart) return;
  clearTimeout(playback.timer); playback.enabled = true;
  const play = () => {
    if (!canAnimate(element) || playback.failed) { syncAnimatedCharacter(element); return; }
    image.src = animation;
    // The load listener times the gesture from actual image readiness, including
    // a cold first request on mobile. No timeout competes with network loading.
  };
  // The original GIF is a single gesture. A static interval keeps it calm and
  // also resets playback without modifying, re-encoding or cache-busting it.
  if (restart && image.src !== still) {
    image.src = still;
    playback.timer = setTimeout(play, 80);
  } else play();
}

function syncAnimatedMedia() {
  document.querySelectorAll('.character-animated-source').forEach(element => syncAnimatedCharacter(element));
}

function updateMotion() {
  const deviceReduced = Boolean(reducedMotion?.matches), enabled = preference !== 'off' && !deviceReduced;
  document.documentElement.dataset.characterAnimations = enabled ? 'on' : 'off';
  document.querySelectorAll('[data-character-motion]').forEach(control => {
    control.setAttribute('role', 'switch'); control.setAttribute('aria-checked', String(enabled));
    if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', 'Character motion');
    control.dataset.state = enabled ? 'on' : 'off'; control.disabled = deviceReduced;
    control.setAttribute('aria-disabled', String(deviceReduced));
  });
  document.querySelectorAll('[data-character-motion-status]').forEach(element => {
    const message = deviceReduced
      ? t('Your device reduces motion.','На устройстве включено уменьшение движения.','Құрылғыда қозғалыс азайтылған.')
      : enabled ? t('Motion is on.','Анимация включена.','Анимация қосулы.')
        : t('Motion is off.','Анимация выключена.','Анимация өшірулі.');
    if (element.textContent !== message) element.textContent = message;
  });
  syncAnimatedMedia();
}

function updateVisibility() {
  document.documentElement.dataset.characterPageHidden = document.hidden ? 'true' : 'false';
  syncAnimatedMedia();
}

function fitFrame(element) {
  const width = element.clientWidth, height = element.clientHeight;
  if (!width || !height) return;
  if (element.classList.contains('character-human')) {
    // Contain the complete original figure, including tablet, hands and shoes.
    const motion = characters[element.dataset.characterKind]?.motion;
    const ratio = motion ? motion.width / motion.height : 2 / 3;
    const portraitWidth = Math.min(width, height * ratio);
    element.style.setProperty('--character-frame-width', `${portraitWidth}px`);
    element.style.setProperty('--character-frame-height', `${portraitWidth / ratio}px`);
  } else element.style.setProperty('--character-frame-size', `${Math.min(width, height)}px`);
}

function applyAtlas(file) {
  const ready = atlasLoads.get(file)?.status === 'ready';
  document.querySelectorAll('.mindora-character').forEach(element => {
    const model = characters[element.dataset.characterKind];
    if (!model || (model.atlas || `team/${model.image}`) !== file) return;
    element.classList.toggle('character-ready', ready);
    element.classList.toggle('character-image-error', atlasLoads.get(file)?.status === 'failed');
  });
}

function loadAtlas(file) {
  if (atlasLoads.has(file)) { applyAtlas(file); return; }
  const image = new Image(), entry = { image, status: 'loading' };
  atlasLoads.set(file, entry);
  image.onload = () => { entry.status = 'ready'; applyAtlas(file); };
  image.onerror = () => { entry.status = 'failed'; applyAtlas(file); };
  image.decoding = 'async'; image.src = asset(file);
}

function discover(root = document) {
  const elements = [];
  if (root instanceof Element && root.matches('.mindora-character')) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('.mindora-character'));
  for (const element of elements) {
    const model = characters[element.dataset.characterKind];
    if (!model) continue;
    if (!observed.has(element)) {
      observed.add(element); fitFrame(element); resizeObserver?.observe(element); visibilityObserver?.observe(element);
    }
    loadAtlas(model.atlas || `team/${model.image}`);
  }
  updateMotion();
}

function release(root) {
  const elements = [];
  if (root instanceof Element && root.matches('.mindora-character')) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('.mindora-character'));
  for (const element of elements) {
    resizeObserver?.unobserve(element); visibilityObserver?.unobserve(element); observed.delete(element);
    const pending = helloTimers.get(element);
    if (pending) { clearTimeout(pending.timer); helloTimers.delete(element); }
    const playback = animatedMedia.get(element);
    if (playback) { clearTimeout(playback.timer); playback.enabled = false; }
  }
}

function greet(element) {
  const previous = helloTimers.get(element);
  if (previous) clearTimeout(previous.timer);
  const baseMood = previous?.baseMood || element.dataset.characterMood || 'welcome';
  const name = characters[element.dataset.characterKind]?.name || 'Mino';
  const index = (previous?.index ?? Number(element.dataset.characterGreeting || 0)) + 1;
  element.dataset.characterGreeting = String(index);
  element.dataset.characterMood = element.classList.contains('character-human') ? 'celebrate' : 'welcome';
  element.classList.remove('character-hello'); void element.offsetWidth; element.classList.add('character-hello');
  syncAnimatedCharacter(element, true);
  const messages = [t('Hi! I’m here with you.', 'Привет! Я рядом.', 'Сәлем! Қасыңдамын.'), t('Little steps count.', 'Продолжай шаг за шагом.', 'Біртіндеп жалғастыр.'), t('You’ve got this!', 'У тебя получится!', 'Қолыңнан келеді!')];
  const message = messages[(index - 1) % messages.length];
  const reaction = element.querySelector('.character-reaction');
  if (reaction) reaction.textContent = message;
  if (statusElement) statusElement.textContent = `${name}: ${message}`;
  const greetingMood = element.dataset.characterMood;
  const timer = setTimeout(() => {
    if (element.isConnected) {
      element.classList.remove('character-hello');
      if (element.dataset.characterMood === greetingMood) element.dataset.characterMood = baseMood;
      element.classList.add('character-restored');
    }
    helloTimers.delete(element);
  }, 1600);
  helloTimers.set(element, { baseMood, timer, index });
}

export function mountCharacters() {
  if (typeof document === 'undefined') return;
  if (mounted) { discover(); return; }
  mounted = true;
  if (!document.getElementById('mindora-character-styles')) {
    const stylesheet = document.createElement('link'); stylesheet.id = 'mindora-character-styles'; stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./characters.css', import.meta.url).href; document.head.append(stylesheet);
  }
  preference = readPreference(); reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.addEventListener?.('change', updateMotion);
  if ('ResizeObserver' in window) resizeObserver = new ResizeObserver(entries => entries.forEach(entry => fitFrame(entry.target)));
  else window.addEventListener('resize', () => document.querySelectorAll('.mindora-character').forEach(fitFrame), { passive: true });
  if ('IntersectionObserver' in window) visibilityObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.dataset.characterVisible = String(entry.isIntersecting);
      syncAnimatedCharacter(entry.target);
    }
  }, { rootMargin: '0px' });
  statusElement = document.createElement('div'); statusElement.className = 'character-live-status'; statusElement.setAttribute('role', 'status'); statusElement.setAttribute('aria-live', 'polite'); document.body.append(statusElement);
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const toggle = target?.closest('[data-character-motion]');
    if (toggle && !toggle.disabled) {
      preference = preference === 'off' ? 'on' : 'off';
      try { localStorage.setItem(MOTION_KEY, preference); } catch { /* Session preference still works. */ }
      updateMotion(); return;
    }
    const element = target?.closest('.mindora-character[data-character-hello]');
    if (element && !element.disabled) greet(element);
  });
  document.addEventListener('visibilitychange', updateVisibility);
  window.addEventListener('storage', event => { if (event.key === MOTION_KEY || event.key === null) { preference = readPreference(); updateMotion(); } });
  window.addEventListener('online', () => {
    for (const [file, entry] of atlasLoads) if (entry.status === 'failed') atlasLoads.delete(file);
    document.querySelectorAll('.character-animated-source').forEach(element => {
      const playback = animatedMedia.get(element);
      if (playback) playback.failed = false;
    });
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
  discover(); updateVisibility();
}
