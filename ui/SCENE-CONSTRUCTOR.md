# Mindora lesson scene constructor

One screen should explain one idea. A scene is the object the mentor teaches with, not an extra decorative card. The orange interface remains quiet; the supplied character retains its original colours and real GIF gestures.

Preview five working objects at `/ui/scene-library.html`. This is an authoring preview, not an enrollment or a graded course.

## Choose the object

| Type | Use when | Supply |
| --- | --- | --- |
| `monitor` | Code, commands, AI prompts or a computer result | `lines` (1–8), optional `output` |
| `canvas` | A poster, drawing composition or a presentation hierarchy | `headline`, `detail`, optional `action` |
| `spreadsheet` | Cells, quantities, expenses, totals and formulas | `columns` (1–3), `rows` (1–5), optional `formula` |
| `notebook` | Writing, language patterns, a short plan or study notes | `lines` (1–6) |
| `comparison` | The important concept is a difference between two versions | `before`, `after` |

Every scene requires `type` and a descriptive `title` (at most 100 characters). Optional `caption` is at most 180 characters. Content is plain text, in the lesson's language. The schema deliberately excludes arbitrary HTML, CSS, scripts, URLs, SVG, styles, remote backgrounds and image-generation prompts.

```json
{
  "type": "monitor",
  "title": "A first Python greeting",
  "lines": ["name = \"Mia\"", "print(\"Hi, \" + name + \"!\")"],
  "output": "Hi, Mia!",
  "caption": "Change the name. The greeting changes with it."
}
```

`normalizeLearningScene(data)` validates the allowlist and bounded content, rejects malformed rows/required fields, and drops unknown fields. `renderLearningScene(data)` returns escaped accessible HTML or an empty string for invalid content. Code and formulas are examples only; they are never executed. The author must verify that a supplied output actually follows from its input.

For a standalone lesson block, use an `illustration` with either `image` **or** `scene`, never both:

```js
{
  type: 'illustration',
  title: 'A first greeting',
  mentor: 'sam',
  intro: 'A computer follows one clear instruction.',
  body: 'The variable stores the name; print shows the greeting.',
  scene: { type: 'monitor', title: 'Greeting', lines: ['print("Hi!")'], output: 'Hi!' }
}
```

## Live course connection

The existing live v3 lesson generator and deterministic assessments are preserved. Generated lesson examples now place their **actual input and output** inside a topic-appropriate frame. `sceneForTopic()` selects a computer, canvas, spreadsheet, notebook or neutral comparison. `learningSceneFrame()` takes trusted UI markup only; never pass model-authored HTML to it. This styling does not invent lesson facts or another practice task.

Existing source images stay attached to their source and remain the first choice for illustration pages. No background is added to an illustration that already explains the topic. Checkpoints remain uncluttered: a tutor, question, answers and one primary action.

Explicit structured scenes work in the presenter/studio. The production API does **not yet accept arbitrary `scene` fields**: adding model-authored scene data needs a versioned backend schema update, persistence/restore validation and limits matching `normalizeLearningScene`. Until then the live example uses its deterministic topic frame. Do not claim the model generates scene objects just because the UI supports them.

## Prompt contract for the next backend iteration

Ask the generator to select at most one allowed scene only when it clarifies the learning point. It should provide a short title, accurate content and a caption only if the caption adds information. Prefer a real retrieved instructional image when available. Use the mentor who matches the topic; `thinking` belongs to a question, `explaining` to a demonstration and `celebrate` only to an actual successful check. A submitted draft is not automatically a correct answer.

Preserve the text explanation even if media fails. Test 320 px layouts, keyboard access, reduced motion, long translated content, image errors, and account-scoped resume. Never reset course progress because the visual template changed.

## Source references

The supplied `Mindora Design Pack / Course visuals` shows reusable computer, poster, notebook and table motifs. Those reference sheets informed the object framing; the application renders live text and controls rather than embedding a screenshot of an interface. Original character animations and their provenance remain in `ui/assets/design-pack/README.md`.
