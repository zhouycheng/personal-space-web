# JustinWeb Context

This file records project vocabulary that should stay stable across planning,
implementation, QA, and design discussion.

## Homepage State Vocabulary

Use these names when discussing the homepage launch experience:

- `全显状态`: the default homepage composition where the complete laptop/terminal
  shell is visible on the light page background, with the bottom navigation dock
  visible.
- `推拉状态`: the scroll-driven camera transition shared by the laptop leaving
  the viewer and the computer moving closer again. Use this name for both the
  departure transition and the approach transition.
- `Justin OS 状态`: the fullscreen blue OS projection after the launch
  interaction, where the page reads as the Justin OS desktop rather than a
  standalone laptop mockup.

These terms describe homepage states, not separate routes. Keep future README,
plans, QA notes, issue titles, and implementation comments aligned to this
vocabulary when referring to the launch page.

## Documentation Entry Points

- `README.md`: active runtime, commands, implementation status, and structure.
- `CHANGELOG.md`: version-level changes and verified milestones.
- `docs/README.md`: repository documentation index.
- `docs/work/`: active work, backlog, and decisions.
- `docs/develop/workflow.md`: durable workflow and validation rules.
- `.agents/skills/README.md`: project-local skill matrix and routing.
