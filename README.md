# Mindora

**Learn it. Make it yours.**

Mindora helps busy adults turn a learning goal into a practical result. Choose something to make, work through short explanations and interactive exercises, create your own work, and apply the skill to a fresh challenge.

This repository contains a working **interactive product prototype**, not a universal AI learning service. It includes two bounded sample curricula: visual design and everyday spreadsheets.

## Try it

[Open Mindora on Vercel](https://mindora-livid-eta.vercel.app/).

Guest lessons run without an account. Install the locked backend dependencies before starting locally.

```sh
npm ci
npm start
```

Open the printed local URL, normally `http://127.0.0.1:4173`.

## Included

- Goal input with explicit matching to the two supported sample paths; unsupported goals are explained honestly.
- A daily time preference and a four-step learning path with prerequisite locks.
- Short lessons and three-question practice with useful feedback on incorrect answers.
- A live poster editor with text, typography, paper, and ink controls.
- Transparent checks for nonempty copy, hierarchy, contrast, and a call to action. These checks do not assess creative quality or semantic accuracy.
- A spreadsheet exercise with editable expenses, a safe `SUM(B2:B4)` formula check, and a numerical answer check.
- A fresh independent challenge and variations of unlocked exercises.
- Device-local progress, saved creations, learning notes, and SVG / CSV downloads.
- Responsive layout, keyboard focus indicators, labelled controls, and reduced-motion support.
- A Russian interface with an illustrated learning map, local XP, achievements, and a daily activity streak.

## Product vision and limits

The prototype includes two curated courses, signed-in budget draft sync, and a DeepSeek learning-plan integration that needs a server API key. The budget course and generated lessons adapt to 5, 10 or 20 minutes. Community discussions, payments, and cloud sync for generated plans are outside this slice.

Browser storage is local to a device and origin. Clearing site data removes progress. Export creations to keep separate copies. A completed path records practice, not an accredited qualification or an expert assessment.

## Files

- `ui/`: page templates, responsive styles, [Lucide](https://lucide.dev/icons/) icons and capybara illustrations. The icon license is in `ui/assets/LUCIDE-LICENSE.txt`.
- `core/`: navigation and event handling, courses, validation, progress, persistence and export.
- `api/` and `backend/`: Neon Auth sessions and server-side storage for signed-in budget drafts.
- `tests/`: validation tests that run without a browser or network.
- `server.mjs`: local static preview server.

See the [team guide](docs/TEAM.md) and [Codex prompt for design work](docs/CODEX-DESIGN-PROMPT.md).

## Verification

```sh
npm test
npm run check
```

Checks cover unsupported goals, contrast, incomplete and malformed work, strict formula parsing, numerical validation, reproducible challenge variation, HTML/SVG escaping, and curriculum shape.

## Deploy

Use the **Other** preset. `vercel.json` installs the locked dependencies and builds the browser files into `dist`. Vercel handles the API routes separately. The production branch is `main`.

The draft sync preview uses a Neon Postgres database with Neon Auth. Connect the database to the intended Vercel environment and set a sensitive `NEON_AUTH_COOKIE_SECRET` (at least 32 random characters). The integration sets `DATABASE_URL` and `NEON_AUTH_BASE_URL`. Preview and Production can use separate Neon databases. The first authenticated draft request creates the table. Draft reads and writes are scoped to the verified session ID, and version checks prevent an unnoticed overwrite.

On the site, open **Профиль** to create an account or sign in. In the budget editor click **Сохранить в аккаунте**. On another device, sign in at the same site and click **Открыть из аккаунта** in the profile. This transfers budget drafts and the open stage. Finished projects, poster work and notes remain local.

For AI learning plans, add `DEEPSEEK_API_KEY` as a **Sensitive** server environment variable on the intended Vercel environment, then redeploy the branch. For this integrated preview, use the `feat/learning-experience` branch filter if supported. `DATABASE_URL` is required for the shared quota (10 requests per IP and 100 total per UTC day for that database). The first request creates the quota table. Never add the secret to a frontend file. Without a key, the page shows the unavailable state and offers ready-made courses.

From the home page, enter a goal and choose 5, 10, or 20 minutes. The route calls [DeepSeek Flash with web search](https://api-docs.deepseek.com/guides/web_tools/) and links to returned search results. Each step asks the learner to record a result. DeepSeek [uses thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/) to review each submission and suggest a follow-up action. The final step uses an independent task and the result screen shows the submitted work and its feedback or self-check criterion. Plan generation and reviews share the same quota.

The header language selector offers English, Russian, and Kazakh. New lessons and reviews use the language selected when the lesson starts. Saved lessons and answers stay in their original language. Browser storage keeps the selected language, current route, and feedback.

Google Fonts supplies Nunito when available; a system-font fallback is provided. No analytics or tracking scripts are included.
