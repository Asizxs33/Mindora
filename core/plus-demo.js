// A demonstration on this device. Billing and AI-course entitlement are server concerns.
export const PLAN_CENTS = Object.freeze({ monthly: 999, annual: 9999 });
export const annualSaving = PLAN_CENTS.monthly * 12 - PLAN_CENTS.annual;
export const usd = cents => '$' + (cents / 100).toFixed(2);

export function validPlan(value) {
  return Object.hasOwn(PLAN_CENTS, value);
}

export function newDemoRound(random = Math.random) {
  return { units: 2 + Math.floor(random() * 8), price: 3 + Math.floor(random() * 10),
    credit: 1 + Math.floor(random() * 4) };
}

export function checkDemoRound(round, answer) {
  const amount = String(answer).trim().replace(',', '.');
  return Boolean(round && /^\d{1,3}(?:\.\d{1,2})?$/.test(amount) &&
    Number(amount) === round.units * round.price - round.credit);
}
