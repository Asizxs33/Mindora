import { character } from './characters.js';
import { escapeHtml as esc } from '../core/engine.js';
import { t, languagePicker } from './language.js';
import { icon } from './icons.js';

export function guidedStartView() {
  return `<section class="guided-start guided-greeting" data-guided-step="0" aria-labelledby="guided-heading">
    <header class="guided-header"><a class="guided-brand" href="#discover" data-home aria-label="Mindora">mindora<span>.</span></a>${languagePicker()}</header>
    <div class="guided-content">
      <div class="guided-dialogue"><p>${t('Hi, I’m Mino. Let’s learn something together.', 'Привет, я Мино. Давай учиться вместе.', 'Сәлем, мен Миномын. Бірге үйренейік.')}</p></div>
      ${character('mino', 'welcome', 'guided-mino')}
      <h1 id="guided-heading" tabindex="-1">${t('Understanding opens possibilities.', 'Понимание открывает возможности.', 'Түсіну — мүмкіндіктің басы.')}</h1>
    </div>
    <footer class="guided-footer">
      <button type="button" class="primary" data-intro-action="next">${t('Let’s begin', 'Начнём', 'Бастайық')}${icon('arrow',20)}</button>
      <button type="button" class="guided-signin" data-account-open="signin">${t('I already have an account', 'У меня уже есть аккаунт', 'Менде аккаунт бар')}</button>
      <button type="button" class="guided-signin" data-intro-action="browse">${t('Back to learning', 'Вернуться к обучению', 'Оқуға оралу')}</button>
    </footer>
  </section>`;
}

export function quietHomeView(state) {
  const saved = state.learningPlan;
  if (!saved) return '';
  const steps = saved.plan.steps;
  const completed = saved.completed;
  const done = completed === steps.length;
  const startLabel = done ? t('See my result', 'Мой результат', 'Нәтижем')
    : completed || saved.study?.some(step => step.page > 0)
      ? t('Continue learning', 'Продолжить', 'Жалғастыру')
      : t('Start lesson', 'Начать урок', 'Сабақты бастау');
  return `<section class="quiet-home learning-hub" aria-labelledby="learning-hub-title">
    <header class="learning-hub-heading">
      <div><span>${t('Your learning path', 'Твой путь обучения', 'Сенің оқу жолың')} · ${completed}/${steps.length}</span><h1 id="learning-hub-title" lang="${esc(saved.plan.language)}">${esc(saved.plan.title)}</h1></div>
      <button type="button" class="icon-button" data-view="courses" aria-label="${t('Choose a course', 'Выбрать курс', 'Курс таңдау')}">${icon('book',23)}</button>
    </header>
    <div class="learning-hub-journey">
      <ol class="learning-hub-path" aria-label="${t('Course steps', 'Шаги курса', 'Курс қадамдары')}">${steps.map(({ title }, index) => {
        const passed = index < completed, current = index === completed;
        const label = passed ? t('completed', 'пройдено', 'аяқталды') : current ? t('next', 'дальше', 'келесі') : t('locked', 'закрыто', 'құлыптаулы');
        return `<li class="${passed ? 'is-done' : current ? 'is-current' : 'is-locked'}"${current ? ' aria-current="step"' : ''}>
          ${current
            ? `<button type="button" class="learning-hub-node" data-view="learning-plan" aria-label="${esc(startLabel)}">${icon('play', 25)}</button>`
            : `<span class="learning-hub-node" aria-hidden="true">${icon(passed ? 'check' : 'lock',25)}</span>`}
          <span class="learning-hub-step-title" lang="${esc(saved.plan.language)}">${esc(title)}<span class="visually-hidden"> · ${label}</span></span>
        </li>`;
      }).join('')}</ol>
      <aside class="learning-hub-guide"><div class="guided-dialogue"><p>${done ? t('You made it!', 'У тебя получилось!', 'Жарайсың, орындап шықтың!') : t('One small step. I’m with you.', 'Один маленький шаг. Я рядом.', 'Бір шағын қадам. Мен жаныңдамын.')}</p></div>${character('mino', done ? 'celebrate' : 'welcome', 'quiet-mentor')}</aside>
    </div>
    <div class="learning-hub-actions"><button type="button" class="primary" data-view="learning-plan">${startLabel}${icon('arrow',20)}</button><button type="button" class="text-link" data-view="courses">${t('My courses', 'Мои курсы', 'Курстарым')}</button></div>
  </section>`;
}
