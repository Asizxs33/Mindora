// A bounded teaching language, not JavaScript evaluation or a general sandbox.
export function runCapyCode(source, challenge = 'path') {
  if (typeof source !== 'string' || source.length > 500) throw new Error('code-size');
  const code = source.replace(/\/\/[^\n]*/g, '');
  const tokens = code.match(/[A-Za-z_]+|\d+|[(){};]|\S/g) || [];
  let cursor = 0;
  const take = value => { if (tokens[cursor++] !== value) throw new Error('syntax'); };
  function block(depth, nested = false) {
    if (depth > 3) throw new Error('limit');
    const actions = [];
    while (cursor < tokens.length && tokens[cursor] !== '}') {
      const command = tokens[cursor++];
      if (command === ';') continue;
      if (!['forward', 'left', 'right', 'repeat'].includes(command)) throw new Error('syntax');
      take('(');
      let count = 1;
      if (command === 'forward' || command === 'repeat') {
        if (!/^\d+$/.test(tokens[cursor] || '')) throw new Error('syntax');
        count = Number(tokens[cursor++]);
        if (count < 1 || count > 12) throw new Error('limit');
      }
      take(')');
      if (command === 'repeat') {
        take('{'); const inner = block(depth + 1, true);
        for (let n = 0; n < count; n++) actions.push(...inner);
      } else for (let n = 0; n < count; n++) actions.push(command);
      if (actions.length > 80) throw new Error('limit');
    }
    if (nested) take('}');
    return actions;
  }
  const actions = block(0);
  if (cursor !== tokens.length || !actions.length) throw new Error('syntax');
  const target = challenge === 'north' ? { x: 0, y: 0 } : { x: 3, y: 0 };
  let x = 0, y = 3, direction = 0, blocked = false;
  const states = [{ x, y, direction }], vectors = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const action of actions) {
    if (action === 'left') direction = (direction + 3) % 4;
    else if (action === 'right') direction = (direction + 1) % 4;
    else {
      const nx = x + vectors[direction][0], ny = y + vectors[direction][1];
      if (nx < 0 || nx > 3 || ny < 0 || ny > 3 || ny === 1 && (nx === 1 || nx === 2)) { blocked = true; break; }
      x = nx; y = ny;
    }
    states.push({ x, y, direction });
  }
  return { states, target, blocked, reached: !blocked && x === target.x && y === target.y };
}

export function cleanStrokes(raw) {
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(raw)) return [];
  let pointsLeft = 64;
  return raw.slice(0, 12).flatMap(stroke => {
    if (!stroke || !Array.isArray(stroke.points) || !/^#[a-f\d]{6}$/i.test(stroke.color || '') || !Number.isFinite(stroke.width)) return [];
    const points = stroke.points.filter(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 100))
      .slice(0, pointsLeft).map(p => p.map(Math.round));
    pointsLeft -= points.length;
    return points.length ? [{ color: stroke.color.toLowerCase(), width: Math.max(1, Math.min(8, Math.round(stroke.width))), points }] : [];
  });
}

export function drawingSvg(strokes) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="white"/>${cleanStrokes(strokes).map(s => `<polyline points="${s.points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
}

export function logarithmModel(base = 2, exponent = 3) {
  base = Math.max(2, Math.min(5, Math.round(Number(base) || 2)));
  exponent = Math.max(0, Math.min(3, Math.round(Number(exponent) || 0)));
  return { base, exponent, value: base ** exponent, max: base ** 3 };
}

export const RELATIONS = Object.freeze(['logarithm', 'linear', 'quadratic', 'exponential']);
export function relationModel(base, position, relation = 'logarithm') {
  const m = logarithmModel(base, position);
  relation = RELATIONS.includes(relation) ? relation : 'logarithm';
  if (relation === 'logarithm') return { ...m, relation, x: m.value, y: m.exponent, yMax: 3 };
  const evaluate = x => relation === 'linear' ? m.base * x : relation === 'quadratic' ? m.base * x ** 2 : m.base ** x;
  return { ...m, relation, max: 3, value: evaluate(m.exponent), x: m.exponent, y: evaluate(m.exponent), yMax: evaluate(3) };
}
