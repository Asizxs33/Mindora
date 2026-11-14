import { escapeHtml as esc } from '../core/engine.js';
import { currentReviewCorrect, reviewCanCheck, reviewScore, transitionReturnReview } from '../core/return-review.js';
import { character } from './characters.js';
import { icon } from './icons.js';
import { t } from './language.js';

if (typeof document !== 'undefined' && !document.getElementById('mindora-return-review-styles')) {
  const link = document.createElement('link'); link.id = 'mindora-return-review-styles'; link.rel = 'stylesheet';
  link.href = new URL('./return-review.css', import.meta.url).href; document.head.append(link);
}

function responseFields(review) {
  const a = review.questions[review.index].assessment, response = review.responses[review.index];
  const locked = review.checked && (review.phase === 'question' || currentReviewCorrect(review));
  const disabled = locked ? ' disabled' : '';
  if (a.type === 'choice' || a.type === 'multi-choice') {
    return `<div class="return-options" role="group" aria-labelledby="return-review-title">${a.options.map((option, index) => {
      const selected = a.type === 'choice' ? response === index : response.includes(index);
      return `<button type="button" data-return-choice="${index}" class="return-option${selected ? ' selected' : ''}" aria-pressed="${selected}"${disabled}><span aria-hidden="true">${selected ? '✓' : String.fromCharCode(65 + index)}</span>${esc(option)}</button>`;
    }).join('')}</div>`;
  }
  if (a.type === 'order') return `<ol class="return-order">${response.map((id, index) => `<li><span>${esc(a.items[id])}</span><button type="button" data-return-order="${index}" data-direction="-1" aria-label="${t('Move up', 'Вверх', 'Жоғары')}: ${esc(a.items[id])}"${locked || index === 0 ? ' disabled' : ''}>↑</button><button type="button" data-return-order="${index}" data-direction="1" aria-label="${t('Move down', 'Вниз', 'Төмен')}: ${esc(a.items[id])}"${locked || index === response.length - 1 ? ' disabled' : ''}>↓</button></li>`).join('')}</ol>`;
  if (a.type === 'match') return `<div class="return-matches">${a.left.map((left, index) => `<label><span>${esc(left)}</span><select data-return-match="${index}"${disabled}><option value="">${t('Choose a match', 'Выбери пару', 'Жұбын таңда')}</option>${a.right.map((right, value) => `<option value="${value}"${response[index] === value ? ' selected' : ''}>${esc(right)}</option>`).join('')}</select></label>`).join('')}</div>`;
  return `<label class="return-gap"><span>${esc(a.before)}</span><input data-return-gap value="${esc(response)}" maxlength="160" autocomplete="off" aria-label="${t('Missing word', 'Пропущенное слово', 'Түсіп қалған сөз')}"${disabled}><span>${esc(a.after)}</span></label>`;
}

export function returnReviewView(review) {
  if (!review || review.phase === 'complete') return '';
  const { phase, index, questions } = review;
  const question = questions[index], correct = currentReviewCorrect(review), intro = phase === 'intro', foundations = phase === 'foundations';
  const title = intro ? t('Welcome back.', 'С возвращением.', 'Қайта келгеніңе қуаныштымын.')
    : foundations ? t('Let’s revisit the basics.', 'Вернёмся к основам.', 'Негіздерге оралайық.') : question.assessment.question;
  const mood = intro ? 'welcome' : foundations ? 'explaining' : review.checked ? correct ? 'celebrate' : 'encourage' : 'thinking';
  const nextEnabled = intro || foundations || (review.checked && (phase === 'question' || correct));
  const progress = intro ? 0 : (index + (review.checked ? 1 : 0)) / Math.max(1, questions.length) * 100;
  const score = reviewScore(review);
  return `<section class="return-review" aria-labelledby="return-review-title">
    <header class="return-review-top"><button type="button" class="icon-button" data-view="my-path" aria-label="${t('Save and leave', 'Сохранить и выйти', 'Сақтап шығу')}">${icon('close', 22)}</button><div class="return-review-progress" role="progressbar" aria-label="${t('Quick review', 'Повторение', 'Қайталау')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div><span>${intro ? t('1 min', '1 мин', '1 мин') : `${index + 1}/${questions.length}`}</span></header>
    <div class="return-review-body"><div class="return-review-tutor">${character(review.mentor, mood, 'return-character')}<div class="return-review-speech"><h1 id="return-review-title" tabindex="-1">${esc(title)}</h1>${intro ? `<p>${questions.length ? t('Two small questions, then back to your saved place.', 'Два коротких вопроса — и продолжим с сохранённого места.', 'Екі қысқа сұрақтан кейін тоқтаған жеріңнен жалғастырамыз.') : t('A short reminder, then back to your saved place.', 'Короткое напоминание — и продолжим с сохранённого места.', 'Қысқаша еске түсіріп, тоқтаған жеріңнен жалғастырайық.')}</p>` : foundations ? `<p>${t('A little practice will help. Your course progress is safe.', 'Немного повторим. Прогресс курса сохранён.', 'Аздап қайталайық. Курстағы жетістігің сақталған.')}</p>` : ''}</div></div>
    ${intro && !questions.length ? `<p class="return-review-reminder">${esc(review.reminder)}</p>` : foundations ? `<article class="return-review-reminder"><strong>${esc(question.title)}</strong><p>${esc(question.detail || question.reminder)}</p></article>` : !intro ? responseFields(review) : ''}
    ${review.checked && !intro && !foundations ? `<div class="return-review-feedback${correct ? ' success' : ''}" role="status"><strong>${correct ? t('That’s right.', 'Верно.', 'Дұрыс.') : t('Let’s remember this.', 'Вспомним этот момент.', 'Осыны еске түсірейік.')}</strong><p>${esc(question.assessment.explanation)}</p></div>` : ''}
    </div><footer class="return-review-footer"><button type="button" class="primary" data-return-action="${nextEnabled ? 'next' : 'check'}"${!nextEnabled && !reviewCanCheck(review) ? ' disabled' : ''}>${intro ? questions.length ? t('Let’s begin', 'Начнём', 'Бастайық') : t('Continue learning', 'Продолжить обучение', 'Оқуды жалғастыру') : foundations ? index < questions.length - 1 ? t('Next idea', 'Следующая идея', 'Келесі ой') : t('Try once more', 'Попробовать снова', 'Қайта байқап көру') : nextEnabled ? index === questions.length - 1 && (phase === 'repair' || score.correct / score.total >= .7) ? t('Continue my course', 'Продолжить курс', 'Курсты жалғастыру') : t('Continue', 'Продолжить', 'Жалғастыру') : t('Check answer', 'Проверить', 'Тексеру')} ${icon('arrow', 18)}</button></footer>
  </section>`;
}

