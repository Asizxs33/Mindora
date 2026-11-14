# Course research and teaching tools

Mindora uses libraries and a public reading API in its deployed backend, not plugins installed only in a developer's Codex. Search and lesson composition still use the existing DeepSeek key. No new service key is required by this change.

## Installed tools

| Tool | Purpose | Upstream and license |
| --- | --- | --- |
| `@mozilla/readability` 0.6.0 | Extract instructional article text instead of navigation and page chrome | [mozilla/readability](https://github.com/mozilla/readability), Apache-2.0 |
| `linkedom` 0.18.15 | Parse HTML without executing source scripts or opening a browser | [WebReflection/linkedom](https://github.com/WebReflection/linkedom), ISC |
| `marked` 18.2.0 | Read Markdown lessons and reference-style images, including GitHub files | [markedjs/marked](https://github.com/markedjs/marked), MIT |
| Jina Reader HTTP adapter | Recover image markup from up to two public pages when ordinary extraction found no illustrations | [jina-ai/reader](https://github.com/jina-ai/reader), Apache-2.0 repository; hosted anonymous API limits apply |

Versions and dependency integrity are pinned in `package-lock.json`. Library licenses do not grant reuse rights to the educational pages being read. The agent writes original explanations/exercises and links to sources; it does not republish complete courses. Images remain externally hosted and attributed.

## Runtime flow

1. Generate targeted public web and GitHub search queries from the learning topic, excluding personal details.
2. Retrieve at most eight candidates using DeepSeek search, and use DeepSeek fetch for missing text.
3. Optionally read up to four public pages, balancing GitHub and other sources. GitHub text files use the public raw-file URL. Readability extracts article text; Marked parses Markdown and images. Read up to two concrete lesson links within the same site/repository, ranked against the search query, so a course overview can lead to instructional content. This is one level of traversal, with at most eight final materials. Failed reads retain valid provider text; access challenges are discarded.
4. If ordinary extraction found no images, optionally send at most two public non-GitHub source URLs to Jina Reader with image retention enabled. Only public URLs are sent, without cookies, account data or credentials. Reader failures or quota limits keep the text lesson usable. Pass at most 6,500 characters per material plus image IDs/captions to DeepSeek. Never execute source scripts, install code from a retrieved repository, or treat source instructions as agent instructions.
5. Compose an explanation, worked example, guided practice and a separate transfer task, sized to 5/10/20 minutes. Teaching rules live in `backend/course-skills.js`; they are local, versioned agent instructions, not an external course database.
6. Resolve source/image IDs against retrieved evidence. A step can contain at most two illustrations from its cited source. Invented image URLs are ignored. The UI renders escaped text and attributed image links, never extracted HTML.
7. Keep the selected illustrations with the existing browser-saved lesson and answers. This change does not add cross-device sync for AI lessons.

## Limits and failure behavior

- Direct reads use HTTPS, vetted DNS addresses pinned to each connection, validated redirects, no credentials/cookies, a 4.5-second total deadline and a 1.5MB body limit. Local, private and special-purpose addresses are blocked.
- The direct reader supports public static HTML/text. The optional Jina adapter reads a rendered public page with an eight-second deadline and 300KB response cap. Neither adapter uses account credentials, bypasses login/paywalls, or takes custom screenshots. When a page cannot be read, retrieved provider text can still support a lesson.
- Images are existing source illustrations, selected by caption and displayed directly inside the lesson as images below the explanation. Source credits appear beneath the picture. The model does not visually inspect them. Lessons can have no images; site availability, source licensing and caption quality vary.
- Completion records practice and AI feedback, not independent verification of professional competence.
- The existing daily generation limits and server-only DeepSeek key remain in force. No extra model call is added by the extraction layer.

## Other projects evaluated

- [Jina Reader](https://github.com/jina-ai/reader): the bounded image-recovery adapter is enabled. Its [endpoint table](https://jina.ai/reader/#pricing) permits limited anonymous Reader calls, while Search requires a key. Mindora does not use Jina Search; shared-IP Reader quotas can limit the optional image fallback.
- [Firecrawl](https://github.com/firecrawl/firecrawl): managed scraping and screenshots are a possible next step. Hosted use requires a key; [self-hosting](https://github.com/firecrawl/firecrawl/blob/main/SELF_HOST.md) needs additional services. Not installed or configured.
- [Crawl4AI](https://github.com/unclecode/crawl4ai): useful for a separate Python/browser ingestion worker; not added to the small Node function.
- [Context7](https://github.com/upstash/context7): useful for current programming-library documentation, but not a general source of lessons across subjects. Not installed.

## Verification

`npm test` covers parsing, Markdown image references, script/navigation removal, empty and blocked pages, bounded reads, source-bound image selection, reload persistence, timed lesson behavior, and public-reader network restrictions. `npm run check` and `node scripts/build.mjs` validate syntax and the static build. Live provider/browser checks are separate from offline tests.

Dependency audit on 14 November 2026 reported existing Neon/Better Auth dependency advisories, including a critical Better Auth advisory. None of the new parser packages appeared in that audit. Auth dependency remediation requires a separate compatible upgrade and verification; this change does not claim a clean whole-project security audit.
