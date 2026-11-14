import { COURSES, escapeHtml as esc } from '../core/engine.js';
import { posterSvg } from '../core/poster.js';
import { courseNames, lessonNames, pageBanner } from './dashboard.js';
import { icon } from './icons.js';
import { character } from './characters.js';
import { uiText, quizCopy } from './lesson-copy.js';

// Keep this screen's styles inside the UI layer, without changing the app entrypoint.
if (typeof document !== 'undefined' && !document.getElementById('mindora-lesson-styles')) {
  const stylesheet = document.createElement('link');
  stylesheet.id = 'mindora-lesson-styles';
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./lessons.css', import.meta.url).href;
  document.head.append(stylesheet);
}

const guide = id => id === 'design' ? 'mia' : 'sam';
const categories = { design: 'Design', budget: 'Spreadsheets' };
const outcomes = { design: 'Make a poster you can download and share.', budget: 'Build a simple expense tracker you can keep.' };
const stepTypes = ['Learn', 'Quick check', 'Try it', 'Make it yours'];

function buddy(id, message, mood = 'explaining') {
  return `<div class="lesson-buddy">${character(guide(id), mood, 'lesson-character')}<div class="buddy-bubble"><span class="buddy-name">${id === 'design' ? 'Mia · your design buddy' : 'Sam · your numbers buddy'}</span><p>${message}</p></div></div>`;
}

function emptyView(title, text, button = 'Find my first course') {
  return `<div class="empty-state">${character('mino', 'welcome', 'empty-character')}<h2>${title}</h2><p>${text}</p><button class="primary large" data-view="discover">${button}${icon('arrow', 18)}</button></div>`;
}

export function pathView(state) {
  if (!state.active) return emptyView('A little curiosity goes a long way', 'Tell Mino what you want to learn. We’ll start with one small step.');
  const id = state.active, c = COURSES[id], p = state.progress[id];
  return `<div class="learning-path"><button class="back-button" data-view="courses">${icon('back', 18)} My courses</button>
    <section class="path-intro">${character(guide(id), p === 4 ? 'celebrate' : 'welcome', 'path-character')}<div><span class="tag">${categories[id]} · with ${id === 'design' ? 'Mia' : 'Sam'}</span><h1>${courseNames[id]}</h1><p>${outcomes[id]}</p></div></section>
    ${state.goals[id] ? `<p class="personal-goal"><span>Your goal</span> ${esc(uiText(state.goals[id]))}</p>` : ''}
    <div class="path-progress"><span>${p} of 4 steps complete</span><strong>${p * 25}%</strong><div class="progress-bar" role="progressbar" aria-label="Course progress" aria-valuenow="${p * 25}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p * 25}%"></i></div></div>
    <section class="trail-map" aria-label="Your four learning steps">${c.steps.map((s, i) => `<article class="trail-stop ${i < p ? 'is-done' : i === p ? 'is-current' : 'is-locked'}"><button class="trail-button" data-step="${i}" ${i > p ? 'disabled' : ''} aria-label="${i > p ? 'Locked: ' : ''}${esc(lessonNames[id][i])}">${icon(i < p ? 'check' : i > p ? 'lock' : ['layers', 'spark', 'edit', 'trophy'][i], 28)}</button><div class="trail-copy"><span>${stepTypes[i]} · ${i < 2 ? '3 min' : 'At your pace'}</span><h2>${lessonNames[id][i]}</h2><p>${esc(uiText(s.description))}</p>${i === p ? '<span class="current-pill">You are here</span>' : ''}</div></article>`).join('')}</section>
    <div class="path-actionbar"><button class="primary" data-step="${Math.min(p, 3)}">${p === 4 ? 'Practise again' : p ? 'Continue learning' : 'Let’s start'} ${icon('arrow', 19)}</button><p class="small-note">${state.minutes} minutes is enough. Your progress is saved.</p></div>
    <details class="learning-sources"><summary>Want to explore a little more?</summary><p>These sources support your lessons.</p>${c.sources.map(s => `<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(uiText(s.title))} ↗</a>`).join('')}</details>
    ${p >= 2 ? `<button class="text-link path-extra" data-action="mix">${icon('shuffle', 17)} Try a fresh challenge</button>` : ''}</div>`;
}

