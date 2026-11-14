import { parseHTML } from 'linkedom';
import { marked } from 'marked';
import { sourceUrl } from '../core/learning-plan.js';
import { lessonTopic } from './lesson-topic.js';
import { readPublicPage } from './public-page.js';

const DEADLINE_MS = 8000;
const MAX_SOURCES = 3;
const MAX_TOPICS = 60;
const MAX_CONTENT = 6500;
const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const unavailable = () => ({ sources: [], status: 'unavailable' });

// These are public outline entry points, not cached course content. Fetch them
// before using their topic sequence. Availability grants no right to reproduce
// complete lessons, assessments, images or the original course's certification.
const OUTLINES = {
  english: [
    ['https://learningenglish.voanews.com/p/5644.html', 'voa'],
    ['https://learnenglish.britishcouncil.org/free-resources/speaking/a1', 'british-council'],
  ],
  smm: [['https://buffer.com/resources/social-media-marketing-guide/', 'buffer']],
  python: [['https://docs.python.org/3/tutorial/', 'python']],
  arithmetic: [['https://en.wikibooks.org/wiki/Arithmetic', 'arithmetic']],
};

function suggestions(input) {
  // Never accept caller-provided source URLs or send personal questionnaire
  // answers to a search service. Only the learning subject selects fixed URLs.
  const topic = typeof input === 'string' ? input : [input?.originalGoal, input?.goal]
    .filter(value => typeof value === 'string').join(' ');
  const text = topic.normalize('NFKC').slice(0, 1000);
  if (/\bpython\b|питон|пайтон/iu.test(text)) return OUTLINES.python;
  const domain = lessonTopic(text);
  if (domain) return OUTLINES[domain];
  if (/\b(?:javascript|typescript|java|sql|html|css|excel|calculus|geometry|statistics|trigonometry)\b|программир|геометр|статист|тригонометр|матанализ/iu.test(text)) return [];
  return /\b(?:math(?:ematics)?|arithmetic|fractions?|percent(?:age)?s?)\b|математ|арифмет|дроб|бөлшек|процент|пайыз/iu.test(text)
    ? OUTLINES.arithmetic : [];
}

function samePage(left, right) {
  try {
    const a = new URL(left), b = new URL(right);
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
  } catch { return false; }
}

function linkedTopic(node, base) {
  if (node.localName !== 'a') return null;
  try {
    const url = sourceUrl(new URL(node.getAttribute('href'), base).href);
    return url && new URL(url).origin === new URL(base).origin ? new URL(url) : null;
  } catch { return null; }
}

function extractOutline(page, requested, type) {
  if (!page || !sourceUrl(page.url) || !samePage(page.url, requested)
    || typeof page.body !== 'string' || page.body.length > 1_500_000) return null;
  const html = /html/i.test(page.contentType) ? page.body : marked.parse(page.body.slice(0, 100000), { async: false });
  const { document } = parseHTML(/<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`);
  for (const node of document.querySelectorAll('script,style,noscript,iframe,form,nav,footer,[hidden]')) node.remove();
  const title = compact(document.querySelector('h1')?.textContent || document.querySelector('title')?.textContent).replace(/¶$/, '').trim().slice(0, 160);
  if (title.length < 3 || /access denied|just a moment|verify you are human|captcha/i.test(title)) return null;
  const root = type === 'arithmetic' ? [...document.querySelectorAll('.mw-parser-output')].sort((a, b) => b.textContent.length - a.textContent.length)[0] || document
    : type === 'buffer' ? document.querySelector('.gh-content, .post-content, .post-full-content, article') || document
      : document;
  const topics = [];
  const seen = new Set();
  for (const node of root.querySelectorAll(type === 'buffer' ? 'h2,h3' : type === 'arithmetic' ? 'h2,a[href]' : 'a[href]')) {
    const label = compact(node.textContent).replace(/\s*\[edit\].*$/i, '').slice(0, 160);
    if (type === 'buffer' && /^FAQ\b/i.test(label)) break;
    const target = linkedTopic(node, page.url);
    let matches = false;
    if (type === 'voa') matches = /^Lesson\s+\d+\s*:/i.test(label) && target?.pathname.startsWith('/a/');
    if (type === 'british-council') matches = Boolean(target?.pathname.startsWith('/free-resources/speaking/a1/')
      && !/^(?:read more|add favourite)/i.test(label));
    if (type === 'python') matches = /^\d+\.(?:\d+\.)?\s/.test(label) && target?.pathname.startsWith('/3/tutorial/');
    if (type === 'arithmetic') {
      const path = target && decodeURIComponent(target.pathname);
      matches = /^Unit\s+\d+:/i.test(label) || Boolean(path && /^\/wiki\/Arithmetic\/[^/]+$/.test(path)
        && !/\/(?:Cover|Authors|Contributors|Printable_version|How_This_Textbook_Is_Organized)$/i.test(path));
    }
    if (type === 'buffer') matches = /social media|content|audience|platform|engag|goals?|strateg|profiles?|authentic|communit/i.test(label)
      && !/^(?:related|try buffer)|Instagram Reels|AI Image Generators/i.test(label);
    if (!matches || label.length < 3 || seen.has(label.toLowerCase())) continue;
    topics.push(label);
    seen.add(label.toLowerCase());
    if (topics.length === (type === 'python' ? 180 : MAX_TOPICS)) break;
  }
  // A product shell, a title or a lone lesson link is not a retrieved syllabus.
  if (topics.length < 3) return null;
  // Keep the whole tutorial's chapter breadth even if its detailed TOC exceeds
  // the budget, rather than silently discarding the final chapters.
  const chapters = type === 'python' ? topics.filter(topic => /^\d+\.\s/.test(topic)) : [];
  let subtopicsLeft = Math.max(0, MAX_TOPICS - chapters.length);
  const selectedTopics = type === 'python' && topics.length > MAX_TOPICS
    ? topics.filter(topic => chapters.includes(topic) || subtopicsLeft-- > 0).slice(0, MAX_TOPICS) : topics;
  const content = selectedTopics.map(topic => `- ${topic}`).join('\n').slice(0, MAX_CONTENT);
  return { title, url: page.url, content };
}

/** Retrieve bounded public course/guide outlines; no lessons are generated here.
 * readPage injection is server-side only. The default retains the existing
 * pinned-DNS public-page reader. fetcher is forwarded to injected adapters.
 */
export async function loadCourseOutlineSources(input, {
  fetcher = fetch, signal, readPage = readPublicPage, timeoutMs = DEADLINE_MS,
} = {}) {
  if (signal?.aborted || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return unavailable();
  const selected = suggestions(input).slice(0, MAX_SOURCES);
  if (!selected.length) return unavailable();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, Math.min(timeoutMs, DEADLINE_MS));
  const aborted = new Promise(resolve => controller.signal.addEventListener('abort', () => resolve(null), { once: true }));
  try {
    const results = await Promise.all(selected.map(async ([url, type]) => {
      try {
        const page = await Promise.race([
          readPage(url, { signal: controller.signal, timeoutMs: Math.min(timeoutMs, DEADLINE_MS), fetcher }),
          aborted,
        ]);
        return extractOutline(page, url, type);
      } catch { return null; }
    }));
    if (signal?.aborted) return unavailable();
    const sources = results.filter(Boolean);
    return { sources, status: sources.length ? 'verified' : 'unavailable' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}
