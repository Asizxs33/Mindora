# Mindora

Read [the team workflow](docs/TEAM.md) before changing the project.

- `ui/` contains screens, markup, styles, icons and illustrations. Keep design tasks inside this folder.
- `core/` contains the controller, course rules, practice checks, progress and export. Put functionality changes here and coordinate changes to the interface used by `ui/`.
- Keep the existing IDs and `data-*` hooks documented in [the UI contract](docs/TEAM.md#контракт-между-ui-и-core) when redesigning a screen. Classes and layout can change freely.
- Launch with `npm start`. Run `npm run check` and `npm test` before opening a PR.
- Use `design/<topic>` for visual work and `feat/<topic>` for functionality. Keep each PR focused on one task. Merge into `main` after review.
