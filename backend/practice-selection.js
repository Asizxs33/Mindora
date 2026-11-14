import { normalizePractice } from '../core/lesson-practice.js';

const bounded = value => typeof value === 'string' ? value.slice(0, 1000).toLowerCase() : '';
const python = /\bpython\b|питон|пайтон/iu;
const otherLanguage = /\b(?:javascript|typescript|java|rust|go|golang|ruby|php|swift|kotlin|sql|html|css|bash|powershell|scala|dart|elixir)\b|\bc\s*(?:\+\+|#)|\b(?:in|using)\s+[cr]\b|на\s+си\b|джаваскрипт|тайпскрипт/iu;
const codeObject = /\b(?:code|program|script|loop|function)\b|код\p{L}*|программ\p{L}*|скрипт\p{L}*|цикл\p{L}*|функци\p{L}*/iu;

function asksForCode(task) {
  // Require an action on code, not merely a Python word in a reading task.
  const action = /\b(?:write|create|implement|complete|fix|debug|build|run|execute)\b|(?:напиш|созда|реализ|допол|исправ|перепиш|запуст|выполн)\p{L}*/giu;
  for (const match of task.matchAll(action)) {
    const after = task.slice(match.index + match[0].length).split(/[.!?\n]/, 1)[0].slice(0, 80);
    const object = after.match(codeObject);
    if (!object) continue;
    const between = after.slice(0, object.index);
    if (!/explanation|description|comparison|объяснен|описан|сравнен/iu.test(between)) return true;
  }
  return /(?:код|бағдарлама|цикл|функция)[^.!?\n]{0,70}(?:жаз|құр|түзет|толықтыр|іске қос)/iu.test(task)
    || /(?:вывед\p{L}*|басып шығар|\bprint\b)[^.!?\n]{0,70}(?:print\s*\(|\bconsole\b|консол|экран)/iu.test(task);
}

function asksForPalette(task, context) {
  const colors = /\bcolou?rs?\b|\bpalette\b|палитр|цвет\p{L}*|түстер|түсті|түсін/iu;
  const action = /\b(?:choose|select|pick|create|build|design|compose)\b|(?:выбер|подбер|созда|состав)\p{L}*|таңда|құрастыр/iu;
  const needsDrawing = /\b(?:draw|sketch|paint|illustrate)\b|нарис\p{L}*|сурет\s+сал|сызба\s+сыз/iu;
  const visualSubject = /\b(?:design|graphic|brand|poster|palette|colou?rs?)\b|дизайн|палитр|цвет|графич|түстер|түсті/iu;
  return visualSubject.test(context) && colors.test(task) && action.test(task) && !needsDrawing.test(task);
}

function asksForCalculation(task, context) {
  const subject = /\b(?:math(?:ematics)?|arithmetic|algebra|geometry|percent(?:age)?s?|fractions?|equations?)\b|математ|арифмет|алгебр|геометр|процент|пайыз|дроб|бөлшек|уравнен|теңдеу/iu;
  const action = /\b(?:calculate|compute|solve|work out|find the (?:value|total|area|answer))\b|(?:вычисл|рассчита|реши|найди\s+(?:значение|площадь|сумму|ответ))\p{L}*|есепте|теңдеуді\s+шеш/iu;
  return subject.test(`${context} ${task}`) && action.test(task) && !asksForCode(task);
}

// Repairs a missing/text workspace only when the actual task supports the editor.
// This runs at generation time; it never rewrites a saved learner's course.
export function selectLessonPractice(step, input = {}) {
  const declared = step?.practice === undefined ? null : normalizePractice(step.practice);
  if (step?.practice !== undefined && !declared) return null;
  if (declared && declared.type !== 'text') return declared;

  const stage = input.roadmapStage;
  const focus = [stage?.title, stage?.objective, step?.title].map(bounded).join(' ');
  const context = [input.goal, stage?.originalGoal, stage?.goal, stage?.title, stage?.objective, step?.title].map(bounded).join(' ');
  const task = bounded(step?.task);
  const foreignStage = otherLanguage.test(focus) && !python.test(focus);
  if (python.test(context) && !foreignStage && !otherLanguage.test(task) && asksForCode(task)) return { type: 'code', language: 'python' };
  if (!python.test(context) && asksForPalette(task, context)) return { type: 'palette' };
  if (asksForCalculation(task, context)) return { type: 'calculation' };
  return { type: 'text' };
}
