# Mindora — orange learning MVP

This document describes the implemented UI, its content contract and the remaining backend integration. It is a handoff for extending the product without replacing the existing course controller.

## Product flow

1. A new learner sees Mino, one goal field and a 5/10/20 minute choice. Two ready-made courses provide immediate practice.
2. Account onboarding uses three screens: name with optional profile details → interests → credentials. Existing sign-in, verification, profile and sign-out endpoints remain in use. Guest learning remains available when authentication is not configured.
3. Returning learners get a primary Continue action. The saved AI lesson is available in My courses, alongside the design and spreadsheet courses. Changing the goal is a secondary disclosure.
4. A ready-made course has four steps: learn → quiz → guided practice → independent project. The course path exposes the next step and keeps later steps locked according to the existing controller.
5. Each AI teaching task uses understand → example → quick check → practice. The final task is independent. A wrong checkpoint answer shows an explanation and allows another attempt.
6. Drafts and lesson position use the existing browser storage. Existing account/cloud draft behavior is preserved. A return after the existing inactivity threshold opens the existing short recap for ready-made courses.
7. Completed ready-made courses offer a named downloadable certificate. AI lessons show actual submitted work and feedback, without inventing a qualification or certificate.

## Visual system

| Token | Value / purpose |
| --- | --- |
| Accent | `#bc4b00`, primary actions and the current step |
| Dark accent | `#963c00`, depth and pressed states |
| Peach | `#fff3e8`, mentor speech and secondary selections |
| Ink | warm near-black, normal body content |
| Canvas | white; light warm panels |
| Success / error | green / red with text and icons, never colour alone |
| Actions | at least 44 px; one prominent next action per learning screen |
| Text | short heading, one idea, clear result; EN/RU/KK interface |

`styles.css` exposes semantic accent tokens while retaining the legacy `--blue` aliases for compatibility. Artwork retains the supplied character colours. The orange interface does not recolour the source characters.

## Characters are teachers

`characters.js` is the single asset registry. `mentorForTopic()` in `lesson-templates.js` chooses an appropriate mentor; a course can also provide one explicitly.

| Character | Role | Source / motion |
| --- | --- | --- |
| Mino | Welcome, goals, unfamiliar subjects, recap | existing capybara atlas and fallback |
| Mia | Design and layout | supplied full-body GIF, with a still frame and original PNG fallback |
| Sam | Coding and spreadsheets | supplied full-body programmer artwork |
| Ari | Illustration and drawing | supplied full-body artist artwork |
| Nora | Writing and languages | supplied full-body copywriter artwork |
| Zoe | Social content and marketing | supplied full-body SMM artwork |

States: `welcome`, `thinking`, `explaining`, `encourage`, `celebrate`, `incorrect`. A character stands alongside their actual instruction, question or feedback. The full body uses `object-fit: contain`; never crop the image into an avatar for a lesson scene.

Mia plays a short pointing sequence with pauses. Playback stops when hidden, offscreen, disabled in the profile or when the device requests reduced motion. Static artwork remains visible. Other people currently use still artwork and existing presentation motion; they do not yet have independent limb animation. Add an approved GIF and still frame to the character registry to upgrade them without changing a lesson.

## Ten reusable templates

Open `/ui/template-library.html` for a working interactive studio. It is a development/content preview, separate from course credit. Its example answers are saved under `mindora.template-studio.v1`, not in the learner's course progress.

| Type | Required content beyond title | Interaction |
| --- | --- | --- |
| `theory` | `body` | one idea with mentor speech |
| `illustration` | `image: {url, alt}`, `body` | illustration, explanation, full-body guide |
| `comparison` | `before`, `after`, `explanation` | starting point and worked result |
| `choice` | `options`, `answer`, `explanation` | one correct option |
| `multi-choice` | `options`, `answers`, `explanation` | exact set of correct options |
| `order` | `items`, `answer`, `explanation` | accessible up/down controls; no drag requirement |
| `match` | `pairs: [{left, right}]`, `explanation` | choose matching pairs |
| `gap-fill` | `before`, `after`, `accepted`, `explanation` | typed word/phrase, trimmed case-insensitive check |
| `practice` | `body`, `criterion` | free-response draft and self-check criteria |
| `recap` | `points` | short reminder before returning to work |

