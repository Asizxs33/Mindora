# Mindora interface handoff

The redesign keeps the existing two-course controller intact and makes the learning journey easier to follow on a phone. The interface is English, with cream surfaces, cocoa text, sage actions, the capybara glasses logo, and friendly illustrated mentors.

## Ownership and integration

- All application changes are in `ui/`. Core rules, saved-state shape, course IDs, correct-answer indices, checks, and export handlers are unchanged.
- Existing IDs, `data-*` hooks, exported functions, and arguments in `docs/TEAM.md` are preserved.
- Four main destinations: Learn, My courses, My work, and Profile. My courses lists only courses the learner has started.
- Lessons, quizzes, both editors, results, empty states, preferences, and dialogs use the same design system. Secondary destinations remain available from Profile.
- This branch presents the existing poster and spreadsheet courses. It does not claim that arbitrary course generation, accounts, payments, or cloud sync are available.

## Presentation modules

- `styles.css`: shared tokens, typography, controls, dialogs, and accessibility foundations.
- `adventure.css`: responsive shell, home, course list, profile, and secondary screens.
- `lessons.css`: learning path, lesson, quiz, editors, results, and saved projects. Loaded by `views.js`.
- `lesson-copy.js`: English presentation copy for the fixed curriculum; unknown learner text is preserved and escaped.
- `presentation.js`: document language/branding, exact known toast translations, and immediate daily-pace display updates.
- `shell.js`: preserves keyboard focus across quiz/check redraws. Route focus remains owned by core.

## Brand and characters

`assets/brand-mark.svg` is the compact capybara-and-glasses mark; `assets/brand-logo.svg` is the full lockup. Mino welcomes learners, Mia guides design, Sam guides spreadsheets, and Leo appears in the coding information dialog.

`character(kind, mood, className)` returns an accessible button. Do not nest it inside another interactive element. Each 2×2 transparent atlas contains welcome, thinking, explaining, and celebration poses. The frame stays square at every size. Tapping a buddy triggers a brief greeting; question feedback and results choose the appropriate pose.

Motion respects the device's reduced-motion preference and the Profile switch. It pauses in hidden tabs. The optional preference uses `mindora.characters.motion.v1`, separate from core learning state. Fallback images remain available if an atlas cannot load. Character CSS loads automatically; no new package dependency is required.

## Verification

- `npm run check`: passed.
- `npm test`: 8/8 passed.
- Every `ui/*.js` also passed `node --check`.
- Browser: both complete paths, wrong/correct quiz responses, locked steps, poster live preview, check invalidation after edits, saved drafts after reload, spreadsheet validation, course completion, SVG and CSV downloads, daily pace, and motion switch.
- Responsive inspection at 320 px, 390 px, and desktop. No horizontal overflow in the inspected screens; no browser console errors.
- QA uses local demonstration projects, not production learner data.

## Existing core limitation

The poster preview uses an English footer, but the core-owned SVG export still contains its original Russian footer. Export content and behavior were deliberately kept with the functionality owner. Core also owns persistence: this version saves progress in the current browser, which is stated in the UI.

The review deployment is separate from the team's main site. Merge into `main` only through the repository's review workflow.
