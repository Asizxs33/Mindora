import { t } from './language.js';

export function sheetFeedback(diagnosis) {
  if (!diagnosis) return '';
  if (diagnosis.kind === 'sheet-operation') {
    const fn = diagnosis.expected;
    return t(`The range is right. Use ${fn} for this task.`, `Диапазон верный. Для этой задачи используй ${fn}.`, `Диапазон дұрыс. Бұл тапсырмада ${fn} функциясын қолдан.`);
  }
  const missing = diagnosis.missing.join(', ');
  const extra = diagnosis.extra.join(', ');
  const details = [
    missing && t(`Missing cells: ${missing}.`, `Пропущены ячейки: ${missing}.`, `Қамтылмаған ұяшықтар: ${missing}.`),
    extra && t(`Extra cells: ${extra}.`, `Лишние ячейки: ${extra}.`, `Артық ұяшықтар: ${extra}.`),
  ];
  const difference = Number(diagnosis.difference?.toFixed(2));
  if (difference < 0) details.push(t(`Your result is ${-difference} lower.`, `Твой результат меньше на ${-difference}.`, `Нәтижең ${-difference}-ға кем.`));
  if (difference > 0) details.push(t(`Your result is ${difference} higher.`, `Твой результат больше на ${difference}.`, `Нәтижең ${difference}-ға артық.`));
  return details.filter(Boolean).join(' ');
}
