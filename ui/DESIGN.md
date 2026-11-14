# Mindora interface handoff

> These are historical notes for the earlier two-course design. The current orange MVP, account requirements, ten templates, supplied GIF support and remaining backend configuration are documented in [MVP-FOUNDATION.md](MVP-FOUNDATION.md). The verification counts and guest-learning statements below describe that earlier version, not the current release.

The redesign keeps the existing two-course controller intact and makes the learning journey easier to follow on a phone. The English interface follows the supplied Coursiv references: white surfaces, dark readable text, violet actions, soft illustration panels, and one clear next step. Mindora keeps its capybara glasses logo and its own mentor team.

## Ownership and integration

- Presentation lives in `ui/`; the controller owns course rules, progress, checks, drafts, and exports. Resume cursors and certificate records are additive core fields. Course IDs and correct-answer indices are preserved.
- Existing IDs, `data-*` hooks, exported functions, and arguments in `docs/TEAM.md` are preserved.
- Four main destinations: Learn, My courses, My work, and Profile. My courses lists only courses the learner has started.
- Returning learners get one resume action. Starting another course is inside a closed “Learn something else” disclosure. Profile keeps real progress, learning time, motion, and secondary learning tools.
- Lessons enter a focused layout with the global navigation hidden. A back button returns to the course, and a single primary action stays within reach.
- Each Learn stage has three illustrated ideas, presented one at a time. Only the last idea exposes the controller's completion action. Quizzes use the question as their main heading; poster styling is optional under “Adjust style”.
- Four path segments show Learn, Quick check, Practice, and Challenge. Reading advances the visual progress within the first stage; only the existing completion action changes saved course progress.
- Each reading screen combines a large mentor, a concrete visual example, and one “Remember this” takeaway. Spreadsheet examples stack on phones to keep table labels readable. Wrong answers explain the idea and allow another attempt; correct answers get green feedback.
- Lessons, quizzes, both editors, results, empty states, preferences, and dialogs use the same design system. Secondary destinations remain available from Profile.
- This branch presents the existing poster and spreadsheet courses. The account interface expects the teammate's `/api/account` integration described in `ACCOUNT-CONTRACT.md`; guest learning remains available. Arbitrary course generation, payments, and cloud progress sync are not available here.

## Presentation modules

- `styles.css`: shared tokens, typography, controls, dialogs, and accessibility foundations.
- `adventure.css`: responsive shell, home, course list, profile, and secondary screens.
- `lessons.css`: learning path, lesson, quiz, editors, results, and saved projects. Loaded by `views.js`.
- `lesson-copy.js`: English presentation copy for the fixed curriculum; unknown learner text is preserved and escaped.
- `presentation.js`: document language/branding, exact known toast translations, and immediate daily-pace display updates.
- `shell.js`: preserves keyboard focus across quiz/check redraws. Route focus remains owned by core.
- `lesson-flow.js`: presentation-only idea paging, heading focus, and per-course reading position in session storage (`mindora.reading.<course>.v1`). It does not change core progress or drafts. Completing Learn clears the reading position.
- `characters.js` / `characters.css`: exact source PNG portraits, Mino's pose atlas, whole-character motion, accessible greetings, and motion preferences. `character-rigs.js` / `character-rigs.css` supply the human image-error fallback only.

## Brand and characters

`assets/brand-mark.svg` is the compact capybara-and-glasses mark; `assets/brand-logo.svg` is the full lockup. Mino welcomes learners and retains the existing transparent capybara pose atlas. All normal human portraits use the exact original PNGs from the supplied `team-characters/team-characters` folder at every display size:

| Identity and role | File in `assets/team/` | Accepted character kinds |
| --- | --- | --- |
| Mia, graphic design | `graphic-designer-v3.png` | `mia`, `designer`, `graphic_designer` |
| Sam, programming and spreadsheets | `programmer-v3.png` | `sam`, `teacher`, `leo`, `programmer` |
| Ari, art and illustration | `artist-v3.png` | `artist`, `art` |
| Nora, copywriting | `copywriter-v3.png` | `copywriter`, `writing` |
| Zoe, social media | `smm-v3.png` | `smm`, `social` |

Each PNG is a single-pose, transparent 1024 × 1536 illustration. Files are copied byte-for-byte: SHA-256 comparisons against all five supplied originals match; full hashes are recorded in [asset provenance](assets/team/PROVENANCE.txt). The 2:3 portrait frame contains the complete original image, including its tools and shoes. There is no normal-size switch to a simplified rig. The legacy `leo` alias now identifies Sam, keeping one name for the programmer artwork.

`character(kind, mood, className)` returns an accessible button; do not nest it inside another interactive element. The six mood values remain welcome, thinking, explaining, encourage, celebrate, and incorrect. For normal human portraits, these select gentle whole-character motion and supporting messages: slow breathing/sway, a small thoughtful tilt, or a brief celebratory lift. The source PNG face and physical pose stay unchanged; default people do not have separately animated limbs or blinking. Tapping a buddy briefly plays a whole-character greeting response and shows a message that is also announced through the live region.

Only a failed human PNG load enables `.character-image-error` and reveals the supplied simplified SVG fallback. `character-rigs.js` embeds the original role geometry and adds outer motion wrappers while preserving authored joint transforms; `character-rigs.css` handles its small gestures and blinking. IDs become local `data-rig-part` handles, so repeated instances introduce no duplicate DOM IDs. This fallback is a different, simplified rendering from the finished PNGs and is not the default illustration. It contains no scripts or external references.

Both normal portrait motion and fallback motion respect the device's reduced-motion preference and the Profile switch. They pause in hidden tabs and for offscreen characters; removed nodes are cleaned up. The optional preference uses `mindora.characters.motion.v1`, separate from core learning state. Character CSS loads automatically; no new package dependency is required.

## Verification

- `npm run check`: passed.
- `npm test`: 31/31 passed in the latest implementation check.
- Every `ui/*.js` also passed `node --check`.
- Browser: both complete paths, wrong/correct quiz responses, locked steps, poster live preview, check invalidation after edits, saved drafts after reload, spreadsheet validation, course completion, SVG and CSV downloads, daily pace, and motion switch.
- Responsive inspection at 320 px, 390 px, and desktop. No horizontal overflow in the inspected screens; no browser console errors.
- Focused flow: next/back/resume through ideas, hidden final completion until idea three, restored navigation on exit, preserved open style controls after checks, and visible keyboard focus on quiz/check feedback.
- Source identity: all five shipped PNG SHA-256 hashes match their supplied originals. Normal human portraits use those single-pose images at every size. SVG articulation belongs only to the image-error fallback; default portrait movement and greetings preserve the original artwork.
- Current white/violet review: a fresh poster journey through all four stages, wrong-answer retry, live preview, save, SVG download, retained progress after reload; mobile spreadsheet reading and desktop saved work. Updated screenshots are in `ui/review/`.
- QA uses local demonstration projects, not production learner data.

## Existing core limitation

The poster preview uses an English footer, but the core-owned SVG export still contains its original Russian footer. Export content and behavior were deliberately kept with the functionality owner. Core also owns persistence: this version saves progress in the current browser, which is stated in the UI.

The review deployment is separate from the team's main site. Merge into `main` only through the repository's review workflow.
