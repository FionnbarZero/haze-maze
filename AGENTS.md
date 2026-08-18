# Tech

Modern HTML/JS only. Don't worry about backwards compatibility to old browsers.

Design for Windows and Mac desktop browsers first. Prioritize keyboard and mouse
controls, desktop-quality presentation, and the complete desktop experience.
Keep new input architecture ready for future gamepad support.

Mobile-phone development is paused. Preserve the existing landscape-touch
controls, responsive code, instrumentation, and test records, but do not add
mobile-specific features, optimization, or device qualification unless the user
explicitly resumes that work. Keep shared systems reasonably portable without
allowing mobile limitations to constrain desktop design.

# Source control

When committing code, include a list of all prompts between now and the last commit, e.g.:

```

Commit title

- changed feature 1
- changed feature 2

Prompts:

> Prompt 1
> Prompt 2

```
