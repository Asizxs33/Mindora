import { languageCode } from './language.js';
import { restoreCertificateRecord } from './certificate.js';
import { normalizePractice } from './lesson-practice.js';
import { normalizeLessonVisual } from './lesson-visual.js';
import { isAssessmentCorrect, isAssessmentReady, normalizeAssessment, normalizeAssessmentResponse } from './lesson-assessment.js';

export const PLAN_DURATIONS = Object.freeze({
  5: Object.freeze([2, 3]),
  10: Object.freeze([2, 3, 5]),
  20: Object.freeze([3, 5, 5, 7]),
});
export const PLAN_TEXT_LIMITS = Object.freeze({
  title: 90,
  outcome: 450,
  instruction: 900,
  task: 900,
  criterion: 320,
});

export function planInput(goal, minutes, language) {
  if (typeof goal !== 'string' || !Number.isInteger(minutes) || !Object.hasOwn(PLAN_DURATIONS, minutes)) return null;
  const text = goal.trim();
  return text.length >= 3 && text.length <= 180 ? { goal: text, minutes, language: languageCode(language, 'ru') } : null;
}

export function sourceUrl(value) {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try {
    const url = new URL(value);
    const domain = url.hostname;
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !/^(?:[a-z\d-]+\.)+[a-z]{2,}$/i.test(domain)
      || /\.(?:localhost|local|internal|test|example|invalid|onion)$/i.test(domain)) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function text(value, max) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean && clean.length <= max ? clean : null;
}

function sourceImages(images) {
  if (!Array.isArray(images)) return [];
  const valid = new Map();
  for (const image of images.slice(0, 8)) {
    const url = sourceUrl(image?.url);
    const alt = text(image?.alt, 180);
    if (url && alt) valid.set(url, { url, alt });
  }
  return [...valid.values()];
}

export function taskReviewInput(raw) {
  const goal = text(raw?.goal, 180);
  const task = text(raw?.task, PLAN_TEXT_LIMITS.task);
  const criterion = text(raw?.criterion, PLAN_TEXT_LIMITS.criterion);
  const answer = text(raw?.answer, 1500);
  return goal && task && criterion && answer
    ? { goal, task, criterion, answer, language: languageCode(raw.language, 'ru') }
    : null;
}

export function normalizeTaskReview(raw) {
  const observation = text(raw?.observation, 320);
  const nextAction = text(raw?.nextAction, 320);
  return observation && nextAction ? { observation, nextAction } : null;
}

function normalizeCheckpoint(raw) {
  const question = text(raw?.question, 220);
  const choices = Array.isArray(raw?.choices) && raw.choices.length === 3
    ? Array.from(raw.choices, choice => text(choice, 160)) : [];
  const correctIndex = raw?.correctIndex;
  const feedback = text(raw?.explanation, 320);
  if (!question || choices.length !== 3
    || choices.some(choice => !choice) || new Set(choices).size !== 3
    || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 2 || !feedback) return null;
  return { question, choices, correctIndex, explanation: feedback };
}

function normalizeTeaching(raw, version) {
  const why = text(raw?.why, 220);
  const input = text(raw?.example?.input, 500);
  const output = text(raw?.example?.output, 700);
  const explanation = text(raw?.example?.explanation, 400);
  const takeaway = text(raw?.takeaway, 220);
  if (!why || !input || !output || !explanation || !takeaway) return null;
  const visual = normalizeLessonVisual(raw?.example?.visual);
  const teaching = { why, example: { input, output, explanation, ...(visual ? { visual } : {}) }, takeaway };
  if (version === 3) {
    const assessment = normalizeAssessment(raw?.assessment);
    return assessment ? { ...teaching, assessment } : null;
  }
  const checkpoint = normalizeCheckpoint(raw?.checkpoint);
  return checkpoint ? { ...teaching, checkpoint } : null;
}

export function lessonPages(step, isFinal = false) {
  if (isFinal) return ['practice'];
  if (step?.teaching?.assessment) {
    const illustrations = step.resource?.images?.length ? ['illustration'] : [];
    return ['explain', ...illustrations, 'example', 'check', 'recap', 'practice'];
  }
  return step?.teaching ? ['explain', 'example', 'check', 'practice'] : ['explain', 'practice'];
}

