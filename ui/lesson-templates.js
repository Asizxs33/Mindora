import { escapeHtml as esc } from '../core/engine.js';
import { LESSON_ASSESSMENT_LIMITS } from '../core/lesson-assessment.js';
import { mentorScene } from './mentor-scenes.js';
export { mentorForTopic } from '../core/subject-mentor.js';
export { mentorScene } from './mentor-scenes.js';
import { icon } from './icons.js';
import { t } from './language.js';
import { normalizeLearningScene, renderLearningScene, learningSceneFrame } from './learning-scenes.js';

// Presentation only. A course controller owns progression, persistence and credit.
// Content is plain data, never model-generated HTML or executable code.
export const LESSON_TEMPLATES = Object.freeze({
  theory: { label: 'One idea', fields: ['body'] },
  illustration: { label: 'Picture & explanation', fields: ['image', 'body'] },
  comparison: { label: 'Worked example', fields: ['before', 'after', 'explanation'] },
  choice: { label: 'Choose one', fields: ['options', 'answer'] },
  'multi-choice': { label: 'Choose several', fields: ['options', 'answers'] },
  order: { label: 'Put in order', fields: ['items', 'answer'] },
  match: { label: 'Match pairs', fields: ['pairs'] },
  'gap-fill': { label: 'Complete a sentence', fields: ['before', 'after', 'accepted'] },
  practice: { label: 'Make something', fields: ['body', 'criterion'] },
  recap: { label: 'Remember & continue', fields: ['points'] },
});

