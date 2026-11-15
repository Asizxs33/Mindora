import { cleanStrokes, RELATIONS } from './lab-models.js';
export const PRACTICE_TYPES = Object.freeze(['text', 'code', 'palette', 'calculation', 'drawing']);
const color = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) ? value.toLowerCase() : null;
const field = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '';

export function normalizePractice(raw) {
  if (!raw || !PRACTICE_TYPES.includes(raw.type)) return null;
  const result = { type: raw.type };
  if (raw.type === 'code') {
    if (typeof raw.language !== 'string' || !/^[a-z0-9+# .-]{1,30}$/i.test(raw.language)) return null;
    result.language = raw.language.toLowerCase();
    if (result.language === 'capy') result.challenge = raw.challenge === 'north' ? 'north' : 'path';
    if (raw.starter !== undefined) {
      if (typeof raw.starter !== 'string' || raw.starter.length > 500) return null;
      result.starter = raw.starter;
    }
  }
  if (raw.type === 'calculation' && ['logarithm', 'graph'].includes(raw.visual)) result.visual = raw.visual;
  return result;
}

// Bounded fields keep structured submissions inside the existing answer limit.
export function practiceAnswer(practice, raw = {}) {
  if (practice?.type === 'drawing') return { type: 'drawing', strokes: cleanStrokes(raw.strokes), explanation: field(raw.explanation, 150) };
  if (practice?.type === 'code') return {
    type: 'code', code: field(raw.code, 500), output: field(raw.output, 100),
    explanation: field(raw.explanation, 100),
  };
  if (practice?.type === 'palette') return {
    type: 'palette', background: color(raw.background) || '#fff1e5',
    foreground: color(raw.foreground) || '#302723', accent: color(raw.accent) || '#bc4b00',
    title: field(raw.title, 80), explanation: field(raw.explanation, 350),
  };
  if (practice?.type === 'calculation') return {
    type: 'calculation', result: field(raw.result, 100), working: field(raw.working, 450),
    ...(['logarithm', 'graph'].includes(practice.visual) ? { relation: RELATIONS.includes(raw.relation) ? raw.relation : practice.visual === 'graph' ? 'linear' : 'logarithm', base: Math.max(2, Math.min(5, Math.round(Number(raw.base) || 2))), exponent: Math.max(0, Math.min(3, Math.round(Number(raw.exponent) || 0))) } : {}),
  };
  return null;
}

export function restorePracticeAnswer(practice, answer) {
  try {
    const parsed = JSON.parse(answer);
    if (parsed?.type === practice?.type) return practiceAnswer(practice, parsed);
  } catch { /* Older text answers remain readable in their original form. */ }
  return practiceAnswer(practice, practice?.type === 'code' ? { code: answer || practice.starter || '' } : {});
}

export function paletteContrast(foreground, background) {
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  if (!color(foreground) || !color(background)) return null;
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return Math.round((values[0] + .05) / (values[1] + .05) * 100) / 100;
}
