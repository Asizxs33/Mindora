export const LANGUAGES = Object.freeze({ en: 'English', ru: 'Russian', kk: 'Kazakh' });

export function languageCode(value, fallback = 'en') {
  return typeof value === 'string' && Object.hasOwn(LANGUAGES, value) ? value : fallback;
}
