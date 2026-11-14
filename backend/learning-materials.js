import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { marked } from 'marked';
import { sourceUrl } from '../core/learning-plan.js';
import { readPublicPage } from './public-page.js';

const MAX_CONTENT = 6500;
const MAX_IMAGES = 4;
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
    return `https://raw.githubusercontent.com${parsed.pathname.replace('/blob/', '/')}`;
  }
  return url;
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
// Only plain text and validated image URLs leave this module.
export function extractLearningMaterial(body, url, contentType = 'text/markdown') {
  if (typeof body !== 'string' || !sourceUrl(url) || body.length > 1_500_000) return null;
  const html = /html/i.test(contentType) ? body : marked.parse(body.slice(0, 50000), { async: false });
  const { document } = parseHTML(/<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`);
  Object.defineProperty(document, 'documentURI', { value: url });
  for (const node of document.querySelectorAll('script, style, noscript, iframe, form, nav, header, footer, [hidden]')) node.remove();
  const pageTitle = compact(document.querySelector('title')?.textContent).slice(0, 160);
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
  const title = compact(article?.title || pageTitle).slice(0, 160);
  if (content.length < 35 || blocked(title) || blocked(content)) return null;
  return { title, content, images: illustrations(parsed, url) };
}

export async function enrichLearningMaterials(materials, { signal, readPage = readPublicPage } = {}) {
  // A small bounded fan-out fits the existing serverless deadline. Failed reads
  // retain DeepSeek's retrieved text; no unrelated fallback lesson is fabricated.
  const bounded = materials.slice(0, 8);
  const github = bounded.filter(item => new URL(item.url).hostname === 'github.com').slice(0, 2);
  const other = bounded.filter(item => new URL(item.url).hostname !== 'github.com').slice(0, 2);
  const toRead = new Set([...other, ...github, ...bounded].slice(0, 4));
  for (const item of bounded) { if (toRead.size < 4) toRead.add(item); }
  return Promise.all(bounded.map(async material => {
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
      // Preserve the exact page an image came from, including a validated redirect.
      imageSourceUrl: opened ? page.url : material.url,
    };
  }));
}
