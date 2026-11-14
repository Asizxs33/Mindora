# Adaptive short lessons

Mindora narrows a broad topic before generating its four-session learning path. Each session is sized for 5, 10, or 20 minutes.

## Learner flow

1. Enter a topic or a concrete result. DeepSeek proposes three related applications and a short diagnostic question for each. A learner can choose their own result.
2. Select experience and attempt the diagnostic, or say that they do not know yet. Motivation and available daily time complete the questionnaire.
3. Review the path before starting. Its starting level is a provisional estimate, not a certification. The goal and diagnostic observation inform the lessons.
4. Open a stage to research and generate that lesson. Later stages receive preceding stage objectives so examples build on earlier work.
5. Read a concise explanation, inspect a relevant source illustration when available, study a worked example, solve a check, and create original work.
6. Save a draft, receive feedback, and reopen the lesson from the account on another device.

## Available practice

- Code: a source editor, recorded output and a short explanation. Python can run explicitly in an isolated browser sandbox; other languages are writing exercises.
- Palette: three colors, a headline, a live preview, a text contrast measurement and a rationale. This does not grade arbitrary drawings.
- Calculation: result with units and written solution steps.
- Text: original writing and other tasks with an explicit success criterion.

Structured answers reuse the existing account course storage and stay under its 1,500-character answer limit. Existing courses without practice metadata retain their text editor.

## Research

The agent searches web guides and GitHub lessons and reads the actual source text. The bounded source catalog supplies targeted search hints and a fallback only when no readable search material exists. A catalog link is never treated as evidence by itself. Images must come from a retrieved source and support the lesson; no image is invented when the page has none. Public access does not authorize republishing a complete course.

Useful upstream projects: [Microsoft Web Dev for Beginners](https://github.com/microsoft/Web-Dev-For-Beginners), [Microsoft Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners), and [Pyodide](https://github.com/pyodide/pyodide). Lessons cite their actual opened sources.

## Boundaries

A four-session milestone is not a complete professional qualification. The diagnostic and AI feedback can be wrong. The product should say what was observed in the submitted work rather than claim verified mastery or execution that did not happen.

## Verification

Run npm run check, npm test and node scripts/build.mjs. Regressions cover clarification validation, account ownership, retries, diagnostic preservation, path continuity, source fallback provenance, practice normalization and draft restoration. Browser checks also exercise Python execution, stopping, palette preview and reload.
