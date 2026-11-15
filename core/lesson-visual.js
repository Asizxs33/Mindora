import { normalizeTable } from './studio-practice.js';
const label = (value, max) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : null;

// Keep the unrounded ratio for the 4.5:1 threshold; rounding can turn a failing
// 4.496:1 pair into a misleading 4.50:1 pass.
export function visualContrastRatio(foreground, background) {
  const colors = [color(foreground), color(background)];
  if (colors.some(value => !value)) return null;
  const luminance = colors.map(hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }).sort((left, right) => right - left);
  return (luminance[0] + .05) / (luminance[1] + .05);
}

// Structured examples only: no model-authored HTML, SVG, CSS or executable code.
export function normalizeLessonVisual(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type === 'table') {
    const table = normalizeTable(raw), title = label(raw.label, 120);
    return table && title ? { type: 'table', label: title, ...table } : null;
  }
  if (raw.type === 'flow') {
    const title = label(raw.label, 120);
    if (!title || !Array.isArray(raw.steps) || raw.steps.length < 2 || raw.steps.length > 5) return null;
    const steps = raw.steps.map(step => label(step, 95));
    return steps.every(Boolean) ? { type: 'flow', label: title, steps } : null;
  }
  if (raw.type === 'dialogue') {
    const title = label(raw.label, 120);
    if (!title || !Array.isArray(raw.turns) || raw.turns.length < 2 || raw.turns.length > 4) return null;
    const turns = [];
    for (const turn of raw.turns) {
      const speaker = label(turn?.speaker, 40), text = label(turn?.text, 180);
      if (!speaker || !text) return null;
      const normalized = { speaker, text };
      if (turn.translation !== undefined) {
        normalized.translation = label(turn.translation, 180);
        if (!normalized.translation) return null;
      }
      turns.push(normalized);
    }
    return { type: 'dialogue', label: title, turns };
  }
  if (raw.type === 'social-post') {
    const audience = label(raw.audience, 80), hook = label(raw.hook, 160);
    const body = label(raw.body, 400), cta = label(raw.cta, 120);
    return audience && hook && body && cta ? { type: 'social-post', audience, hook, body, cta } : null;
  }
  if (raw.type === 'palette') {
    const background = color(raw.background), foreground = color(raw.foreground), accent = color(raw.accent);
    const headline = label(raw.headline, 100);
    return background && foreground && accent && headline ? { type: 'palette', background, foreground, accent, headline } : null;
  }
  if (raw.type === 'percent') {
    if (typeof raw.percent !== 'number' || !Number.isFinite(raw.percent) || raw.percent < 0 || raw.percent > 100) return null;
    const result = { type: 'percent', percent: raw.percent === 0 ? 0 : raw.percent };
    if (raw.total !== undefined) {
      if (typeof raw.total !== 'number' || !Number.isFinite(raw.total) || raw.total <= 0) return null;
      result.total = raw.total;
    }
    if (raw.label !== undefined) {
      result.label = label(raw.label, 120);
      if (!result.label) return null;
    }
    return result;
  }
  return null;
}