export function lesson(state, { step, question, quizIndex, quizChoice, quizFeedback, draft, checks }) {
  const id = state.active, c = COURSES[id];
  if (!c) return emptyView('Let’s find your first course', 'Start with something you would love to make.');
  const progress = Math.round((step + (step === 1 ? quizIndex / 3 : 0)) / 4 * 100);
  return `<div class="lesson-flow"><header class="lesson-progress-head"><button class="lesson-exit" data-view="path" aria-label="Save and return to my course">${icon('back', 23)}</button><div class="progress-bar" role="progressbar" aria-label="Lesson progress" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><span>${step + 1} / 4</span></header>
    <div class="lesson-titleblock"><span class="eyebrow">${stepTypes[step]} · ${categories[id]}</span><h1>${lessonNames[id][step]}</h1>${step !== 1 ? `<p>${esc(uiText(c.steps[step].description))}</p>` : ''}</div>
    ${step === 0 ? learnContent(id) : step === 1 ? quizContent(id, question, quizIndex, quizChoice, quizFeedback) : practiceContent(id, draft, step === 3, checks)}</div>`;
}

function learnContent(id) {
  const design = id === 'design';
  const principles = design ? [
    ['One big idea', 'Make the headline larger than everything else. It tells people where to look first.'],
    ['Easy on the eyes', 'Dark words on a light background are a good place to start.'],
    ['One next step', 'Tell people what to do, where to go, or when to visit.']
  ] : [
    ['Every cell has an address', 'A letter tells you the column. A number tells you the row. B2 means column B, row 2.'],
    ['A range is a group of cells', 'B2:B4 means B2, B3 and B4. The colon means “through”.'],
    ['SUM does the adding', 'Type =SUM(B2:B4) to add those three cells. Change a number and the total changes too.']
  ];
  return `${buddy(id, design ? 'A clear poster only needs three little things. Let me show you.' : 'Think of a spreadsheet as a notebook that can do the maths for you.')}
    <section class="learning-panel"><div class="lesson-copy"><h2>${design ? 'Small changes. A clearer poster.' : 'Three cells. One simple formula.'}</h2><ol class="principle-list">${principles.map(([title, text], i) => `<li><span class="principle-number">${i + 1}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}</ol></div>
    <div class="lesson-example">${design ? `<div class="sample-poster"><span class="poster-label">YOUR NEIGHBOURHOOD CAFÉ</span><div class="sample-sun" aria-hidden="true">☀</div><h3>A little coffee.<br>A lovely day.</h3><p>Fresh coffee. Good company.</p><span class="sample-cta">Visit Saturday · 10 am–4 pm</span></div><p class="example-caption">Big headline. Clear details. A next step.</p>` : `<div class="sheet-example">${sheetTable([48, 125, 24], false, '197')}</div><div class="formula-example"><code>=SUM(B2:B4)</code><span>48 + 125 + 24 = <strong>197</strong></span></div>`}</div></section>
    <div class="lesson-actionbar"><button class="primary" data-action="finish-learn">Got it! ${icon('arrow', 19)}</button><p class="small-note">Next up: three quick questions.</p></div>`;
}

function quizContent(id, original, quizIndex, quizChoice, quizFeedback) {
  const q = quizCopy(original), correct = quizChoice === original.correctIndex;
  const answered = quizFeedback && correct;
  return `${buddy(id, quizFeedback ? correct ? 'That’s it! You’re getting the hang of this.' : 'You’re learning. Let’s look at this together.' : 'Your turn. Take your time — you can always try again.', quizFeedback ? correct ? 'celebrate' : 'explaining' : 'thinking')}
    <section class="mini-quiz"><div class="quiz-count"><span>Question ${quizIndex + 1} of 3</span><div class="quiz-dots" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i <= quizIndex ? 'on' : ''}"></i>`).join('')}</div></div><h2>${esc(q.question)}</h2><div class="quiz-options">${q.choices.map((text, i) => `<button class="quiz-option ${quizChoice === i ? 'selected' : ''} ${quizFeedback && quizChoice === i ? correct ? 'correct' : 'wrong' : ''}" data-choice="${i}" aria-pressed="${quizChoice === i}" ${answered ? 'disabled' : ''}><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${esc(text)}</span>${quizFeedback && correct && quizChoice === i ? icon('check', 20) : ''}</button>`).join('')}</div>
    ${quizFeedback ? `<div class="answer-feedback ${correct ? 'success' : 'try-again'}" role="status" aria-live="polite">${icon(correct ? 'check' : 'spark', 23)}<div><strong>${correct ? 'Nicely done!' : 'Almost. Try another answer.'}</strong><p>${esc(q.explanation)}</p></div></div>` : ''}</section>
    <div class="lesson-actionbar"><button class="primary" data-action="${answered ? 'next-question' : 'check-quiz'}" ${quizChoice === null ? 'disabled' : ''}>${answered ? quizIndex === 2 ? 'Finish this step' : 'Continue' : 'Check answer'} ${icon('arrow', 19)}</button><p class="small-note">${answered ? 'One small step forward.' : 'No rush. Mistakes are part of learning.'}</p></div>`;
}

export function posterHtml(p) {
  // Translate only known placeholder copy. The learner’s draft stays untouched.
  const preview = { ...p, title: p.title || 'Your big idea', subtitle: p.subtitle || 'A few details that make it yours.', cta: p.cta || 'Tell people what to do next' };
  return `<div class="poster-preview poster-svg" data-poster-preview>${posterSvg(preview, false).replace('>СОЗДАНО В MINDORA</text>', '>MADE WITH MINDORA</text>')}</div>`;
}

const briefs = [
  'Make a poster for a Saturday plant swap. Include the event, one useful detail, and an invitation to join.',
  'Make a poster for a Sunday book swap. Include the event, one useful detail, and an invitation to join.',
  'Make a poster for a Friday pottery workshop. Include the event, one useful detail, and an invitation to join.'
];

function practiceContent(id, d, challenge, checks) {
  return `${buddy(id, checks ? checks.passed ? 'You did it! Save your work and keep this little win.' : 'A few small tweaks and you’ll be there. Check my notes below.' : challenge ? 'You’ve got this. Try a fresh challenge in your own way.' : id === 'design' ? 'Let’s make your first poster. Start with a headline you love.' : 'Let’s add your expenses. I’ll be right here if you need a hint.', checks?.passed ? 'celebrate' : checks ? 'explaining' : 'welcome')}
    ${challenge ? `<div class="practice-brief"><span class="eyebrow">Your fresh challenge</span><p>${id === 'design' ? briefs[d.seed % briefs.length] : 'Here are three new expenses. Write a formula for B2:B4, then work out the total.'}</p></div>` : ''}
    ${id === 'design' ? posterEditor(d) : budgetEditor(d, challenge, checks)}
    ${!challenge ? `<details class="practice-hint"><summary>${icon('spark', 18)} A little hint</summary><p>${id === 'design' ? 'Make your headline at least 1.5 times the size of the detail text. Choose colours that are easy to read and add a clear next step.' : 'SUM needs the first and last cells of a range. Include B2, B3 and B4, then add all three numbers.'}</p></details>` : ''}
    <div id="checks-container">${checks ? renderChecks(checks, id, challenge) : ''}</div>
    <div class="lesson-actionbar"><button class="primary" data-action="check-work">${checks?.passed ? 'Save my work' : 'Check my work'} ${icon(checks?.passed ? 'check' : 'arrow', 19)}</button><p class="small-note">Your draft is saved as you go.</p></div>`;
}

function posterEditor(d) {
  return `<section class="studio-workspace"><div class="studio-canvas"><div class="editor-stage" data-poster-stage>${posterHtml(d)}</div><p class="canvas-caption">${icon('edit', 15)} Your live preview</p></div><form id="poster-form" class="studio-controls" autocomplete="off">
    <label class="field"><span>What’s your big idea?</span><input name="title" maxlength="48" value="${esc(d.title)}" placeholder="Your poster headline" required></label>
    <label class="field"><span>Add a little detail</span><textarea name="subtitle" maxlength="100" placeholder="What should people know?" required>${esc(d.subtitle)}</textarea></label>
    <label class="field"><span>What should people do?</span><input name="cta" maxlength="55" value="${esc(d.cta)}" placeholder="Join us on Saturday at 10 am" required></label>
    <label class="field"><span class="range-label">Headline size <output id="title-size">${Number(d.titleSize) || 34}px</output></span><input type="range" name="titleSize" min="20" max="56" value="${Number(d.titleSize) || 34}"></label>
    <label class="field"><span class="range-label">Detail text size <output id="subtitle-size">${Number(d.subtitleSize) || 16}px</output></span><input type="range" name="subtitleSize" min="10" max="24" value="${Number(d.subtitleSize) || 16}"></label>
    <div class="field"><span>Pick a background</span><div class="palette">${[['#f7d667', 'Sunshine'], ['#e3ecf7', 'Sky'], ['#d6eadd', 'Sage'], ['#f3d9d1', 'Peach']].map(([color, name]) => `<button type="button" class="color-swatch ${d.bgColor === color ? 'selected' : ''}" data-color="${color}" aria-label="${name} background" aria-pressed="${d.bgColor === color}" style="background:${color}"></button>`).join('')}</div></div>
    <label class="field"><span>Text colour</span><select name="textColor"><option value="#263c31" ${d.textColor === '#263c31' ? 'selected' : ''}>Forest green</option><option value="#243e6a" ${d.textColor === '#243e6a' ? 'selected' : ''}>Midnight blue</option><option value="#ffffff" ${d.textColor === '#ffffff' ? 'selected' : ''}>White</option></select></label>
    </form></section>`;
}

function sheetTable(values, editable, total = '—') {
  return `<table class="expense-table"><caption class="sr-only">Expense tracker. Values in cells B2 to B4.</caption><thead><tr><th aria-label="Row number"></th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody><tr><th scope="row">1</th><td class="sheet-heading">Expense</td><td class="sheet-heading">Amount</td></tr>${values.map((v, i) => `<tr><th scope="row">${i + 2}</th><td>${['Transport', 'Groceries', 'Subscriptions'][i]}</td><td class="number-cell">${editable ? `<input type="number" inputmode="decimal" min="0" max="1000000" step="0.01" data-expense="${i}" value="${esc(v)}" aria-label="${['Transport', 'Groceries', 'Subscriptions'][i]} expense, cell B${i + 2}">` : esc(v)}</td></tr>`).join('')}<tr class="total-row"><th scope="row">5</th><td>Total</td><td data-budget-total>${esc(total)}</td></tr></tbody></table>`;
}

function budgetEditor(d, challenge, checks) {
  return `<section class="budget-workspace"><div class="sheet-toolbar">${icon('grid', 19)} My expense tracker<span>3 expenses</span></div>${sheetTable(d.values, !challenge, checks?.passed ? d.values.reduce((a, b) => a + Number(b), 0).toFixed(2) : '—')}<div class="budget-controls"><label class="field"><span>1. Write your formula</span><input id="budget-formula" value="${esc(d.formula)}" placeholder="=SUM(...)" autocomplete="off" autocapitalize="characters" spellcheck="false"><small>Add the values in B2, B3 and B4.</small></label><label class="field"><span>2. What’s the total?</span><input id="budget-answer" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(d.answer)}" placeholder="Enter the total"><small>Use two decimal places if you need them.</small></label></div></section>`;
}

