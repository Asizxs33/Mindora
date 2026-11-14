import { escapeHtml as esc } from '../core/engine.js';
import { languageCode } from '../core/language.js';
import { normalizeLessonVisual, visualContrastRatio } from '../core/lesson-visual.js';
import { currentLanguage } from './language.js';

const copy = {
  en: { example: 'Visual example', palette: 'A palette in action', background: 'Background', text: 'Text', accent: 'Accent', action: 'Learn more', contrast: 'Text contrast', readable: 'At least 4.5:1 for normal text', lowContrast: 'Below 4.5:1: increase text contrast', percent: 'Percent means out of 100', square: 'Each square is 1%', shaded: 'Shaded', remaining: 'Remaining', of: 'of', equals: 'equals', approximately: 'approximately', calculation: 'From the picture to the calculation' },
  ru: { example: 'Наглядный пример', palette: 'Палитра в действии', background: 'Фон', text: 'Текст', accent: 'Акцент', action: 'Узнать больше', contrast: 'Контраст текста', readable: 'Не менее 4,5:1 для обычного текста', lowContrast: 'Меньше 4,5:1: повысь контраст текста', percent: 'Процент — это доля из 100', square: 'Каждый квадрат — 1%', shaded: 'Закрашено', remaining: 'Осталось', of: 'от', equals: 'равно', approximately: 'примерно', calculation: 'От картинки к вычислению' },
  kk: { example: 'Көрнекі мысал', palette: 'Іс жүзіндегі түстер', background: 'Фон', text: 'Мәтін', accent: 'Акцент', action: 'Толығырақ', contrast: 'Мәтін контрасты', readable: 'Қалыпты мәтін үшін кемінде 4,5:1', lowContrast: '4,5:1-ден төмен: мәтін контрастын арттыр', percent: 'Пайыз — 100-ден бір үлес', square: 'Әр шаршы — 1%', shaded: 'Боялған', remaining: 'Қалғаны', of: 'санының', equals: 'тең', approximately: 'шамамен', calculation: 'Суреттен есепке' },
};

function number(value, language) {
  const magnitude = Math.abs(value);
  return new Intl.NumberFormat(language, {
    maximumSignificantDigits: 12,
    notation: magnitude >= 1e9 || magnitude > 0 && magnitude < .001 ? 'scientific' : 'standard',
  }).format(value);
}

function paletteView(visual, language, words) {
  const contrast = visualContrastRatio(visual.foreground, visual.background);
  const contrastText = `${words.contrast}: ${number(Math.floor(contrast * 1000) / 1000, language)}:1`;
  const description = `${words.palette}. ${visual.headline}. ${words.background}: ${visual.background}. ${words.text}: ${visual.foreground}. ${words.accent}: ${visual.accent}. ${contrastText}.`;
  return `<figure class="instructional-visual instructional-visual--palette" data-lesson-visual="palette" role="img" lang="${language}" aria-label="${esc(description)}">
    <figcaption class="instructional-visual-caption"><span>${words.example}</span><strong>${words.palette}</strong></figcaption>
    <div class="instructional-palette-demo" data-palette-preview style="background:${visual.background};color:${visual.foreground};--visual-accent:${visual.accent}"><span class="instructional-palette-rule"></span><strong>${esc(visual.headline)}</strong><span class="instructional-palette-action">${words.action}</span></div>
    <div class="instructional-palette-swatches">${[['background', words.background], ['foreground', words.text], ['accent', words.accent]].map(([key, title]) => `<div><span class="instructional-palette-swatch" style="background:${visual[key]}"></span><span>${title}<small>${visual[key]}</small></span></div>`).join('')}</div>
    <p class="instructional-contrast${contrast < 4.5 ? ' is-low' : ''}"><strong data-palette-contrast="${contrast}">${contrastText}</strong><span>${contrast < 4.5 ? words.lowContrast : words.readable}</span></p>
  </figure>`;
}

function percentView(visual, language, words) {
  const value = number(visual.percent, language);
  const amount = visual.total === undefined ? null : visual.total * (visual.percent / 100);
  // The amount is derived here; a model cannot supply a contradictory result.
  const rounded = amount !== null && (Number(amount.toPrecision(12)) !== amount || amount === 0 && visual.percent > 0);
  const relation = rounded ? '≈' : '=';
  const equation = amount === null ? '' : language === 'kk'
    ? `${number(visual.total, language)} ${words.of} ${value}% ${relation} ${number(amount, language)}`
    : `${value}% ${words.of} ${number(visual.total, language)} ${relation} ${number(amount, language)}`;
  const title = visual.label || words.percent;
  const description = `${title}. ${words.square}. ${words.shaded}: ${value}%. ${equation}`;
  const cells = Array.from({ length: 100 }, (_, index) => {
    const x = index % 10 * 20, y = Math.floor(index / 10) * 20;
    const filled = Math.min(1, Math.max(0, visual.percent - index));
    const width = Number((16 * filled).toPrecision(12));
    return `<rect data-percent-cell="${index}" x="${x}" y="${y}" width="16" height="16" rx="3" class="instructional-percent-cell"/>${filled > 0 ? `<rect data-percent-fill="${filled}" x="${x}" y="${y}" width="${width}" height="16" rx="${Math.min(3, width / 2)}" class="instructional-percent-filled"/>` : ''}`;
  }).join('');
  return `<figure class="instructional-visual instructional-visual--percent" data-lesson-visual="percent" role="img" lang="${language}" aria-label="${esc(description)}">
    <figcaption class="instructional-visual-caption"><span>${words.example}</span><strong>${esc(title)}</strong></figcaption>
    <div class="instructional-percent-body"><div class="instructional-percent-grid-wrap"><svg data-percent-grid viewBox="0 0 196 196" aria-hidden="true" focusable="false">${cells}</svg><span>${words.square}</span></div>
      <div class="instructional-percent-summary"><strong class="instructional-percent-number">${value}<span>%</span></strong><span>${words.shaded}</span>
        <div class="instructional-percent-legend"><span><i></i>${words.shaded}: ${value}%</span><span><i></i>${words.remaining}: ${number(100 - visual.percent, language)}%</span></div>
        ${amount === null ? '' : `<div class="instructional-percent-equation"><span>${words.calculation}</span><p>${value} ÷ 100 × ${number(visual.total, language)} ${relation} <output data-percent-amount="${amount}">${number(amount, language)}</output></p></div>`}
      </div></div>
  </figure>`;
}

export function renderLessonVisual(raw, language = currentLanguage()) {
  const visual = normalizeLessonVisual(raw);
  if (!visual) return '';
  const locale = languageCode(language);
  return visual.type === 'palette' ? paletteView(visual, locale, copy[locale]) : percentView(visual, locale, copy[locale]);
}
