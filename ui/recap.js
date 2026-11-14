import { character } from './characters.js';
import { icon } from './icons.js';

const copy = {
  design: {
    title: 'A quick design refresh.',
    reminder: 'One big headline. Words that are easy to read. A clear next step. These three ideas make a useful poster.',
    questions: [
      { text: 'What should people notice first?', choices: ['The smallest details', 'The main headline', 'Every word at once'], answer: 1, tip: 'Make the main headline the biggest text. It leads the way.' },
      { text: 'Your café has an event. Pick the clearest invitation.', choices: ['See you sometime!', 'Coffee is lovely.', 'Join us Saturday at 10 am'], answer: 2, tip: 'A day, a time, and an action tell people what to do next.' },
    ],
  },
  budget: {
    title: 'A quick spreadsheet refresh.',
    reminder: 'A cell has an address, like B2. B2:B4 means B2 through B4. =SUM(B2:B4) adds those cells for you.',
    questions: [
      { text: 'Which formula adds B2, B3 and B4?', choices: ['=SUM(B2:B4)', '=SUM(B2)', 'B2 + B4'], answer: 0, tip: 'Use =SUM(B2:B4). The range includes all three cells.' },
      { text: 'B2 is 10, B3 is 20 and B4 is 5. What is the total?', choices: ['30', '35', '15'], answer: 1, tip: 'Add all three numbers: 10 + 20 + 5 = 35.' },
    ],
  },
};

export const recapQuestion = (id, index) => copy[id].questions[index];

export function recapView(id, { phase = 0, choice = null, checked = false } = {}) {
  const item = copy[id], q = phase ? item.questions[phase - 1] : null;
  const correct = q && choice === q.answer;
  return `<div class="lesson-flow recap-flow"><header class="lesson-progress-head"><button class="lesson-exit" data-view="path" aria-label="Return to my course">${icon('back', 23)}</button><div class="progress-bar" role="progressbar" aria-label="Refresher progress" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${phase}"><i style="width:${phase / 3 * 100}%"></i></div><span>Quick refresh</span></header>
    <div class="lesson-buddy">${character(id === 'design' ? 'mia' : 'sam', checked && correct ? 'celebrate' : phase ? 'thinking' : 'welcome', 'lesson-character')}<div class="buddy-bubble"><p>${phase ? 'No rush. Let’s remember together.' : 'Welcome back! Let’s warm up for a moment.'}</p></div></div>
    <section class="mini-quiz"><div class="quiz-count">${phase ? `${phase === 1 ? 'Remember' : 'Try it'} · ${phase} of 2` : 'About 1 minute'}</div><h1>${q ? q.text : item.title}</h1>
    ${!q ? `<p class="idea-description">${item.reminder}</p><aside class="key-idea">${icon('book', 23)}<div><strong>Your place is saved.</strong><p>Two little questions, then straight back to your course.</p></div></aside>` : `<div class="quiz-options">${q.choices.map((text, i) => `<button class="quiz-option ${choice === i ? 'selected' : ''} ${checked && choice === i ? correct ? 'correct' : 'wrong' : ''}" data-recap-choice="${i}" aria-pressed="${choice === i}" ${checked && correct ? 'disabled' : ''}><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${text}</span></button>`).join('')}</div>${checked ? `<div class="answer-feedback ${correct ? 'success' : 'try-again'}" role="status"><div><strong>${correct ? 'You’ve got it!' : 'Let’s try once more.'}</strong><p>${q.tip}</p></div></div>` : ''}`}</section>
    <div class="lesson-actionbar"><button class="primary" data-action="${!phase || (checked && correct) ? 'recap-next' : 'recap-check'}" ${phase && choice === null ? 'disabled' : ''}>${!phase ? 'Let’s remember' : checked && correct ? phase === 2 ? 'Continue my course' : 'Continue' : 'Check answer'} ${icon('arrow', 19)}</button></div></div>`;
}