Every type can include `id`, `intro` and `mentor`. Content is plain text. HTML and scripts are escaped. Source images require HTTPS or a local `/ui/assets/` path. Limits and answer validity are checked by `normalizeLessonTemplate()`; malformed blocks return `null`. This UI validation supplements, rather than replaces, server-side validation of generated content.

```js
import { normalizeLessonTemplate, mountLessonTemplate } from './lesson-templates.js';

const block = normalizeLessonTemplate({
  id: 'grammar-days', type: 'gap-fill', mentor: 'copywriter',
  title: 'Finish the invitation.',
  before: 'Visit our café', after: 'Saturday.',
  accepted: ['on'], explanation: 'Use “on” before a day of the week.'
});
if (block) {
  const dispose = mountLessonTemplate(container, block, {
    state: savedAnswer,
    onChange: answer => saveAnswer(block.id, answer)
  });
  // Call dispose() when replacing the screen.
}
```

The presenter reports answer state, not course completion. Free text returns `correct: null`: keeping a draft does not mean the work was graded. Use the existing review endpoint for real feedback.

## What is connected to the production controller

`learning-plan.js` now uses the shared mentor scene, subject mapping, theory and comparison renderers. Existing quiz/practice hooks and state transitions are preserved. The remaining assessment variants work in the studio and are ready for a course adapter.

The existing backend v2 contract still supports `why`, `example`, a three-option `checkpoint` and `takeaway`. It strips unknown fields. **It does not yet generate arbitrary blocks from all ten templates.** Do not add a model prompt claiming that these variants are available in live plans until the backend validator and controller accept them.

To connect every template to generated lessons, the backend owner should:

1. Introduce a versioned block schema; validate types, sizes, media sources and answer keys server-side.
2. Reuse stable block IDs and store answers by block ID, including `choice`, `selected`, `order`, `matches` and `value`.
3. Add block-level progression to the controller while retaining migration for existing v1/v2 saved plans.
4. Reconcile cloud and browser drafts using server timestamps. The current AI plan has no last-used timestamp, so the home screen prioritizes a saved AI plan; users can choose another course in My courses.
5. Grade deterministic questions on the server if they award credit. Route written practice to the review endpoint. Do not trust client answer keys as proof of completion.
6. Extend the inactive-return recap to generated plans. Existing recap behavior covers the ready-made courses.
7. Issue AI course certificates only after defining server-side completion criteria.

## Account and storage boundary

The UI continues to call `/api/account` and existing draft endpoints. It never stores passwords or pretends that guest browser storage is an account. `available: false` means the auth service needs deployment configuration.

Required backend setup is documented in the existing [backend handoff](https://github.com/Asizxs33/Mindora/blob/feat/account-onboarding/docs/BACKEND-HANDOFF.md). Environment names include `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` and `DEEPSEEK_API_KEY`; actual values must remain in the deployment secret store.

Suggested logical records for the next backend iteration: users/profile; course versions and ordered blocks; user enrollments; per-block attempts; saved work; issued certificates. Store the content version on an enrollment so a new deployment can update the UI without silently invalidating a learner's work. Do not reset progress on every commit.

## Extension checklist

- Add new content as data; reuse an existing renderer before adding a new screen.
- Preserve the `ui`/`core` contract in `docs/TEAM.md`.
- Use a supplied full-body character; provide a static fallback for every new animation.
- Keep one prominent next action, keyboard access, focus after transitions and reduced-motion behavior.
- Add translations for interface labels. Course text retains its own language.
- Test a fresh start, wrong answer, retry, refresh, exit/resume and completion at 320/390/1440 px.
- Run `npm run check`, `npm test`, `node scripts/build.mjs`; check new modules explicitly with `node --check`.
- Test the public deployment after publishing. A successful frontend build alone does not prove auth or AI provider availability.

## Delivery

Work is isolated on `design/orange-mentors`; backend/core files are unchanged. The checkpoint is `9c21927`. The final UI commit follows it. Deploy the design project `mindora-design`, leaving the team's main production project under its existing release workflow.
