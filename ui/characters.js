/** Supplied Mindora Design Pack: real teaching gestures and expression poses.
 * GIF playback is explicitly stopped for reduced motion, hidden tabs and offscreen
 * mentors. Supplied SVG rigs provide a network-error fallback. State stays in core.
 */
import { t } from './language.js';
import { rigMarkup } from './character-rigs.js';
import { interactWithMentor } from './mentor-interactions.js';

// Each WebP keeps the authored gesture and a resting frame in one native loop.
const pose = (stem, width, height, directory = 'design-pack') => ({
  image: stem + '.webp', still: stem + '.png', width, height, directory,
});
function humanPoses(name, action, width, height) {
  const gesture = pose(name + '-' + action, width, height);
  return Object.fromEntries(['welcome', 'thinking', 'celebrate', 'explaining', 'encourage', 'incorrect'].map(mood => [mood, gesture]));
}
const minoScene = (stem, width = 288, height = 288) => pose(stem, width, height, 'characters/mino-scenes');
const minoIdea = minoScene('02-bright-idea', 288, 512);
const characters = Object.freeze({
  mino: { name: 'Mino', atlas: 'mino-poses-v3.png', fallback: 'capybara.png', poses: {
    welcome: minoScene('03-learning-map'), thinking: minoScene('01-listening'),
    explaining: minoIdea, celebrate: minoScene('07-applause'),
    encourage: minoScene('08-encouragement'), incorrect: minoScene('08-encouragement'),
    listening: minoScene('01-listening'),
    idea: minoIdea,
    map: minoScene('03-learning-map'),
    waiting: minoScene('04-patient-wait'),
    drawing: minoScene('05-draw-a-poster'),
    chart: minoScene('06-show-a-chart'),
    applause: minoScene('07-applause'),
    encouragement: minoScene('08-encouragement'),
    break: minoScene('09-tea-break'),
    trophy: minoScene('10-trophy'),
  } },
  mia: { name: 'Mia', role: 'graphic_designer', image: 'graphic-designer-v3.png', order: 0,
    poses: humanPoses('mia', 'pointing', 360, 720) },
  sam: { name: 'Sam', role: 'programmer', image: 'programmer-v3.png', order: 1, poses: humanPoses('sam', 'keypress', 380, 768) },
  leo: { name: 'Sam', role: 'programmer', image: 'programmer-v3.png', order: 1, poses: humanPoses('sam', 'keypress', 380, 768) },
  artist: { name: 'Ari', role: 'artist', image: 'artist-v3.png', order: 2, poses: humanPoses('ari', 'brush', 450, 768) },
  copywriter: { name: 'Nora', role: 'copywriter', image: 'copywriter-v3.png', order: 3, poses: humanPoses('nora', 'writing', 450, 768) },
  smm: { name: 'Zoe', role: 'smm', image: 'smm-v3.png', order: 4, poses: humanPoses('zoe', 'wave', 420, 768) },
});
const aliases = { programmer: 'leo', designer: 'mia', graphic_designer: 'mia', teacher: 'sam', capybara: 'mino', art: 'artist', writing: 'copywriter', social: 'smm' };
const MOTION_KEY = 'mindora.characters.motion.v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
const asset = file => new URL(`./assets/${file}`, import.meta.url).href;
const poseAsset = (motion, file) => asset(`${motion.directory || 'design-pack'}/${file}`);
const motionFor = element => characters[element.dataset.characterKind]?.poses?.[element.dataset.characterMood];
const helloTimers = new WeakMap(), observed = new Set();
const animatedMedia = new WeakMap();
let mounted = false, preference = 'on', reducedMotion, resizeObserver, visibilityObserver, statusElement;