function renderChecks(r, id, challenge) {
  return `<section class="check-panel ${r.passed ? 'all-passed' : ''}" role="status" aria-live="polite"><h2>${r.passed ? 'Looking good!' : 'Let’s make a few small tweaks'}</h2><ul>${r.checks.map(c => `<li class="${c.passed ? 'passed' : 'needs-work'}"><span class="check-indicator">${icon(c.passed ? 'check' : 'edit', 17)}</span><div><strong>${esc(uiText(c.label))}</strong><p>${esc(uiText(c.detail))}</p></div></li>`).join('')}</ul>${id === 'design' && challenge ? '<p class="small-note">One last look: does your poster match the challenge?</p>' : ''}</section>`;
}

export function result(state) {
  const id = state.active;
  if (!COURSES[id]) return emptyView('Your next little win is waiting', 'Choose a course and make something of your own.');
  const finished = state.progress[id] === 4;
  return `<section class="result-screen">${character(guide(id), 'celebrate', 'result-character')}<span class="tag">${finished ? 'Course complete' : 'Practice complete'} ${icon('check', 15)}</span><h1>Look at you go!</h1><p>${finished ? 'You learned it. You tried it. You made it your own.' : 'You turned a new idea into something real.'}</p><div class="result-card"><div class="result-symbol">${icon(id === 'design' ? 'edit' : 'grid', 28)}</div><h2>${id === 'design' ? 'Your poster is ready' : 'Your expense tracker is ready'}</h2><p>${outcomes[id]}</p><div class="result-stats"><div><strong>${state.progress[id]} / 4</strong><span>Steps complete</span></div><div><strong>1</strong><span>Thing you made</span></div></div><div class="result-actions"><button class="primary" data-action="download" data-id="${id}">${icon('download', 19)} Download ${id === 'design' ? 'poster' : 'tracker'}</button><button class="secondary" data-view="work">See my work ${icon('arrow', 18)}</button></div><p class="small-note">Saved in this browser, ready when you are.</p></div><button class="text-link" data-action="mix">${icon('shuffle', 17)} Try a fresh challenge</button></section>`;
}

