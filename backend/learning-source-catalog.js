// Verified instructional entry points, not course content or cached search results.
// Callers must fetch the page, check relevance and attribute the actual source.
// Public availability does not grant permission to republish complete lessons/images.
const SOURCE = {
  python: ['https://docs.python.org/3/tutorial/introduction.html', 'Python: An Informal Introduction'],
  pythonFlow: ['https://docs.python.org/3/tutorial/controlflow.html', 'Python: More Control Flow Tools'],
  html: ['https://github.com/microsoft/Web-Dev-For-Beginners/blob/main/3-terrarium/1-intro-to-html/README.md', 'Microsoft: Introduction to HTML'],
  css: ['https://github.com/microsoft/Web-Dev-For-Beginners/blob/main/3-terrarium/2-intro-to-css/README.md', 'Microsoft: Introduction to CSS'],
  colors: ['https://www.adobe.com/creativecloud/design/discover/secondary-colors.html', 'Adobe: Primary, Secondary and Tertiary Colors'],
  colorModels: ['https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Color_values', 'MDN: CSS Color Values and HSL'],
  shapes: ['https://www.adobe.com/learn/illustrator/web/illustration-techniques', 'Adobe Illustrator: Essential Techniques for Beginners'],
  percent: ['https://en.wikibooks.org/wiki/Primary_Mathematics/Percentages', 'Wikibooks: Percentages'],
  sum: ['https://support.google.com/docs/answer/3093669?hl=en', 'Google Sheets: SUM'],
  sumif: ['https://support.google.com/docs/answer/3093583?hl=en', 'Google Sheets: SUMIF'],
  writing: ['https://developers.google.com/tech-writing/one/clear-sentences', 'Google: Clear Sentences'],
  email: ['https://mailchimp.com/en/help/best-practices-for-email-subject-lines/', 'Mailchimp: Best Practices for Email Subject Lines'],
  englishIntro: ['https://learnenglish.britishcouncil.org/free-resources/speaking/a1/meeting-new-people', 'British Council: A1 Meeting New People'],
  socialPost: ['https://buffer.com/resources/copywriting-formulas/', 'Buffer: Copywriting Formulas for Social Posts'],
  socialCalendar: ['https://buffer.com/resources/social-media-calendar/', 'Buffer: Create a Social Media Content Calendar'],
  chatgpt: ['https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt', 'OpenAI: Prompt Engineering Best Practices for ChatGPT'],
  prompts: ['https://github.com/microsoft/generative-ai-for-beginners/blob/main/04-prompt-engineering-fundamentals/README.md', 'Microsoft: Prompt Engineering Fundamentals'],
};

function suggestions(...keys) {
  return keys.slice(0, 2).map((key) => ({ url: SOURCE[key][0], title: SOURCE[key][1], content: '' }));
}

/** Suggest at most two exact instructional pages; unfamiliar topics have no fallback. */
export function sourceSuggestions(topic) {
  if (typeof topic !== 'string' || !topic.trim()) return [];
  const text = topic.normalize('NFKC').toLowerCase();

  // Resolve subject before incidental words such as Python "colors" or "sum".
  if (/\bpython\b|питон|пайтон/u.test(text)) {
    return /\b(?:loops?|while|functions?|conditionals?)\b|цикл|функци|услов|шарт/u.test(text)
      ? suggestions('pythonFlow') : suggestions('python');
  }
  if (/\bcss\b/u.test(text)) return suggestions('css');
  if (/\bhtml\b|в[её]рстк|веб.бет/u.test(text)) return suggestions('html');
  // Keep application-specific lessons within the requested application.
  if (/\b(?:excel|javascript|typescript|java|sql)\b/u.test(text)) return [];
  if (/\bsumif\b|суммесли/u.test(text)) return suggestions('sumif');
  if (/google\s*sheets|гугл.{0,10}таблиц/u.test(text)) {
    return /\bsum\b|сумм|қосынды|total/u.test(text) ? suggestions('sum') : [];
  }
  // A language lesson about colors or an advertising post about a discount
  // needs its own subject's sources, not a design or mathematics lesson.
  if (/\bsmm\b|\bsocial\s+media\b|\binstagram\b|соцсет|социальн.{0,15}сет|инстаграм|әлеуметтік.{0,15}желі/u.test(text)) {
    if (/\bcalendars?\b|\bcontent\s+plans?\b|контент[\s-]*план|календар|контент.{0,15}жоспар|жарияланым.{0,15}жоспар/u.test(text)) return suggestions('socialCalendar');
    if (/\b(?:posts?|captions?|hooks?|copywriting|cta)\b|(?:^|[^\p{L}])пост(?:а|ы|ов|у|ом|е)?(?=$|[^\p{L}])|подпис.{0,15}(?:фото|публикац)|текст.{0,15}публикац|копирайт|жарияланым|жазба|мәтін/u.test(text)) return suggestions('socialPost');
    return [];
  }
  if (/\benglish\b|английск|ағылшын/u.test(text)) {
    return /\b(?:introduc\w*|greetings?|hello)\b|\bmeet(?:ing)?\s+new\s+people\b|знаком|представ|приветств|рассказ.{0,15}себ|таныс|таныстыр|сәлем|өзі.{0,15}туралы/u.test(text)
      ? suggestions('englishIntro') : [];
  }
  if (/\b(?:chatgpt|chat\s*gpt)\b/u.test(text)) {
    // Tool-specific instructions need a fresh targeted search, not a prompting guide.
    if (/\b(?:search|voice|image|video|agent)\b|поиск|голос|изображ|сурет|іздеу/u.test(text)) return [];
    return suggestions('chatgpt');
  }
  if (/\bprompt(?:s|ing|\s+engineering)?\b|промпт|запрос.{0,20}(?:ии|нейросет)|сұрау.{0,15}ж[иі]/u.test(text)) {
    return suggestions('prompts', 'chatgpt');
  }
  if (/\billustrator\b|векторн.{0,15}(?:рис|иллюстрац)|векторлық/u.test(text)) return suggestions('shapes');
  if (/\bhsl\b|\bcolou?r\s+models?\b|цветов.{0,8}модел|\b(?:hue|saturation|lightness)\b/u.test(text)) return suggestions('colorModels');
  if (/\b(?:color|colour|palette)s?\b|цвет|палитр|түстер|түс\s+үйлес/u.test(text)) return suggestions('colors');
  if (/\b(?:percent(?:age)?s?|discounts?)\b|процент|скидк|пайыз|жеңілдік/u.test(text)) return suggestions('percent');
  if (/subject\s*line|email\s*(?:marketing|copy)|тем[аыу]\s+пис|рассылк|хаттың\s+тақырыб/u.test(text)) return suggestions('email');
  if (/clear\s+(?:sentences|writing)|\b(?:copywriting|technical\s+writing)\b|копирайт|ясн.{0,12}текст|понятн.{0,12}текст|түсінікті\s+мәтін/u.test(text)) return suggestions('writing');
  return [];
}
