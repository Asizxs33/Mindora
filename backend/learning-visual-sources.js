import { enrichLearningMaterials } from './learning-materials.js';
import { sourceSuggestions } from './learning-source-catalog.js';
import { readPublicPage } from './public-page.js';

const MAX_WAIT_MS = 4500;
const MAX_MATERIALS = 8;
const illustratedPages = new Set([
  'https://en.wikibooks.org/wiki/Primary_Mathematics/Percentages',
  'https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Color_values',
  'https://www.adobe.com/creativecloud/design/discover/secondary-colors.html',
  'https://buffer.com/resources/social-media-calendar/',
]);

/** Open one relevant illustrated page when research returned text without images. */
export async function enrichLearningVisualSources(materials, topic, {
  signal, query = '', readPage = readPublicPage, readRenderedPage, timeoutMs = MAX_WAIT_MS,
} = {}) {
  if (signal?.aborted || materials.some(item => item.images?.length)) return materials;
  const seen = new Set(materials.flatMap(item => [item.url, item.imageSourceUrl]));
  const suggestion = sourceSuggestions(topic).find(item => illustratedPages.has(item.url) && !seen.has(item.url));
  if (!suggestion || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return materials;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, Math.min(timeoutMs, MAX_WAIT_MS));
  const aborted = new Promise(resolve => controller.signal.addEventListener('abort', () => resolve(null), { once: true }));
  const source = new URL(suggestion.url);
  // The article reader can discover child links. This fallback has exactly one
  // page budget: never start network requests for those children.
  const onePage = read => async (url, options) => {
    if (url !== suggestion.url || controller.signal.aborted) return null;
    const page = await read(url, options);
    if (!page) return null;
    const opened = new URL(page.url);
    return opened.origin === source.origin && opened.pathname.replace(/\/$/, '') === source.pathname.replace(/\/$/, '') ? page : null;
  };
  try {
    const enriched = await Promise.race([
      enrichLearningMaterials([suggestion], {
        signal: controller.signal, query,
        readPage: onePage(readPage),
        readRenderedPage: readRenderedPage ? onePage(readRenderedPage) : undefined,
      }),
      aborted,
    ]);
    if (controller.signal.aborted) return materials;
    const opened = enriched?.find(item => item.url === suggestion.url && item.content && item.images?.length);
    // Retain the opened source and its imageSourceUrl together; never attach
    // these images to a different article merely because it shares the topic.
    return opened ? [...materials.slice(0, MAX_MATERIALS - 1), opened] : materials;
  } catch {
    return materials;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}
