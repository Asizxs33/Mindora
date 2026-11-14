# Mindora

**Learn it. Make it yours.**

Mindora helps busy adults turn a learning goal into a practical result. Choose something to make, work through short explanations and interactive exercises, create your own work, and apply the skill to a fresh challenge.

This repository contains a working **interactive product prototype**, not a universal AI learning service. It includes two bounded sample curricula: visual design and everyday spreadsheets.

## Try it

[Open Mindora on Vercel](https://mindora-livid-eta.vercel.app/).

No registration, API keys, build step, or external JavaScript dependencies are needed.

```sh
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

The larger vision is goal-based learning across many fields: source-backed routes, adaptive practice, personal feedback, and useful independent work. Live AI, automatic research, real-time community features, accounts, cloud sync, and payments are **not implemented** in this prototype. The time selector records a preference; it does not yet adapt the sample curriculum length. Static official resource links are supplied rather than claiming to search the web.

Browser storage is local to a device and origin. Clearing site data removes progress. Export creations to keep separate copies. A completed path records practice, not an accredited qualification or an expert assessment.

## Files

- `index.html`, `styles.css`, `adventure.css`: application shell and responsive visual design.
- `dashboard.js`: dashboard, course catalog, practice, achievements, and guest profile.
- `icons.js`: locally bundled [Lucide](https://lucide.dev/icons/) icons. See `assets/LUCIDE-LICENSE.txt`.
- `assets/`: ImageGen illustrations based on the supplied references: a capybara with glasses and a backpack in a landscape, a trail leading to a castle, and transparent studying and cheering capybara poses.
- `app.js`: navigation, lessons, workspaces, progress, and export.
- `engine.js`: sample curricula, quizzes, goal matching, and deterministic checks.
- `engine.test.js`: meaningful validation tests; no browser or network needed.
- `server.mjs`: local static preview server.

## Verification

```sh
npm test
npm run check
```

Checks cover unsupported goals, contrast, incomplete and malformed work, strict formula parsing, numerical validation, reproducible challenge variation, HTML/SVG escaping, and curriculum shape.

## Deploy

Import this repository into Vercel with Framework Preset **Other**, no build or install command, and the project root as the output directory. The production branch is `main`.

Google Fonts supplies Nunito when available; a system-font fallback is provided. No analytics or tracking scripts are included.
