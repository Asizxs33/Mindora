# Ready mini-courses

`core/starter-courses.js` contains four original, authored courses in English, Russian and Kazakh. Each has 5-, 10- and 20-minute versions. They complement the existing design and budget courses. They are not live AI-generated lessons and do not claim to execute Python code.

Each course uses the existing version 3 plan contract. Every guided lesson has an explanation, worked example, deterministic check, takeaway and practice. An independent task closes the course. These are estimated learning times, not timers or promised completion times.

| Version | Lesson allocations | Structure |
| --- | --- | --- |
| 5 minutes | 2 + 3 | Original guided lesson and original independent task, unchanged |
| 10 minutes | 2 + 3 + 5 | Original lesson, one new skill, combined independent task |
| 20 minutes | 3 + 5 + 5 + 7 | Original lesson, two new skills, combined independent task |

| Course | Added in 10 minutes | Also added in 20 minutes |
| --- | --- | --- |
| AI prompts | Separate instructions from source notes | Check an answer for unsupported claims |
| Python | Variables and reassignment | Numeric addition versus string joining |
| English | Negatives with `be` | Standard yes/no questions and short answers |
| Clear writing | Name the known actor and action | Split crowded instructions while keeping order and facts |

`getStarterCourse(id, language, minutes = 5)` returns a fresh, validated `restorePlan` result with empty answers and no awarded progress. `starterCourses(language, minutes = 5)` returns catalog metadata, including selected `minutes`, supported `durations` and `stepCount`. `STARTER_DURATIONS` exposes the frozen list `[5, 10, 20]`. Unsupported language codes fall back to English. Unknown course IDs or unsupported durations return `null`; unsupported catalog durations return `[]`.

The controller must include `minutes` when finding an existing course copy (alongside title, goal and language). Do not replace a saved five-minute plan with a longer version or transfer its completion count automatically. Each duration is its own saved course; existing account ownership, resume and conflict-handling rules remain unchanged.

The examples, exercises and translations were written for Mindora. These primary references support the underlying concepts and are linked as further reading inside the lessons:

- `ai-prompts`: [Google AI Studio prompt design](https://aistudio.google.com/docs/prompting-strategies), for clear instructions, input and constraints. No model-specific feature or performance claims are taught.
- `python-basics`: [Python tutorial](https://docs.python.org/3/tutorial/introduction.html), for quoted strings, print output, assignment and numeric versus string operations. The displayed examples do not execute code.
- `everyday-english`: [British Council: present simple “to be”](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/present-simple-be), for am/is/are, negatives, questions and short answers. The English practice sentences intentionally remain English in all interface languages.
- `clear-writing`: [National Archives plain writing checklist](https://www.archives.gov/open/plain-writing/checklist.html), for direct, active wording and short sentences. The fictional invitations and reminders are original examples. Splitting actions is taught as a useful editing technique, not a universal grammar rule; see also the [Australian Government Style Manual](https://www.stylemanual.gov.au/writing-and-designing-content/clear-language-and-writing-style/sentences).

Opening a catalog course must be an explicit user action. The controller uses the existing account course library to create or reopen the user's copy; this module never saves, fetches, contacts a model or changes progress. Saving and optional practice feedback retain the existing service requirements. Course content is ready immediately without a generation request.

Validation covers all 36 language/course/duration combinations, exact duration totals, distinct lesson content, all five assessment types, incorrect-answer gating, partial answers and page restoration, fresh-copy isolation and persistence through `restorePlan`. Twelve pre-change content digests protect the exact published five-minute saved plans.
