// One subject decision for the path, teaching, feedback and course result.
export function subjectForTopic(topic = '') {
  const value = String(topic).toLowerCase();
  if (/logarith|логар|логор|математ|алгебр|геометр|арифмет|теңдеу|бөлшек|пайыз|\b(math|mathematics|algebra|geometry|calculus|equation|fraction|percent)\b/.test(value)) return 'math';
  if (/\b(code|coding|python|javascript|programming|html|css|sql|spreadsheet|excel|budget)\b|программ|код|бағдарлам|таблиц|кесте|бюджет/.test(value)) return 'technology';
  if (/\b(art|draw|drawing|paint|painting|sketch)\b|рисова|нарис|сурет|кескін/.test(value)) return 'art';
  if (/\b(design|layout|poster|typography|figma)\b|дизайн|плакат|постер/.test(value)) return 'design';
  if (/\b(smm|social|marketing|instagram)\b|маркет|соцсет/.test(value)) return 'marketing';
  if (/\b(write|writing|copywriting|story|text|grammar|language|english|prompt)\b|писат|текст|жазу|граммат|англий|ағылшын|язык|тіл/.test(value)) return 'writing';
  return 'general';
}
export function mentorForTopic(topic = '') {
  return { math: 'sam', technology: 'sam', art: 'artist', design: 'mia', marketing: 'smm', writing: 'copywriter', general: 'mino' }[subjectForTopic(topic)];
}
export const isLogarithmTopic = topic => /logarith|логар|логор/i.test(String(topic));
