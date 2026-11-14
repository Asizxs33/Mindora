# Supplied Mindora character assets

These files are copied without image modification from the user's **Mindora Design Pack / Characters** folder, supplied on 2026-11-14. The source pack is the design reference; its screen mockups do not change authentication, grading, course progress, or backend behavior.

## Contents

- Mia, Sam, Ari, Nora and Zoe: separate `welcome`, `thinking`, and `celebrate` poses, each as an animated GIF and a transparent PNG still.
- Teaching gestures: `mia-pointing`, `sam-keypress`, `ari-brush`, `nora-writing`, and `zoe-wave`, each as GIF and PNG.
- Mino: `idle`, `welcome`, `thinking`, `explain`, `surprise`, and `celebrate` GIF/PNG pairs.
- `manifest.json`: original relative source paths, dimensions, bytes, frame counts and full GIF cycle durations measured from the supplied files.
- `course-*.png`: the 15 supplied `Course visuals/<topic>/Thumbnail.png` images, copied as optional topic illustrations. These are visuals, not a promise of available courses. The full `Practice-and-check.png` sheets are references only; their content is not substituted for real lesson markup.

The PNG files are motion-free alternatives; use these for reduced-motion preferences, disabled animation, off-screen states, and asset loading fallbacks. The human pose PNGs are 588 × 1024 and the corresponding GIFs are 294 × 512, so the same aspect ratio can be retained without layout shifts. Teaching gestures have their own aspect ratios listed in the manifest.

Load only the active mentor and pose. Do not preload all GIFs. A longer thinking animation already includes pauses; the measured `durationMs` must be used if switching back to a still between cycles. Screen mockups and editable PSDs are deliberately excluded from the web bundle.

## Design reference

The supplied `Screens/S08-meet-your-mentor` combines a large full-body teacher with an instructional object; `Screens/S12-learn` uses a single learning point, a visual comparison, and one clear orange continuation button. `Review/Mentor-expressions.png` shows the distinct expressions used here. The application renders text, bubbles, choices and actions as real accessible HTML rather than embedding screenshot mockups.
