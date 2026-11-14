# Agent 5 — UX / interaction design / accessibility

## Continuous workstream: turn the UX audit into an implementation-ready product experience

You own UX research, interaction specifications, acceptance criteria and static prototypes. You are not limited to one shortcuts document. Complete the entire spec pack in sequence and keep working while implementation PRs are reviewed.

### Phase 0 — AC-026: Keyboard shortcut and command-discoverability specification
Branch agent/keyboard-shortcuts-plan. Sync latest main. Create KEYBOARD_SHORTCUTS_PLAN.md with current handler audit; platform modifier policy for Windows/Linux/macOS; reserved browser/OS combinations; tool/undo/redo/selection/layer/frame/playback shortcuts; focus rules; conflicts; discoverability; keyboard-only/accessibility acceptance matrix. Never intercept browser-reserved shortcuts.

### Phase 1 — AC-049: Canvas navigation and workspace interaction specification
Create docs/ux/CANVAS_WORKSPACE_SPEC.md. Define pan/zoom, cursor-anchored zoom, fit/reset, minimap decision, touchpad/wheel behavior, keyboard alternatives, responsive panels, focus and viewport boundaries. Align with Agent 2's canvas viewport contract. Include exact acceptance criteria and test cases.

### Phase 2 — AC-050: Layer, frame and timeline workflow specification
Create docs/ux/LAYER_TIMELINE_SPEC.md. Cover layer add/rename/reorder/visibility/lock/opacity, active cel rules, frame duplication/deletion/reorder/duration, onion skin, empty states, undo/redo and destructive confirmation. Include keyboard paths and focus management. Respect Agent 6's safety guard and Agent 3's export ordering contract.

### Phase 3 — AC-051: Palette and export user journeys
Create docs/ux/PALETTE_EXPORT_SPEC.md. Define import preview/validation/error recovery, duplicate/color-name handling, palette editing and save behavior, export presets, frame selection, timing/transparency disclosures, file naming and download feedback. Cover GPL/JASC-PAL/JSON, sprite-sheet metadata and GIF constraints.

### Phase 4 — AC-052: Accessibility and interaction audit
Audit the current source/UI for keyboard reachability, visible focus, labels/names, contrast, motion/animation preferences, error announcements, dialog focus traps and zoom behavior. Produce docs/ux/ACCESSIBILITY_AUDIT.md with severity, reproducible current behavior, target behavior and automated/manual validation. Do not claim WCAG conformance without an audit.

### Phase 5 — AC-053: Static interaction prototypes and design patterns
Create self-contained static HTML/CSS prototypes under docs/ux/prototypes/ for:
- shortcut reference/command search;
- canvas workspace with navigation controls;
- layer/timeline panel states;
- palette import preview and export dialog.
Use the established Art Club visual language and avoid generic AI-dashboard patterns. Prototypes must be clearly labeled as non-production and must not be wired into index.html.

### Phase 6 — AC-054: Integrated UX implementation roadmap
Update docs/UX_IMPLEMENTATION_PLAN.md or add docs/ux/IMPLEMENTATION_SEQUENCE.md that connects all specs, identifies cross-agent dependencies, prioritizes correctness/safety before workflow improvements and polish, and provides a release-acceptance checklist. Keep each implementation slice small enough for a later owner but broad enough to produce user-visible value.

## Ownership
Documentation and static prototypes only: KEYBOARD_SHORTCUTS_PLAN.md and docs/ux/**. Do not edit index.html, app JavaScript, CSS, existing tests, bridge or workflow. The coordinator assigns UI implementation ownership separately.

## Working rules
The whole specification pack is pre-authorized. Submit a PR for the shortcut spec, then immediately start the workspace spec on a new branch. Do not wait for the coordinator to review each document. Continue through the queue.

## Handoff
Update only coordination/status/agent-5.md with completed specs, PRs/branches, audit evidence, prototypes and the next 3–5 actions. Do not merge or self-accept.
