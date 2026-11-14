import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { marked } from 'marked';
import { sourceUrl } from '../core/learning-plan.js';
import { readPublicPage } from './public-page.js';

const MAX_CONTENT = 6500;
const MAX_IMAGES = 4;
const MAX_LINKS = 8;
const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const blocked = value => /^(?:[#\s]*(?:just a moment|access denied|verify you are human|403 forbidden|captcha challenge))/i.test(value);

function absoluteUrl(value, base) {
  try { return sourceUrl(new URL(value, base).href); } catch { return null; }
}

function imageBase(url) {
  const parsed = new URL(url);
  // Rendered README images normally already use absolute URLs. Markdown returned
  // by the search provider can still contain paths relative to a GitHub file.
  if (parsed.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/blob\//.test(parsed.pathname)) {
    return `https://raw.githubusercontent.com${parsed.pathname.replace(/^\/([^/]+)\/([^/]+)\/blob\//, '/$1/$2/')}`;
  }
  return url;
}

function repository(url) {
  const parsed = new URL(url);
  return /^(?:github\.com|raw\.githubusercontent\.com)$/.test(parsed.hostname)
    ? parsed.pathname.split('/').slice(1, 3).join('/').toLowerCase() : null;
}

function lessonRank(link) {
  const label = link.url + ' ' + link.title;
  return Number(/lesson|tutorial|chapter/i.test(label)) + 2 * Number(/intro|fundamental|basics/i.test(link.title))
    - 4 * Number(/setup|installation|environment|contribut/i.test(label));
}

function lessonLinks(document, base) {
  const links = [];
  const source = new URL(base);
  const repo = repository(base);
  for (const node of document.querySelectorAll('a[href]')) {
    const raw = node.getAttribute('href');
    const title = compact(node.textContent).slice(0, 160);
    if (!raw || raw.startsWith('#') || title.length < 3) continue;
    if (source.hostname === 'github.com' && !/^\/[^/]+\/[^/]+\/blob\//.test(source.pathname)
      && !/^(?:https?:\/\/|\/)/i.test(raw)) continue;
    // Root-relative GitHub routes refer to github.com, while file-relative
    // Markdown links use the raw file's directory, just like its images.
    const url = absoluteUrl(raw, raw.startsWith('/') ? base : imageBase(base));
    if (!url || imageBase(url) === imageBase(base)) continue;
    const target = new URL(url);
    if (repo ? repository(url) !== repo || (target.hostname === 'github.com' && !/^\/[^/]+\/[^/]+\/blob\//.test(target.pathname))
      : target.origin !== source.origin) continue;
    if (/(?:^|\/)(?:license[^/]*|issues|pulls?|discussions|actions|assets?|images?|media|img|\.github)(?:\/|$)/i.test(target.pathname)
      || /\.(?:png|jpe?g|gif|webp|svg|pdf|zip|mp4|ipynb)(?:$)/i.test(target.pathname)
      || /^(?:license|edit|view source|download|badge|contribut)/i.test(title)
      || (!/(?:lesson|tutorial|guide|chapter|module|unit|exercise|practice|intro|beginner|readme)/i.test(target.pathname + ' ' + title)
        && !/\.(?:md|markdown|rst|txt)$/i.test(target.pathname))
      || links.some(link => imageBase(link.url) === imageBase(url))) continue;
    links.push({ url, title });
  }
  return links.sort((a, b) => lessonRank(b) - lessonRank(a)).slice(0, MAX_LINKS);
}

function illustrations(document, base) {
  const images = [];
  for (const node of document.querySelectorAll('img')) {
    const raw = node.getAttribute('data-src') || node.getAttribute('src');
    if (!raw) continue;
    // A repository/tree URL does not identify the README branch or directory.
    // Do not guess a relative image path when the provider omitted that context.
    if (new URL(base).hostname === 'github.com' && !/^\/[^/]+\/[^/]+\/blob\//.test(new URL(base).pathname)
      && !/^(?:https?:\/\/|\/)/i.test(raw)) continue;
    const url = absoluteUrl(raw, imageBase(base));
    const alt = compact(node.getAttribute('alt') || node.closest('figure')?.querySelector('figcaption')?.textContent).slice(0, 180);
    const width = Number(node.getAttribute('width'));
    const height = Number(node.getAttribute('height'));
    if (!url || /(?:badge|shield|favicon|avatar|logo|tracking|pixel|spacer)/i.test(url + ' ' + alt)
      || /\.svg(?:\?|$)/i.test(url) || (width > 0 && width < 120) || (height > 0 && height < 80)
      || images.some(image => image.url === url)) continue;
    images.push({ url, alt: alt || 'Illustration from the source' });
    if (images.length === MAX_IMAGES) break;
  }
  return images;
}

// Both parsers are inert: third-party HTML is never executed or sent to the UI.
// Only plain text and validated image/lesson URLs leave this module.
export function extractLearningMaterial(body, url, contentType = 'text/markdown') {
  if (typeof body !== 'string' || !sourceUrl(url) || body.length > 1_500_000) return null;
  const html = /html/i.test(contentType) ? body : marked.parse(body.slice(0, 50000), { async: false });
  const { document } = parseHTML(/<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`);
  Object.defineProperty(document, 'documentURI', { value: url });
  for (const node of document.querySelectorAll('script, style, noscript, iframe, form, nav, header, footer, [hidden]')) node.remove();
  const pageTitle = compact(document.querySelector('title')?.textContent).slice(0, 160);
  const heading = [...document.querySelectorAll('h1, h2')].map(node => compact(node.textContent))
    .find(value => value.length >= 3 && /[\p{L}\p{N}]/u.test(value));
  if (blocked(pageTitle)) return null;
  const githubArticle = new URL(url).hostname === 'github.com' ? document.querySelector('article.markdown-body, .markdown-body') : null;
  let article;
  try { article = new Readability(document.cloneNode(true), { charThreshold: 80, maxElemsToParse: 18000 }).parse(); } catch { /* Malformed pages can still have a main element. */ }
  const main = githubArticle?.outerHTML || article?.content || document.querySelector('article, main')?.outerHTML;
  // Don't treat a JavaScript app shell, navigation page or access challenge as a lesson.
  if (/html/i.test(contentType) && !main) return null;
  const parsed = parseHTML(`<html><body>${main || html}</body></html>`).document;
  for (const node of parsed.querySelectorAll('script, style, noscript, iframe, form, nav, header, footer, [hidden]')) node.remove();
  // Keep code blocks and paragraph boundaries readable for the lesson composer.
  for (const node of parsed.querySelectorAll('p, div, li, pre, h1, h2, h3, h4, br, tr')) node.after('\n');
  const content = parsed.body.textContent.replace(/\r\n/g, '\n').replace(/[\t ]+\n/g, '\n').replace(/\n(?:[\t ]*\n){2,}/g, '\n\n').trim().slice(0, MAX_CONTENT);
  const title = compact(/html/i.test(contentType) ? article?.title || pageTitle || heading : heading || pageTitle).slice(0, 160);
  if (content.length < 35 || blocked(title) || blocked(content)) return null;
  return { title, content, images: illustrations(parsed, url), links: lessonLinks(parsed, url) };
}

export async function enrichLearningMaterials(materials, { signal, query = '', readPage = readPublicPage, readRenderedPage } = {}) {
  // A small bounded fan-out fits the existing serverless deadline. Failed reads
  // retain DeepSeek's retrieved text; no unrelated fallback lesson is fabricated.
  const bounded = materials.slice(0, 8);
  const github = bounded.filter(item => new URL(item.url).hostname === 'github.com').slice(0, 2);
  const other = bounded.filter(item => new URL(item.url).hostname !== 'github.com').slice(0, 2);
  const toRead = new Set([...other, ...github, ...bounded].slice(0, 4));
  for (const item of bounded) { if (toRead.size < 4) toRead.add(item); }
  const enriched = await Promise.all(bounded.map(async material => {
    let extracted;
    try { extracted = extractLearningMaterial(material.content, material.url); } catch { /* Keep provider text. */ }
    let page = null;
    if (toRead.has(material)) {
      const target = /\.(?:md|markdown|rst|txt)$/i.test(new URL(material.url).pathname) ? imageBase(material.url) : material.url;
      try { page = await readPage(target, { signal }); } catch { /* Reader is optional. */ }
    }
    let opened;
    if (page) {
      try { opened = extractLearningMaterial(page.body, page.url, page.contentType); } catch { /* Keep provider text. */ }
    }
    const chosen = opened || extracted;
    return {
      ...material,
      title: chosen?.title || material.title,
      content: (chosen?.content || (blocked(material.content) || blocked(material.title) ? '' : material.content)).slice(0, MAX_CONTENT),
      images: chosen?.images || [],
      links: chosen?.links || [],
      // Preserve the exact page an image came from, including a validated redirect.
      imageSourceUrl: opened ? page.url : material.url,
    };
  }));
  // The search provider can omit image markup, and some public help centers
  // require rendered HTML. At most two image-less non-GitHub pages use Reader.
  if (readRenderedPage) {
    const missingImages = enriched.filter(item => !item.images.length && !repository(item.url)).slice(0, 2);
    await Promise.all(missingImages.map(async material => {
      try {
        const page = await readRenderedPage(material.url, { signal });
        if (!page) return;
        const extracted = extractLearningMaterial(page.body, page.url, page.contentType);
        if (!extracted) return;
        material.content ||= extracted.content;
        material.images = extracted.images;
        material.imageSourceUrl = page.url;
        material.links = [...material.links, ...extracted.links].slice(0, MAX_LINKS);
      } catch { /* No Reader quota/access must never prevent a text lesson. */ }
    }));
  }
  const seen = new Set(enriched.flatMap(item => [imageBase(item.url), imageBase(item.imageSourceUrl)]));
  const keywords = [...new Set(String(query).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])];
  const score = link => keywords.reduce((total, word) => total + Number((link.title + ' ' + link.url).toLowerCase().includes(word)), 0);
  const children = enriched.flatMap(item => item.links).sort((a, b) => score(b) - score(a)).filter(link => {
    const key = imageBase(link.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
  const openedChildren = await Promise.all(children.map(async link => {
    if (signal?.aborted) return null;
    try {
      const page = await readPage(imageBase(link.url), { signal });
      if (!page || !sourceUrl(page.url)) return null;
      // A child redirect must remain in the same site/repository as its link.
      if (repository(link.url) ? repository(page.url) !== repository(link.url)
        : new URL(page.url).origin !== new URL(link.url).origin) return null;
      const extracted = extractLearningMaterial(page.body, page.url, page.contentType);
      return extracted ? { url: page.url, title: extracted.title || link.title, content: extracted.content,
        images: extracted.images, imageSourceUrl: page.url } : null;
    } catch { return null; }
  }));
  const unique = new Set();
  return [...openedChildren.filter(Boolean), ...enriched].filter(item => {
    const key = imageBase(item.url);
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  }).slice(0, 8);
}
