// Resolve learning domains before incidental words such as discounts or colors.
export function lessonTopic(topic) {
  if (typeof topic !== 'string') return null;
  if (/\b(?:python|javascript|typescript|java|sql|html|css|rust|ruby|golang|kotlin|php|swift|bash|powershell|scala|dart|elixir)\b|\bc\s*(?:\+\+|#)|программир|\bgo\s+(?:programming|language|code)\b|\b(?:language|язык)\s+go\b/iu.test(topic)) return null;
  if (/\bsmm\b|\bsocial\s+media\b|\binstagram\b|соцсет|социальн.{0,15}сет|инстаграм|әлеуметтік.{0,15}желі/iu.test(topic)) return 'smm';
  if (/\benglish\b|английск|ағылшын/iu.test(topic)) return 'english';
  return null;
}

export function topicVisualSchema(topic) {
  switch (lessonTopic(topic)) {
    case 'english': return { type: 'dialogue', label: 'Short real-life situation in the learner language', turns: [
      { speaker: 'Alex', text: "Hi, I’m Alex.", translation: 'Translation in the learner language' },
      { speaker: 'Sam', text: "Hi, Alex. I’m Sam. Nice to meet you.", translation: 'Translation in the learner language' },
    ] };
    case 'smm': return { type: 'social-post', audience: 'Specific audience from the example', hook: 'Opening line from the worked example', body: 'One concrete benefit or useful detail from the example', cta: 'One clear action from the example' };
    default: return null;
  }
}
