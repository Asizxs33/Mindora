import { PLAN_CENTS, annualSaving, usd, validPlan } from '../core/plus-demo.js';
import { t } from './language.js';
import { icon } from './icons.js';

const name = id => id === 'annual' ? t('Annual', 'На год', 'Жылдық') : t('Monthly', 'На месяц', 'Айлық');
const period = id => id === 'annual' ? t('year','год','жыл') : t('month','месяц','ай');
const heading = text => `<h2 id="shop-step" tabindex="-1">${text}</h2>`;
const demoLabel = () => t('Demo checkout', 'Демо-покупка', 'Демо сатып алу');
const changePlan = () => t('Change demo plan','Сменить демо-тариф','Демо тарифті ауыстыру');

export function plusBadge(active) {
  return validPlan(active) ? `<span class="plus-badge">Plus <span>· ${t('Demo', 'Демо', 'Демо')}</span></span>` : '';
}

export function plusProfileStatus(active) {
  if (!validPlan(active)) return '';
  return `<section class="plus-profile-status" aria-labelledby="profile-plus-title">
    <span class="plus-plan-icon" aria-hidden="true">${icon('layers', 22)}</span>
    <div><h2 id="profile-plus-title">Mindora Plus</h2><p>${t('Demo active', 'Демо-тариф активен', 'Демо тариф белсенді')} · ${name(active)}</p></div>
    <button type="button" class="text-link" data-view="membership">${t('Manage plan', 'Управлять тарифом', 'Тарифті басқару')} ${icon('arrow', 16)}</button>
  </section>`;
}

function offer(id, active) {
  const annual = id === 'annual';
  const detail = annual
    ? t(`Save ${usd(annualSaving)} a year`, `Экономия ${usd(annualSaving)} за год`, `Жылына ${usd(annualSaving)} үнемдейсің`)
    : t(`12 months · ${usd(PLAN_CENTS.monthly * 12)}`, `12 месяцев · ${usd(PLAN_CENTS.monthly * 12)}`, `12 ай · ${usd(PLAN_CENTS.monthly * 12)}`);
  return `<button class="plus-offer" data-demo-select="${id}" ${id === active ? 'disabled' : ''}>
    <span class="plus-plan-icon">${icon(annual ? 'layers' : 'calendar', 25)}</span>
    <strong>${name(id)}</strong><span class="plus-amount">${usd(PLAN_CENTS[id])}<small> / ${period(id)}</small></span>
    <span class="plus-detail">${id === active ? t('Current demo plan','Текущий демо-тариф','Қазіргі демо тариф') : detail}</span>
    ${icon(id === active ? 'check' : 'arrow', 18)}</button>`;
}

function roundView(round, result) {
  return `${heading(t('Check an invoice','Проверь счёт','Шотты тексер'))}
    <dl class="checkout-lines">
      <div><dt>${t('Quantity','Количество','Саны')}</dt><dd>${round.units}</dd></div>
      <div><dt>${t('Unit price','Цена за штуку','Бір дананың бағасы')}</dt><dd>${usd(round.price * 100)}</dd></div>
      <div><dt>${t('Discount','Скидка','Жеңілдік')}</dt><dd>−${usd(round.credit * 100)}</dd></div>
    </dl>
    ${result === true ? `<p role="status">${icon('check', 18)} ${t('Correct total','Верный итог','Дұрыс сома')} · ${usd((round.units * round.price - round.credit) * 100)}</p>
      <button class="secondary" data-demo-action="practice">${icon('shuffle',18)} ${t('Try new numbers','Новые числа','Жаңа сандармен көру')}</button>` : `<form id="demo-invoice" class="plus-practice"><label for="invoice-total">${t('What is the final total in dollars?','Какой итог в долларах?','Жалпы сома неше доллар?')}</label>
      <input id="invoice-total" name="total" inputmode="decimal" maxlength="7" required ${result === false ? 'aria-invalid="true" aria-describedby="invoice-hint"' : ''}>
      ${result === false ? `<p role="status" id="invoice-hint">${t('Multiply the quantity by the unit price, then subtract the discount.','Умножь количество на цену и вычти скидку.','Санын бағасына көбейтіп, жеңілдікті шегер.')}</p>` : ''}
      <button class="primary">${t('Check total','Проверить итог','Соманы тексеру')}</button></form>`}
    <button class="text-link" data-demo-action="back">${icon('back', 16)} Mindora Plus</button>`;
}

export function plusShopView({ active, pending, choose, round, result }) {
  let content;
  if (validPlan(pending)) {
    content = `${heading(demoLabel())}<dl class="checkout-lines"><div><dt>Mindora Plus · ${name(pending)}</dt><dd>${usd(PLAN_CENTS[pending])} / ${period(pending)}</dd></div>
      <div><dt>${t('Due today','К оплате сегодня','Бүгінгі төлем')}</dt><dd>$0.00</dd></div></dl>
      <p>${t('Try checkout without a card. This demo never charges or renews.', 'Попробуй покупку без карты. В демо нет списаний и продления.', 'Картасыз сынап көр. Демода ақша алынбайды, жазылым жаңартылмайды.')}</p>
      <div class="plus-actions"><button class="primary" data-demo-action="confirm">${t('Confirm demo purchase','Подтвердить демо-покупку','Демо сатып алуды растау')}</button><button class="text-link" data-demo-action="choose">${t('Back to plans','К тарифам','Тарифтерге оралу')}</button></div>`;
  } else if (validPlan(active) && !choose) {
    content = round ? roundView(round, result) : `${heading(t('Your Plus demo','Твой демо-тариф Plus','Сенің Plus демо тарифің'))}
      <p role="status">${icon('check',18)} ${t('Demo active', 'Демо-тариф активен', 'Демо тариф белсенді')} · ${name(active)} · ${t('$0 charged','$0 списано','$0 алынды')}</p>
      <p>${t('Try a fresh invoice exercise. This preview is saved on this device.', 'Попробуй сверить счёт с новыми данными. Демо сохранено на этом устройстве.', 'Жаңа дерекпен шотты тексеріп көр. Демо осы құрылғыда сақталды.')}</p>
      <div class="plus-actions"><button class="primary" data-demo-action="practice">${t('Try the exercise','Начать практику','Тапсырманы бастау')} ${icon('arrow',18)}</button>
      <button class="text-link" data-demo-action="choose">${changePlan()}</button></div>`;
  } else {
    content = `${heading('Mindora Plus')}<p>${t('Your first personal course is free. Explore plans for more courses in the demo shop.', 'Первый личный курс бесплатно. Выбери демо-тариф для следующих курсов.', 'Бірінші жеке курс тегін. Келесі курстарға арналған тарифті демо дүкенде сынап көр.')}</p>
      <div class="plus-offers">${offer('monthly', active)}${offer('annual', active)}</div>
      <small class="plus-caption">${demoLabel()} · ${t('No payment required','Без оплаты','Төлемсіз')}</small>
      ${validPlan(active) ? `<button class="text-link" data-demo-action="back">${icon('back',16)} ${t('My demo','Мой демо-тариф','Демо тарифім')}</button>` : ''}`;
  }
  return `<section class="plus-shop" aria-labelledby="shop-step">${content}</section>`;
}
