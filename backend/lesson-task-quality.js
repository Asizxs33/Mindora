import { PLAN_TEXT_LIMITS } from '../core/learning-plan.js';

// Text practice has an editor, not the options used by teaching.assessment.
// Keep this guard narrow: it catches an unavailable interaction, not writing quality.
const englishChoice = /\b(?:choose|select|pick|mark|tick)\b[^.!?\n]{0,120}\b(?:answers?|options?|responses?|greetings?|sentences?|phrases?|words?|hooks?|headlines?|ctas?)\b/iu;
const russianChoice = /(?:^|[^\p{L}])(?:выбери(?:те)?|выбрать|отметь(?:те)?|отметить)[^.!?\n]{0,120}(?:вариант|ответ|приветств|предложен|фраз|слов|заголов|призыв|обращен)/iu;
const kazakhChoice = /(?:жауап|нұсқа|сәлемдесу|сөйлем|сөз|тақырып)[^.!?\n]{0,120}(?:таңда|белгіле)|(?:таңда|белгіле)[^.!?\n]{0,120}(?:жауап|нұсқа|сәлемдесу|сөйлем|сөз)/iu;

function asksForWrittenWork(task) {
  // A negated action or copying a selected option's index is not written practice.
  const actionable = task
    .replace(/\b(?:do\s+not|don't|don’t|never)\s+(?:write|rewrite|compose|draft|type|complete|fill|create)\b[^.!?;\n]*/giu, '')
    .replace(/(?:^|[^\p{L}])не\s+(?:пиши|пишите|записывай|записывайте|составляй|составляйте|переписывай|переписывайте|отвечай|отвечайте)[^.!?;\n]*/giu, '')
    .replace(/(?:^|[^\p{L}])(?:жазба|жазбай|құрастырма|толықтырма|түзетпе)\p{L}*/giu, '')
    .replace(/\b(?:write|type|copy)\s+(?:down\s+)?(?:the\s+)?(?:number|letter|index)\b[^.!?;\n]*/giu, '')
    .replace(/(?:^|[^\p{L}])(?:напиши(?:те)?|запиши(?:те)?)\s+(?:номер|букву|индекс)\p{L}*[^.!?;\n]*/giu, '');
  return /\b(?:write|rewrite|compose|draft|type|complete|fill|create|revise|reply|respond)\b/iu.test(actionable)
    || /(?:^|[^\p{L}])(?:напиши(?:те)?|запиши(?:те)?|составь(?:те)?|перепиши(?:те)?|дополни(?:те)?|отредактируй(?:те)?|сформулируй(?:те)?|исправь(?:те)?|ответь(?:те)?)(?=$|[^\p{L}])/iu.test(actionable)
    || /(?:^|[^\p{L}])(?:жаз(?:ыңыз|ыңдар|у)?|құрастыр\p{L}*|толықтыр\p{L}*|түзет\p{L}*|жауап\s+бер\p{L}*)(?=$|[^\p{L}])/iu.test(actionable);
}

export function isLessonTaskUsable(step, subject) {
  if (!['english', 'smm'].includes(subject) || step?.practice?.type !== 'text') return true;
  if (typeof step.task !== 'string' || !step.task.trim() || step.task.length > PLAN_TEXT_LIMITS.task) return false;
  const criterion = step.criterion ?? '';
  if (typeof criterion !== 'string' || criterion.length > PLAN_TEXT_LIMITS.criterion) return false;
  const instructions = `${step.task}\n${criterion}`;
  const asksForChoice = englishChoice.test(instructions) || russianChoice.test(instructions) || kazakhChoice.test(instructions);
  return !asksForChoice || asksForWrittenWork(step.task);
}
