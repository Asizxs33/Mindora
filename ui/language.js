import { languageCode } from '../core/language.js';

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

export function languagePicker() {
  return `<label class="language-picker"><span class="visually-hidden">${t('Language', 'Язык', 'Тіл')}</span>
    <select id="interface-language" class="profile-select">
      <option value="en" lang="en"${current === 'en' ? ' selected' : ''}>English</option>
      <option value="ru" lang="ru"${current === 'ru' ? ' selected' : ''}>Русский</option>
      <option value="kk" lang="kk"${current === 'kk' ? ' selected' : ''}>Қазақша</option>
    </select></label>`;
}
