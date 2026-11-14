# Mindora — orange learning MVP

This document describes the implemented UI, its content contract and the remaining backend integration. It is a handoff for extending the product without replacing the existing course controller.

## Product flow

1. A new learner sees Mino, one goal field and a 5/10/20 minute choice. Two ready-made courses provide immediate practice.
2. Account onboarding uses three screens: name with optional profile details → interests → credentials. Existing sign-in, verification, profile and sign-out endpoints remain in use. The latest backend requires a verified account to start courses; if authentication is not configured, the UI reports unavailability rather than granting guest access.
3. Returning learners get a primary Continue action. My courses includes the account's saved AI lessons and started design/spreadsheet courses, with cloud loading, retry, conflict and import actions. Changing the goal is a secondary disclosure.
4. A ready-made course has four steps: learn → quiz → guided practice → independent project. The course path exposes the next step and keeps later steps locked according to the existing controller.
5. Each AI teaching task uses understand → example → quick check → practice. The final task is independent. A wrong checkpoint answer shows an explanation and allows another attempt.
6. Drafts and lesson position use account-scoped browser storage and the backend owner's new cloud synchronization. Separate courses retain separate progress. Concurrent changes trigger an explicit conflict choice. A return after the existing inactivity threshold opens the existing short recap for ready-made courses.
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

`learning-plan.js` uses the shared mentor scenes and template renderers in generated lessons. In format v3, each guided step uses theory, an illustration if a verified source has one, a worked comparison, one AI-selected exercise, a recap and practice. The five exercise options are choice, multi-choice, ordering, matching and gap-fill. The controller checks their results and saves attempts alongside practice in the account. Older lessons keep their original format.

See [Detailed AI lessons](../docs/DETAILED-LESSONS.md) for the live contract. Awarding credit or issuing certificates would require server-side grading and completion rules.

## Account and storage boundary

The UI continues to call `/api/account`, `/api/learning-courses`, `/api/learning-workspace` and existing draft endpoints. It never stores passwords or pretends that browser storage is an account. `available: false` means the auth service needs deployment configuration. Starting a course is intentionally blocked until a real account is available.

Required backend setup is documented in the existing [backend handoff](https://github.com/Asizxs33/Mindora/blob/feat/account-onboarding/docs/BACKEND-HANDOFF.md). Environment names include `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` and `DEEPSEEK_API_KEY`; actual values must remain in the deployment secret store.

The backend provides profile, account-owned learning courses and built-in workspace stores. Each generated lesson keeps its format version and per-step attempts. Do not reset progress on every commit.

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

Work is isolated on `design/orange-mentors`. The checkpoint is `9c21927`; the template/UI foundation is `63e8bf6`. The final integration includes upstream `bbb508e` (account saving and updated AI behavior). Relative to that upstream, changes remain in `ui/`; backend/core functionality is retained. Deploy the design project `mindora-design`, leaving the team's main production project under its existing release workflow.

At delivery, `mindora-design` has no auth/AI environment configured. The frontend and template studio can be previewed, but real registration, synchronized courses and AI generation require the backend environment above. Do not report these external services as live based only on UI tests.
