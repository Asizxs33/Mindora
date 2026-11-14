# Mindora interface handoff

The redesign keeps the existing two-course controller intact and makes the learning journey easier to follow on a phone. The English interface follows the supplied Coursiv references: white surfaces, dark readable text, violet actions, soft illustration panels, and one clear next step. Mindora keeps its capybara glasses logo and its own mentor team.

## Ownership and integration

- All application changes are in `ui/`. Core rules, saved-state shape, course IDs, correct-answer indices, checks, and export handlers are unchanged.
- Existing IDs, `data-*` hooks, exported functions, and arguments in `docs/TEAM.md` are preserved.
- Four main destinations: Learn, My courses, My work, and Profile. My courses lists only courses the learner has started.
- Returning learners get one resume action. Starting another course is inside a closed “Learn something else” disclosure. Profile keeps real progress, learning time, motion, and secondary learning tools.
- Lessons enter a focused layout with the global navigation hidden. A back button returns to the course, and a single primary action stays within reach.
- Each Learn stage has three illustrated ideas, presented one at a time. Only the last idea exposes the controller's completion action. Quizzes use the question as their main heading; poster styling is optional under “Adjust style”.
- Four path segments show Learn, Quick check, Practice, and Challenge. Reading advances the visual progress within the first stage; only the existing completion action changes saved course progress.
- Each reading screen combines a large mentor, a concrete visual example, and one “Remember this” takeaway. Spreadsheet examples stack on phones to keep table labels readable. Wrong answers explain the idea and allow another attempt; correct answers get green feedback.
- Lessons, quizzes, both editors, results, empty states, preferences, and dialogs use the same design system. Secondary destinations remain available from Profile.
- This branch presents the existing poster and spreadsheet courses. It does not claim that arbitrary course generation, accounts, payments, or cloud sync are available.

## Presentation modules

- `styles.css`: shared tokens, typography, controls, dialogs, and accessibility foundations.
- `adventure.css`: responsive shell, home, course list, profile, and secondary screens.
- `lessons.css`: learning path, lesson, quiz, editors, results, and saved projects. Loaded by `views.js`.
- `lesson-copy.js`: English presentation copy for the fixed curriculum; unknown learner text is preserved and escaped.
- `presentation.js`: document language/branding, exact known toast translations, and immediate daily-pace display updates.
- `shell.js`: preserves keyboard focus across quiz/check redraws. Route focus remains owned by core.
- `lesson-flow.js`: presentation-only idea paging, heading focus, and per-course reading position in session storage (`mindora.reading.<course>.v1`). It does not change core progress or drafts. Completing Learn clears the reading position.

## Brand and characters

`assets/brand-mark.svg` is the compact capybara-and-glasses mark; `assets/brand-logo.svg` is the full lockup. Mino welcomes learners. The five human SVGs supplied in `team-characters` are included in `assets/team/` and instantiated by `team-rigs.js`. Mia guides design, Ari demonstrates contrast, Nora explains invitations, Sam guides spreadsheets, and Zoe appears in Profile. Leo uses the programmer artwork in the existing coding information dialog.

`character(kind, mood, className)` returns an accessible button. Do not nest it inside another interactive element. Mino retains the transparent pose atlas. Humans use inline SVG portraits with unique IDs, articulated arms and legs, blinking, and changing expressions. The six moods are welcome, thinking, explaining, encourage, celebrate, and incorrect. Original joint pivots and prop placement are preserved. Tapping a buddy triggers a short wave and an accessible greeting.

Motion respects the device's reduced-motion preference and the Profile switch. It pauses in hidden tabs and for offscreen characters; removed nodes are cleaned up. The optional preference uses `mindora.characters.motion.v1`, separate from core learning state. SVGs have no scripts or external references. Portrait bounds keep people large without cutting off their tools. Character CSS loads automatically; no new package dependency is required.

## Verification

- `npm run check`: passed.
- `npm test`: 8/8 passed.
- Every `ui/*.js` also passed `node --check`.
- Browser: both complete paths, wrong/correct quiz responses, locked steps, poster live preview, check invalidation after edits, saved drafts after reload, spreadsheet validation, course completion, SVG and CSV downloads, daily pace, and motion switch.
- Responsive inspection at 320 px, 390 px, and desktop. No horizontal overflow in the inspected screens; no browser console errors.
- Focused flow: next/back/resume through ideas, hidden final completion until idea three, restored navigation on exit, preserved open style controls after checks, and visible keyboard focus on quiz/check feedback.
- Supplied rigs: unique IDs, preserved joint/prop matrices, different poses across all six moods, time-dependent motion, stable reduced-motion poses, and tap greetings. Final visual review covers all five human roles plus Mino.
- Current white/violet review: a fresh poster journey through all four stages, wrong-answer retry, live preview, save, SVG download, retained progress after reload; mobile spreadsheet reading and desktop saved work. Updated screenshots are in `ui/review/`.
- QA uses local demonstration projects, not production learner data.

## Existing core limitation

The poster preview uses an English footer, but the core-owned SVG export still contains its original Russian footer. Export content and behavior were deliberately kept with the functionality owner. Core also owns persistence: this version saves progress in the current browser, which is stated in the UI.

The review deployment is separate from the team's main site. Merge into `main` only through the repository's review workflow.