export function workView(state) {
  const entries = Object.entries(state.works).filter(([id]) => COURSES[id]);
  return `${pageBanner('Made by you', 'Small steps. Real things you can be proud of.', 'celebrate')}${!entries.length ? emptyView('Your ideas belong here', 'Finish a practice to save your first poster or expense tracker.', 'Make something') : `<div class="portfolio-summary"><strong>${entries.length} ${entries.length === 1 ? 'project' : 'projects'}</strong><span>Every one started with a little curiosity.</span></div><div class="portfolio-grid">${entries.map(([id, w]) => `<article class="work-item"><div class="work-thumb">${id === 'design' ? posterHtml(w.data) : sheetTable(w.data.values, false, w.data.values.reduce((a, b) => a + Number(b), 0).toFixed(2))}</div><div class="work-item-body"><span class="eyebrow">${categories[id]}</span><h2>${id === 'design' ? esc(w.data.title) : 'My expense tracker'}</h2><p>${w.challenge ? 'Independent challenge' : 'Guided practice'} · ${new Date(w.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p><button class="secondary" data-action="download" data-id="${id}">${icon('download', 17)} Download ${id === 'design' ? 'SVG' : 'CSV'}</button><button class="text-link" data-course="${id}">Keep learning ${icon('arrow', 16)}</button><label class="field reflection-field"><span>What would you like to remember?</span><textarea class="notes-area" data-note="${id}" maxlength="600" placeholder="A little note to your future self…">${esc(state.notes[id] || '')}</textarea></label></div></article>`).join('')}</div>`}`;
}