// The server supplies the source map from provider results; free-form model URLs cannot become links.
export function normalizePlan(raw, input, sources) {
  if (!raw || !input || !Array.isArray(raw.steps)) return null;
  const { formatVersion } = raw;
  if (formatVersion !== undefined && formatVersion !== 2 && formatVersion !== 3) return null;
  const detailed = formatVersion !== undefined;
  const durations = PLAN_DURATIONS[input.minutes];
  const title = text(raw.title, PLAN_TEXT_LIMITS.title);
  const outcome = text(raw.outcome, PLAN_TEXT_LIMITS.outcome);
  if (!durations || !title || !outcome || raw.steps.length !== durations.length) return null;
  const steps = [];
  for (const [id, item] of raw.steps.entries()) {
    const title = text(item?.title, PLAN_TEXT_LIMITS.title);
    const instruction = text(item?.instruction, PLAN_TEXT_LIMITS.instruction);
    const task = text(item?.task, PLAN_TEXT_LIMITS.task);
    const criterion = text(item?.criterion, PLAN_TEXT_LIMITS.criterion);
    if (!title || !instruction || !task || !criterion) return null;
    const teaching = detailed && id < durations.length - 1 ? normalizeTeaching(item.teaching, formatVersion) : null;
    if (detailed && id < durations.length - 1 && !teaching) return null;
    const source = sources.get(sourceUrl(item.sourceUrl));
    const selected = Array.isArray(item.illustrationUrls) ? item.illustrationUrls.slice(0, 2) : [];
    const resource = source ? {
      url: source.url, title: source.title,
      images: sourceImages(source.images).filter(image => selected.includes(image.url)),
      imageSourceUrl: sourceUrl(source.imageSourceUrl) || source.url,
    } : null;
    const practice = item.practice === undefined ? null : normalizePractice(item.practice);
    if (item.practice !== undefined && !practice) return null;
    steps.push({ id, title, instruction, task, criterion, minutes: durations[id], resource, ...(teaching ? { teaching } : {}), ...(practice ? { practice } : {}) });
  }
  if (!steps.some(step => step.resource)) return null;
  return { ...input, ...(detailed ? { formatVersion } : {}), title, outcome, steps };
}

function restoreStudy(step, entry, pages) {
  let page = Number.isInteger(entry?.page) ? Math.max(0, Math.min(entry.page, pages.length - 1)) : 0;
  const assessment = step.teaching?.assessment;
  const checkPage = pages.indexOf('check');
  if (assessment) {
    const response = normalizeAssessmentResponse(assessment, entry?.response);
    const checked = entry?.checked === true && isAssessmentReady(assessment, entry.response);
    if (page > checkPage && (!checked || !isAssessmentCorrect(assessment, response))) page = checkPage;
    return { page, choice: null, checked, response };
  }
  const checkpoint = step.teaching?.checkpoint;
  const choice = checkpoint && Number.isInteger(entry?.choice) && entry.choice >= 0 && entry.choice <= 2 ? entry.choice : null;
  const checked = choice !== null && entry?.checked === true;
  if (checkpoint && page > checkPage && (!checked || choice !== checkpoint.correctIndex)) page = checkPage;
  return { page, choice, checked };
}

export function restorePlan(saved) {
  const input = planInput(saved?.plan?.goal, saved?.plan?.minutes, saved?.plan?.language);
  if (!input || !Array.isArray(saved.plan.steps)) return null;
  const sources = new Map();
  const steps = saved.plan.steps.map(step => {
    const url = sourceUrl(step?.resource?.url);
    const title = text(step?.resource?.title, 160);
    const images = sourceImages(step?.resource?.images).slice(0, 2);
    if (url && title) sources.set(url, {
      url, title, images: sourceImages([...(sources.get(url)?.images ?? []), ...images]),
      imageSourceUrl: sourceUrl(step.resource.imageSourceUrl) || url,
    });
    return { ...step, sourceUrl: url, illustrationUrls: images.map(image => image.url) };
  });
  const plan = normalizePlan({ ...saved.plan, steps }, input, sources);
  if (!plan) return null;
  const answers = plan.steps.map(({ id }) => typeof saved.answers?.[id] === 'string' ? saved.answers[id].slice(0, 1500) : '');
  const reviews = answers.map((answer, index) => {
    const entry = saved.reviews?.[index];
    if (!answer.trim() || entry?.answer !== answer.trim()) return null;
    const review = normalizeTaskReview(entry);
    return review ? { answer: entry.answer, ...review } : null;
  });
  let completed = 0;
  while (completed < plan.steps.length && completed < saved.completed && answers[completed].trim()) completed++;
  const study = plan.steps.map((step, index) => restoreStudy(
    step, saved.study?.[index], lessonPages(step, index === plan.steps.length - 1),
  ));
  const finished = Array.isArray(saved.finished)
    ? plan.steps.map((_, i) => i).filter(i => saved.finished.includes(i) && answers[i].trim()) : null;
  const selected = saved.selected;
  const count = finished?.length ?? completed;
  const certificate = count === plan.steps.length ? restoreCertificateRecord(saved.certificate) : null;
  return { plan, answers, reviews, completed: count, study,
    ...(certificate ? { certificate } : {}),
    ...(finished ? { finished } : {}),
    ...(Number.isInteger(selected) && selected >= 0 && selected < steps.length ? { selected } : {}) };
}
