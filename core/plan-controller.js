import { lessonPages, normalizeTaskReview, planInput, restorePlan, taskReviewInput } from './learning-plan.js';
import { isAssessmentCorrect, isAssessmentReady, normalizeAssessmentResponse } from './lesson-assessment.js';
import { message } from '../ui/messages.js';
import { createPracticeController } from './practice-controller.js';

export function createPlanController({ state, save, render, isOpen, canLearn = () => true, beforeGenerate, onGenerated, onUnauthorized = () => {}, accountId = () => null, guestMode = () => false }) {
  state.learningPlan = restorePlan(state.learningPlan);
  let goal = state.learningPlan?.plan.goal ?? '';
  let minutes = state.learningPlan?.plan.minutes ?? state.minutes;
  let busy = null;
  let error = '';
  let reviewError = '';
  let reviewErrorFor = null;
  let epoch = 0;
  const practical = createPracticeController({ document,
    getPractice: () => {
      const lesson = currentLesson();
      return !busy && isOpen() && atPractice(lesson) && !lesson.saved.reviews[lesson.index] ? lesson.step.practice : null;
    },
    onAnswer: answer => {
      const lesson = currentLesson();
      if (!lesson) return;
      lesson.saved.answers[lesson.index] = answer;
      save();
    },
  });

  function reset() {
    practical.cancel();
    epoch++;
    state.learningPlan = restorePlan(state.learningPlan);
    goal = state.learningPlan?.plan.goal ?? '';
    minutes = state.learningPlan?.plan.minutes ?? state.minutes;
    busy = null; error = ''; reviewError = ''; reviewErrorFor = null;
  }

  function refresh() {
    practical.cancel();
    if (isOpen()) render();
  }

  function focusPage() {
    if (isOpen()) {
      (document.getElementById('learning-page-title') || document.getElementById('learning-plan-complete'))?.focus();
    }
  }

  function currentLesson() {
    const saved = state.learningPlan;
    const index = saved?.completed;
    const step = saved?.plan.steps[index];
    if (!step) return null;
    const study = saved.study[index];
    const pages = lessonPages(step, index === saved.plan.steps.length - 1);
    return { saved, index, step, study, pages, page: pages[study.page] };
  }

  function passedCheckpoint({ step, study, pages }) {
    if (!pages.includes('check')) return true;
    const { assessment, checkpoint } = step.teaching;
    return study.checked && (assessment
      ? isAssessmentCorrect(assessment, study.response)
      : study.choice === checkpoint.correctIndex);
  }

  function editableAssessment(lesson, target) {
    if (busy || !isOpen() || target.disabled || lesson?.page !== 'check' || passedCheckpoint(lesson)) return null;
    return lesson.step.teaching.assessment;
  }

  function updateAssessment(lesson, assessment, response) {
    lesson.study.response = normalizeAssessmentResponse(assessment, response);
    lesson.study.checked = false;
    save();
  }

  function atPractice(lesson) {
    return lesson?.page === 'practice' && passedCheckpoint(lesson);
  }

  function activeReviewError() {
    return reviewErrorFor?.saved === state.learningPlan && reviewErrorFor.index === state.learningPlan?.completed
      ? reviewError : '';
  }

  async function generate(nextGoal, nextMinutes, { roadmapStage, language = state.language } = {}) {
    if (busy || !canLearn()) return false;
    goal = nextGoal;
    minutes = nextMinutes;
    const input = planInput(goal, minutes, language);
    if (!input) {
      error = 'Напиши цель от 3 до 180 символов и выбери время.';
      refresh();
      return;
    }
    if (!roadmapStage && state.learningPlan?.plan.goal === input.goal && state.learningPlan.plan.minutes === input.minutes
      && state.learningPlan.plan.language === input.language) {
      error = '';
      refresh();
      return;
    }
    if (!onGenerated && (state.learningPlan?.answers.some(answer => answer.trim())
      || state.learningPlan?.study.some(entry => entry.page > 0 || entry.choice !== null || entry.checked))
      && !window.confirm(message('Новый маршрут заменит текущий маршрут и его ответы. Построить новый?'))) {
      refresh();
      return;
    }
    busy = 'plan';
    error = '';
    const previous = state.learningPlan;
    const version = epoch;
    refresh();
    try {
      if (beforeGenerate && !await beforeGenerate()) {
        error = 'Сначала сохрани текущее занятие в аккаунте.';
        return;
      }
      if (version !== epoch) return;
      const response = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accountId() ? { 'X-Mindora-Account': accountId() } : guestMode() ? { 'X-Mindora-Guest': '1' } : {}) },
        body: JSON.stringify(roadmapStage ? { ...input, roadmapStage } : input),
        signal: AbortSignal.timeout(57000),
      });
      const result = await response.json();
      if (version !== epoch || state.learningPlan !== previous) return;
      if (response.status === 401) onUnauthorized();
      if (!response.ok) throw new Error(result.error || 'Не удалось построить маршрут.');
      const saved = restorePlan({ plan: result.plan, answers: [], completed: 0 });
      if (!saved) throw new Error('Не удалось прочитать маршрут. Попробуй ещё раз.');
      if (onGenerated) {
        if (!result.course?.id || !await onGenerated(result.course)) throw new Error('Не удалось сохранить занятие в аккаунте.');
      } else state.learningPlan = saved;
      reviewError = '';
      reviewErrorFor = null;
      if (!onGenerated) save();
      return true;
    } catch (failure) {
      if (version !== epoch || state.learningPlan !== previous) return;
      error = failure.name === 'TimeoutError' ? 'Поиск занял слишком много времени. Попробуй ещё раз.'
        : failure instanceof TypeError || failure instanceof SyntaxError ? 'Не удалось связаться с сервисом. Попробуй ещё раз.'
        : failure.message;
      return false;
    } finally {
      if (version === epoch) { busy = null; refresh(); }
    }
  }

  async function reviewAnswer(answer) {
    const lesson = currentLesson();
    if (busy || !canLearn() || !isOpen() || !atPractice(lesson)) return;
    const { saved, index, step } = lesson;
    if (saved.reviews[index]) return;
    const { goal, language } = saved.plan;
    const input = taskReviewInput({ goal, task: step.task, criterion: step.criterion, answer, language });
    if (!input) return;

    saved.answers[index] = input.answer;
    reviewError = '';
    reviewErrorFor = null;
    busy = 'review';
    const version = epoch;
    const stillCurrent = () => version === epoch && state.learningPlan === saved && saved.completed === index && saved.answers[index] === input.answer;
    save();
    refresh();
    try {
      const response = await fetch('/api/task-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accountId() ? { 'X-Mindora-Account': accountId() } : guestMode() ? { 'X-Mindora-Guest': '1' } : {}) },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(32000),
      });
      const result = await response.json();
      if (!stillCurrent()) return;
      if (response.status === 401) onUnauthorized();
      if (!response.ok) throw new Error(result.error || 'ИИ-разбор пока недоступен.');
      const review = normalizeTaskReview(result.review);
      if (!review) throw new Error('Не удалось прочитать разбор. Попробуй ещё раз.');
      saved.reviews[index] = { answer: input.answer, ...review };
      save();
    } catch (failure) {
      if (!stillCurrent()) return;
      reviewError = failure.name === 'TimeoutError' ? 'Разбор занял слишком много времени. Попробуй ещё раз.'
        : failure instanceof TypeError || failure instanceof SyntaxError ? 'Не удалось связаться с ИИ. Попробуй ещё раз.'
        : failure.message;
      reviewErrorFor = { saved, index };
    } finally {
      if (version === epoch) { busy = null; refresh(); }
      if (stillCurrent() && isOpen()) document.getElementById('learning-review-status')?.focus();
    }
  }

  document.addEventListener('input', event => {
    const lesson = currentLesson();
    if (event.target.dataset?.learningGap !== undefined) {
      const assessment = editableAssessment(lesson, event.target);
      if (assessment?.type !== 'gap-fill') return;
      updateAssessment(lesson, assessment, event.target.value);
      // Keep the native field and its caret in place while the learner types.
      document.getElementById('learning-check-feedback')?.remove();
      const check = document.querySelector('[data-learning-page="check"]');
      if (check) check.disabled = !isAssessmentReady(assessment, lesson.study.response);
      return;
    }
    if (busy || !isOpen() || event.target.form?.id !== 'learning-step-form' || event.target.name !== 'answer'
      || !atPractice(lesson) || lesson.saved.reviews[lesson.index]) return;
    lesson.saved.answers[lesson.index] = event.target.value.slice(0, 1500);
    save();
  });

  document.addEventListener('change', event => {
    const left = event.target.dataset?.learningMatch;
    if (left === undefined || !/^[0-9]$/.test(left)) return;
    const lesson = currentLesson();
    const assessment = editableAssessment(lesson, event.target);
    if (assessment?.type !== 'match' || Number(left) >= assessment.left.length) return;
    const value = event.target.value;
    if (value !== '' && (!/^[0-9]$/.test(value) || Number(value) >= assessment.right.length)) return;
    const response = [...lesson.study.response];
    response[Number(left)] = value === '' ? null : Number(value);
    updateAssessment(lesson, assessment, response);
    refresh();
    document.querySelector(`select[data-learning-match="${left}"]`)?.focus();
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'learning-plan-form') {
      event.preventDefault();
      void generate(event.target.elements.goal.value.trim(), Number(event.target.elements.minutes.value));
    }
    if (event.target.id === 'learning-step-form') {
      event.preventDefault();
      void reviewAnswer(event.target.elements.answer.value);
    }
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-learning-page], button[data-learning-choice], button[data-learning-order], button[data-learning-step]');
    const lesson = currentLesson();
    if (!button || button.disabled || busy || !isOpen() || !lesson) return;
    const { saved, index, study, pages, page } = lesson;
    const { learningPage, learningChoice, learningOrder, direction, learningStep } = button.dataset;
    if (learningOrder !== undefined) {
      const assessment = editableAssessment(lesson, button);
      if (assessment?.type !== 'order' || !/^[0-9]$/.test(learningOrder) || !['-1', '1'].includes(direction)) return;
      const from = Number(learningOrder), to = from + Number(direction);
      if (from >= assessment.items.length || to < 0 || to >= assessment.items.length) return;
      const response = [...study.response];
      [response[from], response[to]] = [response[to], response[from]];
      updateAssessment(lesson, assessment, response);
      refresh();
      const moved = document.querySelector(`button[data-learning-order="${to}"][data-direction="${direction}"]:not(:disabled)`)
        || document.querySelector(`button[data-learning-order="${to}"]:not(:disabled)`);
      moved?.focus();
      return;
    }
    if (learningChoice !== undefined) {
      if (page !== 'check' || !/^[0-9]$/.test(learningChoice)) return;
      const selection = Number(learningChoice);
      const { assessment } = lesson.step.teaching;
      if (assessment) {
        if (!editableAssessment(lesson, button) || !['choice', 'multi-choice'].includes(assessment.type)
          || selection >= assessment.options.length) return;
        const response = assessment.type === 'choice' ? selection
          : study.response.includes(selection) ? study.response.filter(value => value !== selection) : [...study.response, selection];
        updateAssessment(lesson, assessment, response);
      } else {
        if (selection > 2) return;
        study.choice = selection;
        study.checked = false;
        save();
      }
      refresh();
      if (isOpen()) document.querySelector(`button[data-learning-choice="${learningChoice}"]`)?.focus();
      return;
    }
    if (learningPage) {
      const assessment = lesson.step.teaching?.assessment;
      let rewardEvent;
      if (learningPage === 'check' && page === 'check'
        && !study.checked && (assessment ? isAssessmentReady(assessment, study.response) : study.choice !== null)) {
        study.checked = true;
        rewardEvent = { type: 'check', index, correct: passedCheckpoint(lesson) };
      } else if (learningPage === 'back' && study.page > 0) {
        study.page -= 1;
      } else if (learningPage === 'next' && study.page < pages.length - 1
        && (page !== 'check' || passedCheckpoint(lesson))) {
        study.page += 1;
      } else {
        return;
      }
      save(rewardEvent);
      refresh();
      if (assessment && learningPage === 'check') {
        document.getElementById('learning-check-feedback')?.focus();
      } else focusPage();
      return;
    }
    if (!atPractice(lesson)) return;
    if (learningStep === 'edit' && saved.reviews[index]) {
      saved.reviews[index] = null;
    } else if (learningStep === 'continue' && (saved.reviews[index] || activeReviewError())
      && saved.answers[index].trim()) {
      saved.completed += 1;
    } else {
      return;
    }
    reviewError = '';
    reviewErrorFor = null;
    save(saved.completed === saved.plan.steps.length ? { type: 'complete' } : undefined);
    refresh();
    if (isOpen()) {
      if (learningStep === 'edit') document.querySelector('#learning-step-form textarea:not([hidden])')?.focus();
      else focusPage();
    }
  });

  return { generate, reset, screen: () => ({ goal, minutes, busy, error, reviewError: activeReviewError(), saved: state.learningPlan }) };
}
