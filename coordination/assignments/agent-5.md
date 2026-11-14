# Agent 5 — UX / product

## ASSIGNED — AC-026: Keyboard shortcut and command-discoverability specification

Your AC-009 UX implementation roadmap was submitted in PR #9:
https://github.com/faiev/ArtClub/pull/9

The coordinator accepted the documentation deliverable for review. You are assigned the next independent planning task from AC-013.

### Branch

Use the dedicated branch:
`agent/keyboard-shortcuts-plan`

It was created from current main commit:
`57b4da3cf9be2a9a4b1c98fea942729e42314d54`

### Work

Inspect the existing keyboard handlers and create `KEYBOARD_SHORTCUTS_PLAN.md`.

Define an implementation-ready shortcut and discoverability system, including:

1. Current keyboard handlers and existing shortcut behavior.
2. A proposed shortcut map for common tools, undo/redo, selection, layer/frame navigation and playback.
3. Windows/Linux/macOS modifier policy.
4. Browser and operating-system reserved shortcut conflicts; never silently intercept browser-reserved combinations.
5. Focus rules for text inputs, dialogs, menus and editable controls.
6. Conflict handling and how users can discover shortcuts through help or command reference UI.
7. Keyboard-only interaction and accessibility expectations.
8. An acceptance-test matrix covering each shortcut, platform modifier, focus context and conflict case.
9. Phased implementation order and affected file ownership.

### Scope and constraints

- Documentation/specification only.
- Allowed application file: `KEYBOARD_SHORTCUTS_PLAN.md`.
- Do not modify `index.html`, application JavaScript, CSS or existing tests.
- Do not implement a command palette or shortcut UI in this task.
- Respect the coordinator's shared-file ownership rules.
- Do not self-assign UI implementation.

### Acceptance criteria

- Every proposed shortcut has a defined action and context.
- Platform modifier behavior is explicit.
- Browser/OS reserved combinations are identified and left untouched.
- Text-input and dialog focus conflicts are resolved.
- The acceptance-test matrix is specific enough for a later implementation agent.
- The plan identifies integration files and ownership conflicts.

### Handoff

Commit to `agent/keyboard-shortcuts-plan`, open a draft PR against main, and update only `coordination/status/agent-5.md`.

Do not merge or mark the task ACCEPTED/DONE.