export function character(kind = 'mino', mood = 'welcome', className = '') {
  kind = aliases[kind] || kind;
  if (!Object.hasOwn(characters, kind)) kind = 'mino';
  const model = characters[kind];
  mood = Object.hasOwn(model.poses, mood) ? mood : 'welcome';
  const human = Boolean(model.role), motion = model.poses[mood];
  const art = `<img class="${human ? 'human-source-image' : 'character-fallback'}" data-character-animation src="${escape(poseAsset(motion, motion.still))}" alt="" width="${motion.width}" height="${motion.height}" loading="lazy" decoding="async" draggable="false">${human ? `<span class="human-source-fallback">${rigMarkup(model.role)}</span>` : ''}`;
  const label = t(`Talk to ${model.name}`, `Поговорить с ${model.name}`, `${model.name} тәлімгерімен сөйлесу`);
  return `<button type="button" class="mindora-character character-${kind} ${human ? 'character-human character-portrait' : 'character-capybara'} character-animated-source ${escape(className)}" data-character-kind="${kind}" data-character-mood="${mood}" data-character-hello style="--character-aspect-ratio:${motion.width}/${motion.height}" aria-label="${label}" title="${label}"><span class="character-frame" aria-hidden="true"><span class="character-art">${art}</span></span><span class="character-reaction" aria-hidden="true">${t('Hi there!', 'Привет!', 'Сәлем!')}</span></button>`;
}