// onChange(review, {render}) lets typing persist without replacing the focused
// input. The host owns storage/account scope and calls onComplete to resume.
export function mountReturnReview({ getReview, onChange, onComplete, isActive = () => true }) {
  const publish = (review, render = true) => {
    onChange(review, { render });
    if (review.phase === 'complete') onComplete(review);
  };
  const click = event => {
    if (!isActive()) return;
    const button = event.target.closest?.('button[data-return-choice], button[data-return-order], button[data-return-action]');
    const review = getReview();
    if (!button || button.disabled || !review) return;
    const a = review.questions[review.index]?.assessment;
    let action;
    if (button.dataset.returnAction) action = { type: button.dataset.returnAction };
    else if (button.dataset.returnChoice !== undefined && a) {
      const value = Number(button.dataset.returnChoice), current = review.responses[review.index];
      action = { type: 'answer', response: a.type === 'multi-choice' ? current.includes(value) ? current.filter(i => i !== value) : [...current, value] : value };
    } else if (button.dataset.returnOrder !== undefined && a?.type === 'order') {
      const from = Number(button.dataset.returnOrder), to = from + Number(button.dataset.direction);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= a.items.length || to >= a.items.length) return;
      const response = [...review.responses[review.index]];
      [response[from], response[to]] = [response[to], response[from]];
      action = { type: 'answer', response };
    }
    const next = transitionReturnReview(review, action);
    if (next !== review) {
      publish(next);
      if (['next', 'check'].includes(action.type)) document.getElementById('return-review-title')?.focus({ preventScroll: true });
      else document.querySelector(`[${button.hasAttribute('data-return-choice') ? 'data-return-choice' : 'data-return-order'}="${button.dataset.returnChoice ?? button.dataset.returnOrder}"]`)?.focus({ preventScroll: true });
    }
  };
  const change = event => {
    if (!isActive() || event.target.dataset.returnMatch === undefined) return;
    const review = getReview(), index = Number(event.target.dataset.returnMatch);
    if (!review || review.questions[review.index]?.assessment.type !== 'match') return;
    const response = [...review.responses[review.index]];
    response[index] = event.target.value === '' ? null : Number(event.target.value);
    publish(transitionReturnReview(review, { type: 'answer', response }));
    document.querySelector(`[data-return-match="${index}"]`)?.focus({ preventScroll: true });
  };
  const input = event => {
    if (!isActive() || event.target.dataset.returnGap === undefined) return;
    const review = getReview();
    if (!review) return;
    const next = transitionReturnReview(review, { type: 'answer', response: event.target.value });
    publish(next, false);
    document.querySelector('.return-review-feedback')?.remove();
    const check = document.querySelector('[data-return-action="check"]');
    if (check) check.disabled = !reviewCanCheck(next);
  };
  document.addEventListener('click', click); document.addEventListener('change', change); document.addEventListener('input', input);
  return () => { document.removeEventListener('click', click); document.removeEventListener('change', change); document.removeEventListener('input', input); };
}
