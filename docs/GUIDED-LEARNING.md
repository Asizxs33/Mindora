# Guided learning

**Түсіну — мүмкіндіктің басы.** / **Понимание открывает возможности.** / **Understanding opens possibilities.**

The interface teaches one idea at a time. Mino welcomes the learner; a mentor explains the material, demonstrates it with a relevant object, and responds to the learner's answer. Orange identifies the main action. Decorative statistics, extra cards and the full navigation do not compete with the first lesson.

## First entry and daily use

1. Mino says hello. There is one primary **Begin** button, a language choice and an existing-account sign-in link.
2. Ask the learner's name.
3. Choose a poster, spreadsheets, English or a custom topic. Only the custom option asks for a short goal.
4. Choose 5, 10 or 20 minutes, then start. Existing account verification and profile persistence remain responsible for authentication; the introduction does not grant a session.
5. For a ready built-in course, open its learning path first: completed, current and locked steps, Mino's encouragement, and one **Start lesson / Continue** button. The learner enters the lesson deliberately. A custom AI goal uses the existing course-generation flow.

On the next visit, show the last course's path and **Continue**. Ready mini-courses are a secondary action. The library combines the two existing design and spreadsheet courses with four curated starters: AI prompts, Python, English and writing. A starter is copied into the account course library once through the existing public `library.importLocal(saved)` API; choosing the same saved starter again uses `library.load(id)` instead of resetting its progress. It does not require AI generation, but creating or loading its account-owned copy requires the real course-storage backend. An arbitrary goal still needs the configured AI backend.

The greeting and short question screens are designed to fit ordinary phone viewports. Longer translations, browser zoom, the on-screen keyboard and genuinely long lesson material must remain reachable with natural scrolling; never hide content merely to force a screen-height layout.

## Leave, remember, continue

After **more than 24 hours** away from material already encountered, continuing a course opens a brief return review. At exactly 24 hours the existing boundary still allows direct continuation. A completely untouched course does not need a review.

- Reuse at most two real questions from encountered lessons. AI v3 assessments retain their choice, multiple-choice, ordering, matching or gap rules; older v2 checkpoints also work.
- Record each question's **first checked attempt**. A score of at least **70%** resumes the saved place; with two questions this requires two correct answers.
- Below 70%, show short reminders of the basics, then require a correct repair attempt before resuming. Repair does not rewrite the first-attempt score.
- Older plans without a usable assessment show a reminder instead of inventing a scored quiz.
- Keep the original lesson page, quiz position, draft answers, completed stages, saved work and certificates. A review is neither new course credit nor a destructive course restart.
- An unfinished review survives reload. An explicitly requested new practice variant also survives the review. Switching accounts isolates both the course and its pending review.

Policy and state transitions live in [`core/return-review.js`](../core/return-review.js). [`ui/return-review.js`](../ui/return-review.js) handles focused question screens; [`core/app.js`](../core/app.js) connects them to the existing account, course and persistence controllers.

## Persistence boundaries

Workspace storage is scoped to the authenticated account. Review keys use `builtin:<course-id>` or `ai:<server-course-id>`; local legacy AI courses fall back to their goal, duration, language and title. The pending review and AI visit timestamps are **browser-local metadata**. They are not a cross-device review history, and clearing this origin's browser storage removes them. Legacy courses with identical fallback fields share an identity; durable course IDs are preferred.

The existing backend library and built-in synchronization continue to store their supported course/workspace data. A server timestamp can help detect an old AI course when no local visit exists, but it is not proof of a learner's last activity on every device. Full cross-device inactivity and pending-review synchronization require a versioned backend change. Keep cloud conflict handling and account checks intact when adding that support.

## Extend the constructor

Use the [scene constructor contract](../ui/SCENE-CONSTRUCTOR.md) and its authoring preview at `/ui/scene-library.html`. Available objects are a **monitor**, **canvas**, **spreadsheet**, **notebook** and **before/after comparison**. Select an object only when it makes the concept easier to understand. Existing instructional source images retain their source attribution.

For each new topic or template:

1. Define one learning objective and a short explanation, then one useful example and one assessment.
2. Select a mentor and a relevant object. Use the supplied character's real gesture; provide a still image and reduced-motion behavior.
3. Keep one primary action. Show feedback after checking, with a useful explanation of the answer.
4. Add content through the existing validated lesson schema. The live v3 generator already supports deterministic assessments. Explicit model-authored scene objects still need backend schema, validation and persistence support; the current live examples use deterministic topic frames.
5. Verify a narrow phone layout, keyboard focus, long localized text, image failure and return-after-day behavior. Confirm that existing saved courses restore without loss.

The [MVP foundation](../ui/MVP-FOUNDATION.md) remains the broader component/template reference; this document describes the simplified entry and updated return-review policy.

## Real service requirements

Local UI previews and template samples do not configure real accounts or AI generation. The deployment needs `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` and `DEEPSEEK_API_KEY` in server-side environment settings, together with the existing auth, course storage and provider routes. Never embed their values in browser files or documentation. Missing configuration must produce an honest unavailable/retry state, not fake registration, fake cloud saving or invented AI feedback.

Run `npm test` and `npm run check`. Relevant regression suites are `tests/app-flow.test.js`, `tests/return-review.test.js` and `tests/resume.test.js`.

For the phone-sized browser flow, start the app server and run [`scripts/verify-guided-browser.mjs`](../scripts/verify-guided-browser.mjs). It requires Playwright and Chrome. `MINDORA_URL` defaults to `http://127.0.0.1:4175`; optional `PLAYWRIGHT_MODULE` points to an already installed Playwright package when it is not locally resolvable. For example, in PowerShell:

```powershell
$env:MINDORA_URL = 'http://127.0.0.1:4175'
# Optional: $env:PLAYWRIGHT_MODULE = 'C:/path/to/node_modules/playwright'
node scripts/verify-guided-browser.mjs
```

This browser test deliberately mocks API responses to exercise the real interface, account flow, course player and return review. It does not verify production credentials, a real provider's grading or cloud persistence. Verify those separately against the configured backend before claiming that they are live.