function readPreference() {
  try { return localStorage.getItem(MOTION_KEY) === 'off' ? 'off' : 'on'; } catch { return 'on'; }
}
function canAnimate(element) {
  return preference !== 'off' && !reducedMotion?.matches && !document.hidden && element.isConnected
    && element.dataset.characterVisible === 'true';
}
function fitFrame(element) {
  const width = element.clientWidth, height = element.clientHeight;
  if (!width || !height) return;
  const motion = motionFor(element), ratio = motion ? motion.width / motion.height : 1;
  const size = Math.min(width, height * ratio);
  element.style.setProperty('--character-frame-width', `${size}px`);
  element.style.setProperty('--character-frame-height', `${size / ratio}px`);
  element.style.setProperty('--character-frame-size', `${Math.min(width, height)}px`);
}
function syncAnimatedCharacter(element, restart = false) {
  const motion = motionFor(element), image = element.querySelector('[data-character-animation]');
  if (!motion || !image) return;
  const still = poseAsset(motion, motion.still), animation = poseAsset(motion, motion.image);
  let playback = animatedMedia.get(element);
  if (!playback) {
    playback = { enabled: false, failed: false, retries: 0, timer: null, retryTimer: null, animation: '', still: '', motion: null };
    animatedMedia.set(element, playback);
    image.addEventListener('load', () => {
      if (image.naturalWidth > 0) element.classList.remove('character-image-error');
      if (image.src !== playback.animation || !playback.enabled || !canAnimate(element)) return;
      clearTimeout(playback.timer); clearTimeout(playback.retryTimer); playback.retryTimer = null;
      playback.retries = 0; element.dataset.characterPlaying = 'true';
    });
    image.addEventListener('error', () => {
      clearTimeout(playback.timer); clearTimeout(playback.retryTimer); playback.retryTimer = null;
      playback.failed = true; playback.enabled = false;
      element.dataset.characterPlaying = 'false';
      if (image.src === playback.animation) {
        image.src = playback.still;
        syncAnimatedCharacter(element);
        return;
      }
      playback.retries = 2;
      const model = characters[element.dataset.characterKind];
      const fallback = asset(model.role ? `team/${model.image}` : model.fallback);
      if (image.src !== fallback) image.src = fallback;
      else element.classList.add('character-image-error');
    });
  }
  if (playback.animation !== animation) {
    clearTimeout(playback.timer); clearTimeout(playback.retryTimer); playback.retryTimer = null;
    playback.enabled = false; playback.failed = false; playback.retries = 0;
    playback.animation = animation; playback.still = still; playback.motion = motion;
    image.src = still; image.width = motion.width; image.height = motion.height;
    element.classList.remove('character-image-error'); fitFrame(element);
  }
  if (!canAnimate(element) || playback.failed) {
    clearTimeout(playback.timer); playback.enabled = false; element.dataset.characterPlaying = 'false';
    if (!playback.failed && image.src !== still) image.src = still;
    if (!canAnimate(element)) { clearTimeout(playback.retryTimer); playback.retryTimer = null; }
    // Recover from a brief connection failure, without retrying a broken asset
    // forever or downloading it after the mentor has scrolled offscreen.
    else if (playback.retries < 2 && !playback.retryTimer) {
      playback.retryTimer = setTimeout(() => {
        playback.retryTimer = null; playback.retries++; playback.failed = false;
        syncAnimatedCharacter(element, true);
      }, 2000 * (playback.retries + 1));
    }
    return;
  }
  if (playback.enabled && !restart) return;
  clearTimeout(playback.timer); clearTimeout(playback.retryTimer); playback.retryTimer = null; playback.enabled = true;
  const play = () => {
    if (!canAnimate(element) || playback.failed) { syncAnimatedCharacter(element); return; }
    image.src = playback.animation;
  };
  if (restart && image.src !== still) { image.src = still; playback.timer = setTimeout(play, 80); }
  else play();
}
function updateMotion() {
  const deviceReduced = Boolean(reducedMotion?.matches), enabled = preference !== 'off' && !deviceReduced;
  document.documentElement.dataset.characterAnimations = enabled ? 'on' : 'off';
  document.querySelectorAll('[data-character-motion]').forEach(control => {
    control.setAttribute('role', 'switch'); control.setAttribute('aria-checked', String(enabled));
    if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', t('Character motion', 'Анимация персонажей', 'Кейіпкерлер анимациясы'));
    control.dataset.state = enabled ? 'on' : 'off'; control.disabled = deviceReduced;
    control.setAttribute('aria-disabled', String(deviceReduced));
  });
  document.querySelectorAll('[data-character-motion-status]').forEach(element => {
    const message = deviceReduced ? t('Your device reduces motion.', 'На устройстве включено уменьшение движения.', 'Құрылғыда қозғалыс азайтылған.')
      : enabled ? t('Motion is on.', 'Анимация включена.', 'Анимация қосулы.') : t('Motion is off.', 'Анимация выключена.', 'Анимация өшірулі.');
    if (element.textContent !== message) element.textContent = message;
  });
  observed.forEach(element => syncAnimatedCharacter(element));
}
function discover(root = document) {
  const elements = [];
  if (root instanceof Element && root.matches('.mindora-character')) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('.mindora-character'));
  for (const element of elements) {
    if (observed.has(element)) continue;
    observed.add(element); fitFrame(element); resizeObserver?.observe(element);
    // Never download an offscreen GIF just because a screen was rendered.
    element.dataset.characterVisible = visibilityObserver ? 'false' : String(Boolean(element.getClientRects().length));
    visibilityObserver?.observe(element);
  }
  updateMotion();
}
function release(root) {
  for (const element of observed) {
    if (root !== element && !root.contains(element)) continue;
    resizeObserver?.unobserve(element); visibilityObserver?.unobserve(element); observed.delete(element);
    clearTimeout(animatedMedia.get(element)?.timer); clearTimeout(animatedMedia.get(element)?.retryTimer); animatedMedia.delete(element);
    clearTimeout(helloTimers.get(element)); helloTimers.delete(element);
  }
}
function visibleDialogue(element) {
  const scenes = [
    ['.course-home-heading', '.course-home-greeting'],
    ['.guided-content,.learning-hub-guide,.quiet-home', '.guided-dialogue'],
    ['.return-review-tutor', '.return-review-speech'],
    ['.roadmap-tutor', '.roadmap-tutor-speech'],
    ['.roadmap-wizard-intro', ':scope > div:last-child'],
    ['.account-guide-scene', '.account-intro-copy'],
    ['.course-path-header', ':scope > div'],
    ['.resume-mentor', ':scope > span'],
  ];
  for (const [container, selector] of scenes) {
    const dialogue = element.closest(container)?.querySelector(selector);
    if (dialogue && !dialogue.hidden && dialogue.getClientRects().length) return dialogue;
  }
  return null;
}
function greet(element) {
  clearTimeout(helloTimers.get(element));
  const name = characters[element.dataset.characterKind]?.name || 'Mino';
  // Dialogue is present from first paint. A tap acknowledges that same message,
  // rather than placing a second floating bubble across the lesson or form.
  const dialogue = visibleDialogue(element);
  element.toggleAttribute('data-character-has-dialogue', Boolean(dialogue));
  const message = dialogue?.textContent.trim() || t('Hi! One small step at a time.', 'Привет! Давай шаг за шагом.', 'Сәлем! Бірге біртіндеп үйренеміз.');
  element.querySelector('.character-reaction').textContent = message;
  statusElement.textContent = `${name}: ${message}`;
  dialogue?.classList.add('character-dialogue-speaking');
  element.classList.add('character-hello'); syncAnimatedCharacter(element, true);
  helloTimers.set(element, setTimeout(() => {
    element.classList.remove('character-hello');
    dialogue?.classList.remove('character-dialogue-speaking');
  }, 2200));
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
  else window.addEventListener('resize', () => observed.forEach(fitFrame), { passive: true });
  if ('IntersectionObserver' in window) visibilityObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.dataset.characterVisible = String(entry.isIntersecting);
      syncAnimatedCharacter(entry.target);
    }
  });
  statusElement = document.createElement('div'); statusElement.className = 'character-live-status'; statusElement.setAttribute('role', 'status'); statusElement.setAttribute('aria-live', 'polite'); document.body.append(statusElement);
  function respondOnHome(field) {
    const home = field.closest('.course-home');
    if (!home || !['goal-input', 'time-select'].includes(field.id)) return;
    const mino = home.querySelector('.course-home-mino');
    const speech = home.querySelector('.course-home-greeting');
    const choosingTime = field.id === 'time-select';
    const hasGoal = !choosingTime && field.value.trim().length >= 3;
    const mood = choosingTime ? 'map' : hasGoal ? 'idea' : 'listening';
    const message = choosingTime
      ? t(`Let’s try ${field.value} minutes.`, `Начнём с ${field.value} минут.`, `${field.value} минуттан бастайық.`)
      : hasGoal ? t('Let’s make a plan!', 'Составим план!', 'Жоспар құрайық!')
        : t('I’m listening.', 'Я слушаю.', 'Тыңдап тұрмын.');
    if (!mino || !speech) return;
    if (mino.dataset.characterMood !== mood) mino.dataset.characterMood = mood;
    if (speech.textContent !== message) speech.textContent = message;
  }
  for (const event of ['focusin', 'input', 'change']) {
    document.addEventListener(event, e => { if (e.target instanceof Element) respondOnHome(e.target); });
  }
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const toggle = target?.closest('[data-character-motion]');
    if (toggle && !toggle.disabled) {
      preference = preference === 'off' ? 'on' : 'off';
      try { localStorage.setItem(MOTION_KEY, preference); } catch { /* Session preference still works. */ }
      updateMotion(); return;
    }
    if (target && interactWithMentor(target, {
      animate: preference !== 'off' && !reducedMotion?.matches,
      announce: message => { statusElement.textContent = message; },
      react: element => syncAnimatedCharacter(element, true),
    })) return;
    const element = target?.closest('.mindora-character[data-character-hello]');
    if (element && !element.disabled) greet(element);
  });
  const visibility = () => {
    document.documentElement.dataset.characterPageHidden = String(document.hidden); updateMotion();
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('storage', event => { if (event.key === MOTION_KEY || event.key === null) { preference = readPreference(); updateMotion(); } });
  window.addEventListener('online', () => {
    observed.forEach(element => { const playback = animatedMedia.get(element); if (playback) playback.failed = false; });
    updateMotion();
  });
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') { syncAnimatedCharacter(record.target); continue; }
      for (const node of record.removedNodes) if (node instanceof Element) release(node);
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.mindora-character,[data-character-motion],[data-character-motion-status]') || node.querySelector('.mindora-character,[data-character-motion],[data-character-motion-status]')) discover(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-character-mood'] });
  discover(); visibility();
}
