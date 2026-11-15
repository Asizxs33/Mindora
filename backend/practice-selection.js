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
  const subject = /\b(?:math(?:ematics)?|arithmetic|algebra|geometry|percent(?:age)?s?|fractions?|equations?|logarithms?)\b|логар|логор|математ|арифмет|алгебр|геометр|процент|пайыз|дроб|бөлшек|уравнен|теңдеу/iu;
  const action = /\b(?:calculate|compute|solve|work out|find the (?:value|total|area|answer))\b|(?:вычисл|рассчита|посчита|сосчита|реши|найди\s+(?:значение|площадь|сумму|ответ))\p{L}*|есепте|теңдеуді\s+шеш/iu;
  const discount = /\bdiscounts?\b|скидк|жеңілдік/iu.test(`${context} ${task}`)
    && /\d+(?:[.,]\d+)?\s*(?:%|₽|\$|€|руб|usd|тенге)|[$€₽]\s*\d/iu.test(task);
  const drawing = /\b(?:draw|sketch|plot)\b|нарис\p{L}*|начерт\p{L}*|постро\p{L}*[^.!?\n]{0,30}(?:график|диаграмм)|сурет\s+сал|график\p{L}*\s+сыз/iu;
  return (subject.test(`${context} ${task}`) || discount) && action.test(task) && !asksForCode(task) && !drawing.test(task);
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
  if (/capy|капибар|мино|миноны/i.test(context) && /forward|repeat|команд|басқар|instruction|move|движ/i.test(task)) return { type: 'code', language: 'capy' };
  if (/\b(draw|sketch|paint|diagram|flowchart)\b|нарис|рисова|сурет.*сал|сызба.*сыз/i.test(task) && !/\b(graph|plot|function)\b|график|функци/i.test(task)) return { type: 'drawing' };
  if (python.test(context) && !foreignStage && !otherLanguage.test(task) && asksForCode(task)) return { type: 'code', language: 'python' };
  if (!python.test(context) && asksForPalette(task, context)) return { type: 'palette' };
  if (/linear|quadratic|exponential|logarith|линейн|квадрат|логар|сызық/i.test(context) && /plot|graph|график|сыз/i.test(task) && !/area|площад|аудан|integral|интеграл/i.test(task)) return { type: 'calculation', visual: 'graph' };
  if (asksForCalculation(task, context)) return /logarith|логар|логор/i.test(context) ? { type: 'calculation', visual: 'logarithm' } : { type: 'calculation' };
  return { type: 'text' };
}
