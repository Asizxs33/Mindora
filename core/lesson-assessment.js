export const LESSON_ASSESSMENT_LIMITS = Object.freeze({
  question: 220,
  item: 160,
  explanation: 320,
  gapContext: 240,
  gapAnswer: 160,
  maxAccepted: 5,
});

function text(value, max) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean && clean.length <= max ? clean : null;
}

function textList(values, min, max, itemLimit) {
  if (!Array.isArray(values) || values.length < min || values.length > max) return null;
  const clean = Array.from(values, value => text(value, itemLimit));
  return clean.every(Boolean) && new Set(clean).size === clean.length ? clean : null;
}

function isIndex(value, count) {
  return Number.isInteger(value) && value >= 0 && value < count;
}

function distinctIndices(values, count) {
  return Array.isArray(values) && values.length <= count && new Set(values).size === values.length
    && Array.from(values).every(value => isIndex(value, count));
}

function isPermutation(values, count) {
  return distinctIndices(values, count) && values.length === count;
}

function gapText(value) {
  return value.trim().normalize('NFC');
}

export function normalizeAssessment(raw) {
  const { question: questionLimit, explanation: explanationLimit, item, gapContext, gapAnswer, maxAccepted } = LESSON_ASSESSMENT_LIMITS;
  const question = text(raw?.question, questionLimit);
  const explanation = text(raw?.explanation, explanationLimit);
  if (!question || !explanation) return null;
  const { type } = raw;
  const base = { type, question, explanation };
  switch (type) {
    case 'choice': {
      const options = textList(raw.options, 3, 5, item);
      return options && isIndex(raw.answer, options.length) ? { ...base, options, answer: raw.answer } : null;
    }
    case 'multi-choice': {
      const options = textList(raw.options, 3, 5, item);
      if (!options || !distinctIndices(raw.answers, options.length)
        || raw.answers.length < 2 || raw.answers.length >= options.length) return null;
      return { ...base, options, answers: [...raw.answers].sort((a, b) => a - b) };
    }
    case 'order': {
      const items = textList(raw.items, 3, 5, item);
      return items && isPermutation(raw.answer, items.length) ? { ...base, items, answer: [...raw.answer] } : null;
    }
    case 'match': {
      const left = textList(raw.left, 3, 4, item);
      const right = textList(raw.right, 3, 4, item);
      return left && right && left.length === right.length && isPermutation(raw.answer, right.length)
        ? { ...base, left, right, answer: [...raw.answer] } : null;
    }
    case 'gap-fill': {
      if (typeof raw.before !== 'string' || typeof raw.after !== 'string') return null;
      const before = raw.before.trim();
      const after = raw.after.trim();
      const normalized = Array.isArray(raw.accepted) && raw.accepted.length <= maxAccepted
        ? Array.from(raw.accepted, value => typeof value === 'string' ? gapText(value) : null) : null;
      const accepted = textList(normalized, 1, maxAccepted, gapAnswer);
      return (before || after) && before.length <= gapContext && after.length <= gapContext && accepted
        ? { ...base, before, after, accepted } : null;
    }
    default:
      return null;
  }
}

export function normalizeAssessmentResponse(assessment, response) {
  switch (assessment.type) {
    case 'choice':
      return isIndex(response, assessment.options.length) ? response : null;
    case 'multi-choice': {
      if (!Array.isArray(response)) return [];
      const count = assessment.options.length;
      const indices = response.slice(0, count).filter(value => isIndex(value, count));
      return [...new Set(indices)].sort((a, b) => a - b);
    }
    case 'order':
      return isPermutation(response, assessment.items.length)
        ? [...response] : assessment.items.map((_, index) => index);
    case 'match':
      return assessment.left.map((_, index) => {
        const value = Array.isArray(response) ? response[index] : null;
        return isIndex(value, assessment.right.length) ? value : null;
      });
    case 'gap-fill':
      return typeof response === 'string' ? response.slice(0, LESSON_ASSESSMENT_LIMITS.gapAnswer) : '';
    default:
      return null;
  }
}

export function isAssessmentReady(assessment, response) {
  switch (assessment.type) {
    case 'choice':
      return isIndex(response, assessment.options.length);
    case 'multi-choice':
      return distinctIndices(response, assessment.options.length) && response.length > 0;
    case 'order':
      return isPermutation(response, assessment.items.length);
    case 'match':
      return isPermutation(response, assessment.right.length);
    case 'gap-fill':
      return typeof response === 'string' && response.length <= LESSON_ASSESSMENT_LIMITS.gapAnswer && Boolean(gapText(response));
    default:
      return false;
  }
}

export function isAssessmentCorrect(assessment, response) {
  if (!isAssessmentReady(assessment, response)) return false;
  switch (assessment.type) {
    case 'choice':
      return response === assessment.answer;
    case 'multi-choice':
      return response.length === assessment.answers.length && response.every(value => assessment.answers.includes(value));
    case 'order':
    case 'match':
      return response.every((value, index) => value === assessment.answer[index]);
    case 'gap-fill':
      return assessment.accepted.includes(gapText(response));
    default:
      return false;
  }
}