function safeImage(value) {
  if (typeof value !== 'string') return '';
  if (/^\/ui\/assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
const list = value => Array.isArray(value) ? value : [];
const text = value => esc(String(value ?? ''));
const heading = value => value ? `<h3>${text(value)}</h3>` : '';
const disabled = value => value ? ' disabled' : '';
// Preserve paragraphs and line breaks without interpreting model text as HTML.
const readingText = value => String(value ?? '').split(/\n\s*\n/).filter(part => part.trim())
  .map(part => `<p>${text(part).replace(/\n/g, '<br>')}</p>`).join('');

function sourceFigures(images) {
  return images.map(image => {
    const src = safeImage(image?.url);
    const alt = String(image?.alt ?? '').replace(/^Image\s+\d+:\s*/i, '');
    return src ? `<figure class="lesson-source-figure"><img src="${text(src)}" alt="${text(alt)}" loading="lazy" referrerpolicy="no-referrer"></figure>` : '';
  }).join('');
}

// The studio validates standalone examples. The production API validates entire lessons.
export function normalizeLessonTemplate(raw) {
  if (!raw || !Object.hasOwn(LESSON_TEMPLATES, raw.type)) return null;
  const clean = (value, max = 1200) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
  const title = clean(raw.title, 160);
  if (!title) return null;
  const block = { type: raw.type, title };
  for (const name of ['intro', 'body', 'before', 'after', 'explanation', 'criterion', 'beforeLabel', 'afterLabel']) {
    if (raw[name] !== undefined) { const value = clean(raw[name]); if (!value) return null; block[name] = value; }
  }
  if (['mino', 'mia', 'sam', 'artist', 'copywriter', 'smm'].includes(raw.mentor)) block.mentor = raw.mentor;
  if (raw.id && /^[\w-]{1,80}$/.test(raw.id)) block.id = raw.id;
  const strings = (value, min = 1, max = 8) => Array.isArray(value) && value.length >= min && value.length <= max && value.every(v => clean(v, 400)) ? value.map(v => v.trim()) : null;
  const indices = (value, length) => Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every(i => Number.isInteger(i) && i >= 0 && i < length);
  switch (raw.type) {
    case 'theory': if (!block.body) return null; break;
    case 'illustration': {
      if (raw.scene !== undefined) {
        if (raw.image || raw.images) return null;
        block.scene = normalizeLearningScene(raw.scene);
        if (!block.scene || !block.body) return null;
        break;
      }
      const url = safeImage(raw.image?.url), alt = clean(raw.image?.alt, 240);
      if (!url || !alt || !block.body) return null; block.image = { url, alt }; break;
    }
    case 'comparison': if (!block.before || !block.after || !block.explanation) return null; break;
    case 'choice': case 'multi-choice': {
      const options = strings(raw.options, 2, 6);
      if (!options || new Set(options).size !== options.length || !block.explanation) return null;
      block.options = options;
      if (raw.type === 'choice') { if (!indices([raw.answer], options.length)) return null; block.answer = raw.answer; }
      else { if (!indices(raw.answers, options.length)) return null; block.answers = [...raw.answers]; }
      break;
    }
    case 'order': {
      const items = strings(raw.items, 2, 6);
      if (!items || !block.explanation || !indices(raw.answer, items.length) || raw.answer.length !== items.length) return null;
      block.items = items; block.answer = [...raw.answer]; break;
    }
    case 'match': {
      if (!Array.isArray(raw.pairs) || raw.pairs.length < 2 || raw.pairs.length > 6 || !block.explanation || raw.pairs.some(p => !clean(p?.left, 200) || !clean(p?.right, 200))) return null;
      block.pairs = raw.pairs.map(p => ({ left: p.left.trim(), right: p.right.trim() }));
      if (new Set(block.pairs.map(p => p.left)).size !== block.pairs.length || new Set(block.pairs.map(p => p.right)).size !== block.pairs.length) return null;
      break;
    }
    case 'gap-fill': block.accepted = strings(raw.accepted, 1, 10); if (!block.accepted || !block.before || !block.after || !block.explanation) return null; break;
    case 'practice': if (!block.body || !block.criterion) return null; break;
    case 'recap': block.points = strings(raw.points, 1, 5); if (!block.points) return null; break;
  }
  return block;
}

export function renderLessonTemplate(block, state = {}, { external = false, mentor = 'mino', busy = false, sceneMood } = {}) {
  const type = Object.hasOwn(LESSON_TEMPLATES, block?.type) ? block.type : 'theory';
  const locked = busy || state.correct === true;
  const mood = state.checked ? state.correct === true ? 'celebrate' : state.correct === false ? 'encourage' : 'explaining' : ['choice', 'multi-choice', 'order', 'match', 'gap-fill'].includes(type) ? 'thinking' : 'explaining';
  const speaker = block.mentor || mentor;
  const prompt = block.prompt || block.title;
  const hints = {
    // Reading screens already show this material; only exercises need a hint.
    practice: block.criterion,
    choice: t('Read every option. Which one best answers the question?', 'Прочитай все варианты. Какой точнее отвечает на вопрос?', 'Барлық нұсқаны оқы. Қайсысы сұраққа дәл жауап береді?'),
    'multi-choice': t('More than one can fit. Check each option separately.', 'Подходят несколько ответов. Проверь каждый отдельно.', 'Бірнеше жауап сәйкес келеді. Әрқайсысын жеке тексер.'),
    order: t('Find the first action. Then ask what must happen next.', 'Найди первое действие, затем следующее.', 'Алғашқы әрекетті тап. Одан кейін не істеу керек?'),
    match: t('Start with a pair you know, then compare the remaining meanings.', 'Начни со знакомой пары, затем сравни остальные значения.', 'Өзің білетін жұптан баста, содан кейін қалған мағыналарды салыстыр.'),
    'gap-fill': t('Read the whole sentence. What connects the two parts?', 'Прочитай предложение целиком. Что связывает две части?', 'Сөйлемді толық оқы. Екі бөлікті не байланыстырады.'),
  };
  const hint = state.checked && block.explanation ? block.explanation : hints[type] || '';
  const scene = prompt || block.intro ? mentorScene(speaker, sceneMood ?? mood, `${heading(prompt)}${block.intro ? `<p>${text(block.intro)}</p>` : ''}`, '', { hint, focus: t('Show me', 'Покажи', 'Көрсетші') }) : '';
  let content = '';
  if (type === 'theory') content = `<div class="ai-lesson-instruction learning-answer">${readingText(block.body)}</div>${sourceFigures(list(block.images))}`;
  if (type === 'illustration') {
    const images = block.image ? [block.image] : list(block.images);
    content = `${images.length ? sourceFigures(images) : renderLearningScene(block.scene)}${block.body ? `<div class="ai-lesson-instruction learning-answer">${text(block.body)}</div>` : ''}`;
  }
  if (type === 'comparison') {
    const exampleText = value => block.codeExample ? `<pre class="lesson-example-code"><code>${text(value)}</code></pre>` : `<div class="learning-answer">${text(value)}</div>`;
    const example = `<div class="ai-lesson-example${block.codeExample ? ' is-code-example' : ''}"><section class="ai-lesson-example-input">${heading(block.beforeLabel || t('Starting point', 'Исходные данные', 'Бастапқы деректер'))}${exampleText(block.before)}</section><section class="ai-lesson-example-output">${heading(block.afterLabel || t('Worked result', 'Готовый результат', 'Дайын нәтиже'))}${exampleText(block.after)}</section></div>`;
    content = `${block.sceneFrame ? learningSceneFrame(block.sceneFrame, example) : example}${block.explanation && block.explanation !== block.intro ? `<p class="template-explanation">${text(block.explanation)}</p>` : ''}`;
  }
  if (type === 'choice' || type === 'multi-choice') {
    const selected = type === 'choice' ? [state.choice] : list(state.selected);
    content = `<div class="ai-lesson-choices" role="group" aria-label="${text(prompt)}">${list(block.options).map((option, i) => {
      const active = selected.includes(i);
      const resultClass = active && state.checked && external
        ? state.correct ? ' is-correct' : type === 'choice' ? ' is-incorrect' : ''
        : '';
      return `<button type="button" class="ai-lesson-choice${active ? ' is-selected' : ''}${resultClass}" ${external ? 'data-learning-choice' : 'data-template-choice'}="${i}" aria-pressed="${active}"${disabled(locked)}><span class="ai-lesson-choice-mark" aria-hidden="true">${active ? icon(external && !state.correct ? 'target' : 'check', 18) : String.fromCharCode(65 + i)}</span><span>${text(option)}</span></button>`;
    }).join('')}</div>`;
  }
  if (type === 'order') {
    const order = list(state.order).length === list(block.items).length ? state.order : list(block.items).map((_, i) => i);
    const moveHook = external ? 'data-learning-order' : 'data-template-move';
    content = `<ol class="template-order">${order.map((id, index) => `<li><span class="template-number" aria-hidden="true">${index + 1}</span><span>${text(block.items[id])}</span><span class="template-order-actions"><button class="template-move" type="button" ${moveHook}="${index}" data-direction="-1" aria-label="${text(t('Move up', 'Переместить вверх', 'Жоғары жылжыту'))}: ${text(block.items[id])}"${disabled(locked || index === 0)}>↑</button><button class="template-move" type="button" ${moveHook}="${index}" data-direction="1" aria-label="${text(t('Move down', 'Переместить вниз', 'Төмен жылжыту'))}: ${text(block.items[id])}"${disabled(locked || index === order.length - 1)}>↓</button></span></li>`).join('')}</ol>`;
  }
  if (type === 'match') {
    const pairs = list(block.pairs);
    const left = external ? list(block.left) : pairs.map(pair => pair.left);
    const right = external ? list(block.right) : pairs.map(pair => pair.right);
    const options = right.map((label, index) => ({ label, index }));
    if (!external) options.reverse();
    const matchHook = external ? 'data-learning-match' : 'data-template-match';
    content = `<div class="template-matching">${left.map((label, index) => `<label class="template-match-row"><span>${text(label)}</span><select ${matchHook}="${index}"${disabled(locked)}><option value="">${t('Choose a match', 'Выбери пару', 'Жұбын таңда')}</option>${options.map(option => `<option value="${option.index}"${state.matches?.[index] === option.index ? ' selected' : ''}>${text(option.label)}</option>`).join('')}</select></label>`).join('')}</div>`;
  }
  if (type === 'gap-fill') {
    const inputHook = external ? 'data-learning-gap' : 'data-template-input';
    const contexts = ['before', 'after'].filter(name => block[name]);
    const description = external && contexts.length
      ? ` aria-describedby="${contexts.map(name => 'learning-gap-' + name).join(' ')}"` : '';
    const gapContext = name => block[name]
      ? `<span${external ? ` id="learning-gap-${name}"` : ''}>${text(block[name])}</span>` : '';
    content = `<label class="template-gap">${gapContext('before')}
      <input ${inputHook} aria-label="${t('Missing word or phrase', 'Пропущенное слово или фраза', 'Түсіп қалған сөз немесе тіркес')}"${description} value="${text(state.value)}" maxlength="${external ? LESSON_ASSESSMENT_LIMITS.gapAnswer : 200}" autocomplete="off" autocapitalize="off" spellcheck="false"${disabled(locked)}>
      ${gapContext('after')}</label>`;
  }
  if (type === 'practice') content = `<p class="learning-answer">${text(block.body)}</p>${block.criterion?.trim() && block.criterion.trim() !== block.body?.trim() ? `<div class="ai-lesson-criterion"><strong>${t('Before you finish', 'Перед завершением', 'Аяқтау алдында')}</strong><p>${text(block.criterion)}</p></div>` : ''}${external ? '' : `<label class="field"><span>${t('Your result', 'Твой результат', 'Нәтижең')}</span><textarea data-template-input rows="5" maxlength="1500"${disabled(busy)}>${text(state.value)}</textarea></label>`}`;
  if (type === 'recap') content = `<ul class="template-recap">${list(block.points).map(point => `<li>${icon('check', 20)}<span>${text(point)}</span></li>`).join('')}</ul>${block.body ? `<p>${text(block.body)}</p>` : ''}`;
  const interactive = ['choice', 'multi-choice', 'order', 'match', 'gap-fill', 'practice'].includes(type);
  const feedback = !external && state.checked ? `<div class="ai-lesson-check-feedback${state.correct ? ' is-correct' : ''}" role="status"><strong>${type === 'practice' ? t('Your draft is ready.', 'Черновик готов.', 'Нобайың дайын.') : state.correct ? t('That’s right.', 'Верно.', 'Дұрыс.') : t('Let’s try that again.', 'Попробуем ещё раз.', 'Қайта байқап көрейік.')}</strong><p>${text(type === 'practice' ? block.criterion : block.explanation)}</p></div>` : '';
  const check = !external && interactive ? `<button class="primary template-check" type="button" data-template-check${disabled(busy || !canCheckTemplate(block, state) || state.correct === true)}>${type === 'practice' ? t('Keep my draft', 'Сохранить черновик', 'Нобайды сақтау') : t('Check answer', 'Проверить ответ', 'Жауапты тексеру')} ${icon('arrow', 18)}</button>` : '';
  const material = `<div class="mentor-material" data-mentor-target>${content}</div>`;
  return `<section class="lesson-template template-${type}" data-lesson-template="${type}">${['theory', 'comparison', 'recap'].includes(type) ? material + scene : scene + material}${feedback}${check}</section>`;
}

export function canCheckTemplate(block, state) {
  switch (block.type) {
    case 'choice': return Number.isInteger(state.choice) && state.choice >= 0 && state.choice < list(block.options).length;
    case 'multi-choice': return list(state.selected).length > 0;
    case 'order': return list(block.items).length > 0;
    case 'match': return list(block.pairs).length > 0 && block.pairs.every((_, i) => Number.isInteger(state.matches?.[i]));
    case 'gap-fill': case 'practice': return Boolean(String(state.value ?? '').trim());
    default: return false;
  }
}

export function checkTemplate(block, state) {
  if (!canCheckTemplate(block, state)) return { checked: false, correct: false };
  let correct = false;
  switch (block.type) {
    case 'choice': correct = state.choice === block.answer; break;
    case 'multi-choice': correct = list(state.selected).length === list(block.answers).length && state.selected.every(i => block.answers.includes(i)); break;
    case 'order': correct = JSON.stringify(state.order ?? block.items.map((_, i) => i)) === JSON.stringify(block.answer); break;
    case 'match': correct = block.pairs.every((_, i) => state.matches[i] === i); break;
    case 'gap-fill': correct = list(block.accepted).some(answer => String(answer).trim().toLocaleLowerCase() === String(state.value).trim().toLocaleLowerCase()); break;
    // A free response is a draft, not a claim that the learner's work is correct.
    case 'practice': return { checked: true, correct: null };
  }
  return { checked: true, correct };
}

// A local exercise presenter for template previews and future course adapters.
// It emits answers; it never awards course credit or calls an AI provider.
export function mountLessonTemplate(host, block, { state = {}, onChange = () => {} } = {}) {
  block = normalizeLessonTemplate(block);
  if (!block) throw new TypeError('Invalid lesson template content.');
  let current = structuredClone(state);
  const render = () => { host.innerHTML = renderLessonTemplate(block, current); };
  const notify = () => onChange(structuredClone(current));
  const change = event => {
    const target = event.target;
    if (target.matches('[data-template-input]')) current.value = target.value;
    else if (target.matches('[data-template-match]')) current.matches = { ...current.matches, [target.dataset.templateMatch]: target.value === '' ? null : Number(target.value) };
    else return;
    current.checked = false; current.correct = false;
    // Do not replace a focused text field while the learner types.
    const feedback = host.querySelector('[role="status"]');
    if (feedback) feedback.remove();
    const button = host.querySelector('[data-template-check]');
    if (button) button.disabled = !canCheckTemplate(block, current);
    notify();
  };
  const click = event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const choice = button.dataset.templateChoice;
    let focusSelector = '';
    if (choice !== undefined) {
      const index = Number(choice);
      if (block.type === 'multi-choice') current.selected = list(current.selected).includes(index) ? current.selected.filter(i => i !== index) : [...list(current.selected), index];
      else current.choice = index;
      current.checked = false; current.correct = false;
      focusSelector = `[data-template-choice="${index}"]`;
    } else if (button.dataset.templateMove !== undefined) {
      const from = Number(button.dataset.templateMove), to = from + Number(button.dataset.direction);
      current.order ??= block.items.map((_, i) => i);
      if (to < 0 || to >= current.order.length) return;
      [current.order[from], current.order[to]] = [current.order[to], current.order[from]];
      current.checked = false; current.correct = false;
      focusSelector = `[data-template-move="${to}"][data-direction="${button.dataset.direction}"]:not(:disabled)`;
    } else if (button.hasAttribute('data-template-check')) {
      current = { ...current, ...checkTemplate(block, current) };
      focusSelector = '[role="status"]';
    } else return;
    render(); notify();
    const focus = host.querySelector(focusSelector) || host.querySelector('[data-template-check]');
    if (focus) { if (focus.getAttribute('role') === 'status') focus.tabIndex = -1; focus.focus(); }
  };
  host.addEventListener('click', click); host.addEventListener('input', change); host.addEventListener('change', change);
  render();
  return () => { host.removeEventListener('click', click); host.removeEventListener('input', change); host.removeEventListener('change', change); };
}
