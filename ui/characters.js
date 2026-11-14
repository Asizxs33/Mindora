import { teamRigSvg } from './team-rigs.js';

/** UI-only portraits. Existing character(kind, mood, className) and mount APIs stay stable.
 * Size the button in your screen CSS; portrait SVGs fit the full body in that space.
 * Mino keeps the original capybara atlas. Human rigs retain their local joint pivots.
 */
const characters = Object.freeze({
  mino: { name: 'Mino', atlas: 'mino-poses-v3.png', fallback: 'capybara.png' },
  mia: { name: 'Mia', rig: 'graphic_designer' },
  sam: { name: 'Sam', rig: 'programmer' },
  leo: { name: 'Leo', rig: 'programmer' },
  artist: { name: 'Ari', rig: 'artist' },
  copywriter: { name: 'Nora', rig: 'copywriter' },
  smm: { name: 'Zoe', rig: 'smm' },
});
const aliases = { programmer: 'leo', designer: 'mia', graphic_designer: 'mia', teacher: 'sam', capybara: 'mino', art: 'artist', writing: 'copywriter', social: 'smm' };
const moods = new Set(['welcome', 'thinking', 'explaining', 'encourage', 'celebrate', 'incorrect']);
const MOTION_KEY = 'mindora.characters.motion.v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
const asset = file => new URL(`./assets/${file}`, import.meta.url).href;
const helloTimers = new WeakMap();
const observed = new WeakSet();
const rigs = new Map();
let instance = 0, rigSequence = 0, mounted = false, preference = 'on', reducedMotion, resizeObserver, visibilityObserver, statusElement;
let atlasLoad, frameRequest = 0, lastFrame = 0, elapsed = 0;

export function character(kind = 'mino', mood = 'welcome', className = '') {
  kind = aliases[kind] || kind;
  if (!Object.hasOwn(characters, kind)) kind = 'mino';
  mood = moods.has(mood) ? mood : 'welcome';
  const model = characters[kind];
  const rig = Boolean(model.rig);
  const art = rig ? teamRigSvg(model.rig, `mindora-rig-${++instance}`) : `<img class="character-fallback" src="${escape(asset(model.fallback))}" alt="" loading="lazy" decoding="async">`;
  return `<button type="button" class="mindora-character character-${kind} ${rig ? 'character-rig' : 'character-atlas'} ${escape(className)}" data-character-kind="${kind}" data-character-mood="${mood}" data-character-hello aria-label="Say hello to ${model.name}" title="Say hello to ${model.name}"><span class="character-frame" aria-hidden="true"><span class="character-art">${art}</span></span><span class="character-reaction" aria-hidden="true">Hi there!</span></button>`;
}

function readPreference() {
  try { return localStorage.getItem(MOTION_KEY) === 'off' ? 'off' : 'on'; }
  catch { return 'on'; }
}
const motionEnabled = () => preference !== 'off' && !reducedMotion?.matches;

function updateMotion() {
  const deviceReduced = Boolean(reducedMotion?.matches), enabled = motionEnabled();
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
    const message = deviceReduced ? 'Your device’s reduced-motion setting is active.' : enabled ? 'Gentle movement is on.' : 'Movement is off. Your buddies are still here.';
    if (element.textContent !== message) element.textContent = message;
  });
  for (const rig of rigs.values()) drawRig(rig, elapsed, 1, !enabled);
  scheduleMotion();
}

function updateVisibility() {
  document.documentElement.dataset.characterPageHidden = document.hidden ? 'true' : 'false';
  scheduleMotion();
}

function fitFrame(element) {
  const width = element.clientWidth, height = element.clientHeight;
  if (!width || !height) return;
  if (element.classList.contains('character-rig')) {
    const box = element.querySelector('svg')?.viewBox?.baseVal;
    const ratio = box?.width > 0 && box?.height > 0 ? box.width / box.height : 400 / 850;
    const portraitWidth = Math.min(width, height * ratio);
    element.style.setProperty('--character-portrait-ratio', String(ratio));
    element.style.setProperty('--character-frame-width', `${portraitWidth}px`);
    element.style.setProperty('--character-frame-height', `${portraitWidth / ratio}px`);
  } else element.style.setProperty('--character-frame-size', `${Math.min(width, height)}px`);
}

function applyAtlas() {
  document.querySelectorAll('.character-mino').forEach(element => element.classList.toggle('character-ready', atlasLoad?.status === 'ready'));
}
function loadAtlas() {
  if (atlasLoad) { applyAtlas(); return; }
  const image = new Image();
  atlasLoad = { status: 'loading', image };
  image.onload = () => { atlasLoad.status = 'ready'; applyAtlas(); };
  image.onerror = () => { atlasLoad.status = 'failed'; applyAtlas(); };
  image.decoding = 'async';
  image.src = asset(characters.mino.atlas);
}

