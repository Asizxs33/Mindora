import { icon } from './icons.js';

const covers = [
  ['social-media', /smm|соцсет|социальн[\p{L}]* сет|әлеуметтік желі|social media/iu],
  ['everyday-english', /english|англий|ағылшын/i],
  ['everyday-kazakh', /kazakh|казахск|қазақ тіл/i],
  ['python', /python|питон/i],
  ['web-basics', /javascript|html|\bcss\b|веб-разработ|web basics/i],
  ['spreadsheets', /spreadsheet|excel|таблиц|кесте|бюджет/i],
  ['graphic-design', /graphic design|графическ|дизайн|figma|poster|постер/i],
  ['drawing', /\bdraw(?:ing)?\b|illustrat|рисован|рисовать|сурет сал/i],
  ['presentation', /presentation|презентаци|powerpoint/i],
  ['photography', /photograph|фотограф|фотосъ[её]м|фото түсір/i],
  ['video-editing', /video edit|edit a video|видеомонтаж|монтаж видео|монтировать видео|бейне өңде/i],
  ['copywriting', /copywriting|clear-writing|копирайт|писать текст|пиши понятно/i],
  ['ai-literacy', /ai[- ]prompts?|chatgpt|нейросет|искусственн|жасанды интеллект|промпт|запрос\s+(?:к|для)\s+ИИ|ЖИ[- ]?ге/iu],
];

export function courseIllustration(course, defaultIcon = 'book', size = 22) {
  const subject = [course.id, course.title, course.goal].filter(Boolean).join(' ');
  let cover = covers.find(([, pattern]) => pattern.test(subject))?.[0];
  // The calendar is useful for a course about scheduling posts. Use a
  // conversation motif when the title emphasizes audiences or strategy.
  if (cover === 'social-media' && /аудитори|audience|стратеги|strategy/i.test(course.title || '')) {
    cover = 'communication';
  }
  const math = /\bmath(?:ematics)?\b|logarith|логар|логор|математик|алгебр|геометри/i.test(subject);
  const code = /\bprogramming\b|программирован|бағдарламалау/i.test(subject);
  const fallback = math ? 'chart' : code ? 'code' : defaultIcon;
  return cover
    ? `<img src="${new URL(`./assets/design-pack/course-${cover}.png`, import.meta.url).href}" width="72" height="72" alt="" loading="lazy" decoding="async">`
    : icon(fallback, size);
}
