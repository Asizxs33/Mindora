# Detailed AI lessons

## Reference observations

The user selected only the detailed lesson format, not a full course catalog.
On 2026-11-14, the first ChatGPT lesson in Coursiv was inspected in the browser:

- The [catalog](https://app.coursiv.io/explore-ai-tools) leads to a [course pathway](https://app.coursiv.io/guide-pathway/3656efef-4575-80f8-9aa6-c311c6bee5b7).
- The [first reading lesson](https://app.coursiv.io/guides/3656efef-4575-80f8-9aa6-c311c6bee5b7/8cb19705-a143-4232-9cd4-3579e249b7c1/3656efef-4575-81ba-80c9-c5b444edc375?isLastLesson=false&isAudio=false&hasAudio=true) introduces a practical situation, progressively reveals explanations, then asks a multiple-choice question. Submitting an answer reveals an explanation before continuing. Audio is optional.

These are observed interaction patterns, not copied course content or a claim that Coursiv generates its material with AI.

## Mindora behavior

The goal and 5/10/20-minute selection still produce one practical lesson. New lessons use `formatVersion: 2`. Each guided task has four screens:

1. Explanation: purpose, instructions, and relevant verified-source images.
2. Worked example: input or initial situation, result, and explanation.
3. Local knowledge check: three options and corrective feedback. A correct answer unlocks practice.
4. Practice: the learner's own result and optional recovery when AI review is unavailable.

The final task remains independent practice. Navigation, choice checks, and reloading a saved lesson make no new AI requests. Only generation and written-answer reviews use the existing quota. Time includes reading, checking and practice; it is an estimate rather than a countdown.

## Integration contract

- `core/learning-plan.js` validates `teaching` and restores per-step `study: { page, choice, checked }` entries. `lessonPages(step, isFinal)` declares the screen sequence.
- `core/plan-controller.js` owns navigation, gating, attempts and persistence. `ui/learning-plan.js` renders supplied state, with styles in `ui/ai-lesson.css`.
- New actions: `data-learning-page="back|next|check"`, `data-learning-choice="0|1|2"`. Existing goal, answer and review hooks remain supported.
- Old lessons without `formatVersion` remain readable. They use an explanation screen followed by practice; no invented example or quiz is added to old material.
- Images resolve only from retrieved source IDs. No raw source-language captions are displayed. The model may not invent screenshots.
- Local checks compare a selection against an AI-authored answer key. They provide practice feedback, not independent expert certification. Written feedback also does not certify mastery.

The main design files, built-in poster/spreadsheet courses, account schema, billing and quota settings are outside this change.

## Validation

- 122 automated tests passed, including restoration, checkpoint retry/gating, source binding, controller transitions and history for legacy lessons.
- Syntax checks and the production static build passed.
- Browser walkthrough used a local deterministic test server: explanation, worked example, wrong/correct checkpoint, reload, written practice, final submission, and restored history. Mobile layout was checked at 390 pixels.
- This UI walkthrough does not demonstrate live DeepSeek output. The fixture server is outside the repository and is not deployed.