function rigFor(element) {
  const model = characters[element.dataset.characterKind];
  const parts = [...element.querySelectorAll('[data-rig-part]')].map(node => {
    const transform = node.getAttribute('transform') || '';
    const match = transform.match(/^translate\(([-\d.]+)[ ,]+([-\d.]+)\) rotate\(([-\d.]+)\)$/);
    return match ? { node, id: node.dataset.rigPart, x: Number(match[1]), y: Number(match[2]), base: Number(match[3]), current: Number(match[3]) } : null;
  }).filter(Boolean);
  const face = Object.fromEntries([...element.querySelectorAll('[data-rig-face]')].map(node => [node.dataset.rigFace, node]));
  return { element, type: model.rig, parts, face, body: element.querySelector('[data-rig-part="body"]'), visible: true, phase: (++rigSequence % 11) * .48, mood: '' };
}

function drawRig(rig, time, blend = .12, staticPose = false) {
  const { element, type, face } = rig;
  let mood = element.dataset.characterMood || 'welcome';
  if (!moods.has(mood)) mood = 'welcome';
  const hello = element.classList.contains('character-hello');
  const t = staticPose ? 0 : time / 1000 + rig.phase;
  const leftFree = type === 'smm' || type === 'artist';
  const free = leftFree ? 'left' : 'right';
  const artist = type === 'artist';
  const wave = staticPose ? 0 : Math.sin(t * (hello ? 12 : 4.2));
  const breathe = staticPose ? 0 : Math.sin(t * 1.5);
  const target = {};
  if (mood === 'welcome') {
    target[`${free}-arm`] = artist ? 126 : 134;
    target[`${free}-forearm`] = artist ? 15 + wave * 5 : -30 + wave * (hello ? 18 : 7);
  } else if (mood === 'thinking') {
    target[`${free}-arm`] = artist ? 111 : leftFree ? -95 : 95;
    target[`${free}-forearm`] = artist ? 8 : leftFree ? -90 : 90;
  } else if (mood === 'celebrate') {
    target[`${free}-arm`] = artist ? 132 : 141 + wave * 3;
    target[`${free}-forearm`] = artist ? 16 + wave * 5 : -29 + wave * 7;
  } else {
    target[`${free}-arm`] = artist ? 120 : leftFree ? 83 : 79;
    target[`${free}-forearm`] = artist ? 14 + breathe * 3 : (leftFree ? -16 : 12) + breathe * 4;
  }
  for (const part of rig.parts) {
    let angle = target[part.id] ?? part.base;
    if (part.id === 'head') angle += mood === 'thinking' ? 7 + breathe : mood === 'incorrect' ? 3 + breathe : mood === 'celebrate' ? -2 + wave : breathe * 1.6;
    else if (part.id.includes('lower-leg')) angle += breathe * .45;
    else if (part.id.endsWith('-leg')) angle += breathe * (part.id.startsWith('left') ? .7 : -.7);
    else if (!(part.id in target)) angle += breathe * 1.2;
    part.current += (angle - part.current) * blend;
    // Retain the source translation at every shoulder, elbow, hip, knee and neck.
    part.node.setAttribute('transform', `translate(${part.x} ${part.y}) rotate(${part.current.toFixed(3)})`);
  }
  const lift = staticPose ? 0 : mood === 'celebrate' ? -Math.abs(Math.sin(t * 3)) * 8 : breathe * -3;
  rig.body?.setAttribute('transform', `translate(0 ${lift.toFixed(2)})`);
  const blinkTime = (t + rig.phase * 2) % 5.6;
  const blink = !staticPose && blinkTime > 5.28 && blinkTime < 5.45;
  const happy = mood === 'celebrate' || hello;
  for (const side of ['left', 'right']) {
    face[`${side}-eye`]?.setAttribute('ry', happy ? '0' : blink ? '.7' : mood === 'thinking' ? '6.3' : '8');
    face[`${side}-smile`]?.setAttribute('opacity', happy ? '1' : '0');
  }
  if (rig.mood !== mood || rig.hello !== hello) {
    const mouth = face.mouth;
    mouth?.setAttribute('d', happy ? 'M-23-73 Q0-64 24-73 Q20-42 0-42 Q-20-42-23-73Z' : mood === 'thinking' ? 'M-12-68 Q0-72 12-68' : mood === 'incorrect' ? 'M-17-69 Q0-60 18-70' : 'M-19-71 Q1-53 22-73');
    mouth?.setAttribute('fill', happy ? '#20110f' : 'none');
    face.brows?.setAttribute('d', mood === 'thinking' ? 'M-45-146 Q-31-154-18-149 M18-141 Q32-145 45-140' : mood === 'incorrect' ? 'M-45-142 Q-31-150-18-149 M18-149 Q32-150 45-142' : 'M-45-143 Q-31-149-18-142 M18-142 Q32-149 45-143');
    rig.mood = mood; rig.hello = hello;
  }
}

