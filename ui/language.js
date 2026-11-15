import { languageCode } from '../core/language.js';
import { icon } from './icons.js';

const languages = [
  ['en', 'English', 'EN'],
  ['ru', 'Русский', 'RU'],
  ['kk', 'Қазақша', 'ҚАЗ'],
];

let current = 'en';

export function setLanguage(value) {
  current = languageCode(value);
  document.documentElement.lang = current;
}

export function currentLanguage() {
  return current;
}

export function t(english, russian, kazakh) {
  return (current === 'ru' ? russian : current === 'kk' ? kazakh : english) ?? english;
}

export function translateKnown(value, translations) {
  return Object.hasOwn(translations, value) ? t(...translations[value]) : value;
}

export const languageName = code => languages.find(([value]) => value === code)?.[1] || '';

export function courseLanguageField(value = 'en', disabled = false) {
  return `<label class="course-language-field"><span>${t('Course language','Язык курса','Курс тілі')}</span><select name="courseLanguage"${disabled ? ' disabled' : ''}>${languages.map(([code, name]) => `<option value="${code}" lang="${code}"${code === languageCode(value) ? ' selected' : ''}>${name}</option>`).join('')}</select></label>`;
}

export function languagePicker({ compact = false, id = 'interface-language' } = {}) {
  const label = t('Interface language', 'Язык интерфейса', 'Интерфейс тілі');
  const [, name, shortName] = languages.find(([code]) => code === current);
  return `<details class="language-picker${compact ? ' is-compact' : ''}">
    <summary aria-label="${label}. ${name}">${icon('globe', 17)}<span lang="${current}">${compact ? shortName : name}</span>${icon('chevron', 14)}</summary>
    <div class="language-picker-options" role="group" aria-label="${label}">
      ${languages.map(([code, name]) => `<button type="button" data-interface-language="${code}" aria-pressed="${current === code}"><span lang="${code}">${name}</span>${current === code ? icon('check', 16) : ''}</button>`).join('')}
    </div>
    <select id="${id}" data-interface-select aria-label="${label}" hidden>
      ${languages.map(([code, name]) => `<option value="${code}" lang="${code}"${current === code ? ' selected' : ''}>${name}</option>`).join('')}
    </select>
  </details>`;
}

export function mountLanguagePicker() {
  document.addEventListener('click', event => {
    const picker = event.target.closest('.language-picker');
    const open = document.querySelector('.language-picker[open]');
    if (open && open !== picker) open.open = false;
    const option = event.target.closest('[data-interface-language]');
    if (!option || !picker) return;
    const select = picker.querySelector('[data-interface-select]');
    const id = select.id;
    picker.open = false;
    if (select.value !== option.dataset.interfaceLanguage) {
      select.value = option.dataset.interfaceLanguage;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.getElementById(id)?.closest('.language-picker')?.querySelector('summary')?.focus();
  });
  document.addEventListener('keydown', event => {
    const picker = event.target.closest('.language-picker[open]');
    if (event.key !== 'Escape' || !picker) return;
    event.preventDefault();
    picker.open = false;
    picker.querySelector('summary').focus();
  });
  document.addEventListener('focusin', event => {
    const open = document.querySelector('.language-picker[open]');
    if (open && !open.contains(event.target)) open.open = false;
  });
}
