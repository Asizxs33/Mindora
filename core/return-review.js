import { normalizeAssessment, normalizeAssessmentResponse, isAssessmentReady, isAssessmentCorrect } from './lesson-assessment.js';

export const RETURN_REVIEW_AFTER_MS = 24 * 60 * 60 * 1000;
const phases = new Set(['intro', 'question', 'foundations', 'repair', 'complete']);
const plain = (value, max = 1200) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function needsReturnReview(lastSeen, hasLearned, now = Date.now()) {
  const previous = Number(lastSeen);
  return Boolean(hasLearned && Number.isFinite(previous) && previous > 0 && Number.isFinite(now)
    && now - previous > RETURN_REVIEW_AFTER_MS);
}

export function learningHasProgress(saved) {
  return Boolean(saved?.completed > 0 || saved?.study?.some(entry => entry.page > 0 || entry.checked)
    || saved?.answers?.some(answer => typeof answer === 'string' && answer.trim()));
}

// Reuse real questions from the material already encountered. Never invent a
// scored question for a legacy plan that has no assessment.
export function learningReviewQuestions(saved) {
  const completed = Math.max(0, Number(saved?.completed) || 0);
  return (Array.isArray(saved?.plan?.steps) ? saved.plan.steps : []).flatMap((step, index) => {
    if (!step || typeof step !== 'object') return [];
    if (index > completed || (index === completed && !(saved.study?.[index]?.page > 0 || saved.study?.[index]?.checked))) return [];
    const teaching = step.teaching;
    const checkpoint = teaching?.checkpoint;
    const assessment = normalizeAssessment(teaching?.assessment || (checkpoint && {
      type: 'choice', question: checkpoint.question, options: checkpoint.choices,
      answer: checkpoint.correctIndex, explanation: checkpoint.explanation,
    }));
    return assessment ? [{ assessment, title: plain(step.title, 160), reminder: plain(teaching.takeaway || step.instruction), detail: plain(step.instruction) }] : [];
  }).slice(-2);
}

export function createReturnReview({ key, title = '', mentor = 'mino', questions = [], reminder = '', cursor = null, intent = 'resume' } = {}) {
  if (typeof key !== 'string' || !key || key.length > 500) return null;
  const items = (Array.isArray(questions) ? questions : []).slice(0, 2).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const assessment = normalizeAssessment(item.assessment || item);
    return assessment ? [{ assessment, title: plain(item.title, 160), reminder: plain(item.reminder || assessment.explanation), detail: plain(item.detail || item.reminder || assessment.explanation) }] : [];
  });
  return {
    version: 1, key, title: plain(title, 180), mentor: ['mino', 'mia', 'sam', 'artist', 'copywriter', 'smm'].includes(mentor) ? mentor : 'mino',
    reminder: plain(reminder), cursor: cursor ? structuredClone(cursor) : null, intent: intent === 'practice' ? 'practice' : 'resume',
    questions: items, phase: 'intro', index: 0,
    responses: items.map(item => normalizeAssessmentResponse(item.assessment)),
    firstPass: items.map(() => null), checked: false,
  };
}

export function restoreReturnReview(raw, expectedKey) {
  if (!raw || raw.version !== 1 || raw.key !== expectedKey) return null;
  const review = createReturnReview(raw);
  if (!review || !phases.has(raw.phase)) return null;
  review.phase = raw.phase;
  if (!review.questions.length && !['intro', 'complete'].includes(review.phase)) review.phase = 'intro';
  review.index = Math.max(0, Math.min(review.questions.length - 1, Number.isInteger(raw.index) ? raw.index : 0));
  review.responses = review.questions.map((item, i) => normalizeAssessmentResponse(item.assessment, raw.responses?.[i]));
  review.firstPass = review.questions.map((_, i) => typeof raw.firstPass?.[i] === 'boolean' ? raw.firstPass[i] : null);
  review.checked = raw.checked === true && Boolean(review.questions[review.index])
    && isAssessmentReady(review.questions[review.index].assessment, review.responses[review.index]);
  return review;
}

export function reviewScore(review) {
  return { correct: review.firstPass.filter(value => value === true).length, total: review.questions.length };
}

export function currentReviewCorrect(review) {
  const question = review.questions[review.index];
  return Boolean(question && review.checked && isAssessmentCorrect(question.assessment, review.responses[review.index]));
}

export function reviewCanCheck(review) {
  return ['question', 'repair'].includes(review.phase) && !review.checked
    && Boolean(review.questions[review.index]) && isAssessmentReady(review.questions[review.index].assessment, review.responses[review.index]);
}

// Pure transitions: this never touches the source plan, drafts, certificates,
// course completion or saved cursor. Recall is preparation, not course credit.
export function transitionReturnReview(review, action) {
  if (!review || !action) return review;
  const next = structuredClone(review);
  const question = next.questions[next.index];
  if (action.type === 'answer' && question && ['question', 'repair'].includes(next.phase)) {
    // First-pass answers are final once checked. Repair permits another try.
    if (next.checked && (next.phase === 'question' || currentReviewCorrect(next))) return review;
    next.responses[next.index] = normalizeAssessmentResponse(question.assessment, action.response);
    next.checked = false;
    return next;
  }
  if (action.type === 'check' && reviewCanCheck(next)) {
    next.checked = true;
    if (next.phase === 'question' && next.firstPass[next.index] === null) {
      next.firstPass[next.index] = isAssessmentCorrect(question.assessment, next.responses[next.index]);
    }
    return next;
  }
  if (action.type !== 'next') return review;
  if (next.phase === 'intro') {
    next.phase = next.questions.length ? 'question' : 'complete';
  } else if (next.phase === 'question' && next.checked) {
    if (next.index < next.questions.length - 1) next.index++;
    else {
      const score = reviewScore(next);
      next.phase = score.correct / score.total >= .7 ? 'complete' : 'foundations';
      next.index = 0;
    }
    next.checked = false;
  } else if (next.phase === 'foundations') {
    if (next.index < next.questions.length - 1) next.index++;
    else {
      next.index = 0; next.phase = 'repair';
      next.responses = next.questions.map(item => normalizeAssessmentResponse(item.assessment));
    }
    next.checked = false;
  } else if (next.phase === 'repair' && currentReviewCorrect(next)) {
    if (next.index < next.questions.length - 1) next.index++;
    else next.phase = 'complete';
    next.checked = false;
  } else return review;
  return next;
}