function canAnimate() { return motionEnabled() && !document.hidden && [...rigs.values()].some(rig => rig.visible && rig.element.isConnected); }
function tick(now) {
  frameRequest = 0;
  if (!canAnimate()) { lastFrame = 0; return; }
  const delta = lastFrame ? Math.min(now - lastFrame, 48) : 16;
  lastFrame = now; elapsed += delta;
  const blend = 1 - Math.pow(.85, delta / 16.67);
  for (const rig of rigs.values()) if (rig.visible && rig.element.isConnected) drawRig(rig, elapsed, blend);
  frameRequest = requestAnimationFrame(tick);
}
function scheduleMotion() {
  if (canAnimate()) { if (!frameRequest) frameRequest = requestAnimationFrame(tick); }
  else { if (frameRequest) cancelAnimationFrame(frameRequest); frameRequest = 0; lastFrame = 0; }
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
      if (model.rig) {
        const rig = rigFor(element); rigs.set(element, rig); drawRig(rig, elapsed, 1, !motionEnabled());
      }
    }
    if (model.atlas) loadAtlas();
  }
  updateMotion();
}

function release(root) {
  const elements = [];
  if (root instanceof Element && root.matches('.mindora-character')) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('.mindora-character'));
  for (const element of elements) {
    resizeObserver?.unobserve(element); visibilityObserver?.unobserve(element); observed.delete(element); rigs.delete(element);
    const pending = helloTimers.get(element);
    if (pending) { clearTimeout(pending.timer); helloTimers.delete(element); }
  }
  scheduleMotion();
}

function greet(element) {
  const previous = helloTimers.get(element);
  if (previous) clearTimeout(previous.timer);
  const baseMood = previous?.baseMood || element.dataset.characterMood || 'welcome';
  const name = characters[element.dataset.characterKind]?.name || 'Mino';
  const index = (previous?.index ?? Number(element.dataset.characterGreeting || 0)) + 1;
  element.dataset.characterGreeting = String(index);
  element.dataset.characterMood = 'welcome';
  element.classList.remove('character-hello');
  void element.offsetWidth;
  element.classList.add('character-hello');
  const messages = ['Hi! I’m here with you.', 'Little steps count.', 'You’ve got this!'];
  const message = messages[(index - 1) % messages.length];
  const reaction = element.querySelector('.character-reaction');
  if (reaction) reaction.textContent = message;
  if (statusElement) statusElement.textContent = `${name}: ${message}`;
  const rig = rigs.get(element);
  if (rig) drawRig(rig, elapsed, motionEnabled() ? .18 : 1, !motionEnabled());
  const timer = setTimeout(() => {
    if (element.isConnected) {
      element.classList.remove('character-hello');
      // A controller-driven expression changed during the hello must win.
      if (element.dataset.characterMood === 'welcome') element.dataset.characterMood = baseMood;
      element.classList.add('character-restored');
      const currentRig = rigs.get(element);
      if (currentRig) drawRig(currentRig, elapsed, motionEnabled() ? .18 : 1, !motionEnabled());
    }
    helloTimers.delete(element);
  }, 1800);
  helloTimers.set(element, { baseMood, timer, index });
  scheduleMotion();
}

export function mountCharacters() {
  if (typeof document === 'undefined') return;
  if (mounted) { discover(); return; }
  mounted = true;
  if (!document.getElementById('mindora-character-styles')) {
    const stylesheet = document.createElement('link'); stylesheet.id = 'mindora-character-styles'; stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./characters.css', import.meta.url).href; document.head.append(stylesheet);
  }
  preference = readPreference();
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.addEventListener?.('change', updateMotion);
  if ('ResizeObserver' in window) resizeObserver = new ResizeObserver(entries => entries.forEach(entry => fitFrame(entry.target)));
  else window.addEventListener('resize', () => document.querySelectorAll('.mindora-character').forEach(fitFrame), { passive: true });
  if ('IntersectionObserver' in window) visibilityObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const rig = rigs.get(entry.target); if (rig) rig.visible = entry.isIntersecting;
      entry.target.dataset.characterVisible = String(entry.isIntersecting);
    }
    scheduleMotion();
  }, { rootMargin: '80px' });
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
  window.addEventListener('online', () => { if (atlasLoad?.status === 'failed') atlasLoad = null; discover(); });
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const rig = rigs.get(record.target);
        if (rig && !motionEnabled()) drawRig(rig, elapsed, 1, true);
        continue;
      }
      for (const node of record.removedNodes) if (node instanceof Element) release(node);
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.mindora-character,[data-character-motion],[data-character-motion-status]') || node.querySelector('.mindora-character,[data-character-motion],[data-character-motion-status]')) discover(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-character-mood'] });
  discover(); updateVisibility();
}
