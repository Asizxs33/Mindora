# Ready mini-courses

`core/starter-courses.js` contains four original, authored five-minute lessons in English, Russian and Kazakh. They complement the existing design and budget courses. They are not live AI-generated lessons and do not claim to execute Python code.

Each lesson uses the existing version 3 plan contract: a two-minute guided step with an explanation, worked example, deterministic check, takeaway and practice, followed by a three-minute independent task. `getStarterCourse(id, language)` returns a fresh, validated `restorePlan` result with empty answers and no awarded progress. `starterCourses(language)` returns catalog metadata. Unsupported language codes fall back to English; unknown course IDs return `null`.

The examples, exercises and translations were written for Mindora. These primary references support the underlying concepts and are linked as further reading inside the lessons:

- `ai-prompts`: [Google AI Studio prompt design](https://aistudio.google.com/docs/prompting-strategies), for clear instructions, input and constraints. No model-specific feature or performance claims are taught.
- `python-basics`: [Python tutorial](https://docs.python.org/3/tutorial/introduction.html), for quoted strings and print output. The displayed examples do not execute code.
- `everyday-english`: [British Council: present simple “to be”](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/present-simple-be), for am/is/are. The English practice sentences intentionally remain English in all interface languages.
- `clear-writing`: [National Archives plain writing checklist](https://www.archives.gov/open/plain-writing/checklist.html), for direct, clear wording. The fictional invitations and reminders are original examples.

Opening a catalog course must be an explicit user action. The controller uses the existing account course library to create or reopen the user's copy; this module never saves, fetches, contacts a model or changes progress. Saving and optional practice feedback retain the existing service requirements. Course content is ready immediately without a generation request.

Validation covers all twelve language/course combinations, all four real assessment types, incorrect-answer gating, fresh-copy isolation and backward-compatible persistence through `restorePlan`.
