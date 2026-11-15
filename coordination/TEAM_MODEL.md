# Art Club — role-based team model

## Ten seats, seven functions

The team has ten agent sessions. These seat labels identify responsibilities, not the retired numbered-agent workstreams.

| Seat | Function | Responsibility |
|---|---|---|
| UI Designer | UI design | Canvas-first visual hierarchy, dimensions, responsive layout and visual consistency |
| UX Designer | UX design | User journeys, contextual controls, keyboard, focus, feedback and accessibility |
| Competitor Analyst | Product research | Current competitor workflow research with sources and actionable recommendations |
| Coder 1 — Layout | Editor/UI | Canvas geometry, pixel squareness, scroll behavior, responsive layout and toolbar density |
| Coder 1 — Workspace | Editor/UI | Timeline/Animate workspace, contextual selection actions, palette expansion and UI state |
| Coder 2 — Safe editing | Core/features | Finish existing UI-02 Clear integration; preserve safe transaction and bridge result semantics |
| Coder 2 — Editing behavior | Core/features | Atomic paste, staged image import, latest-request-wins and keyboard command behavior |
| Verifier — UI | Verification | Independent review of canvas geometry, workspace behavior, visual hierarchy and accessibility |
| Verifier — safety | Verification | Independent review of mutation atomicity, async behavior, persistence and failure paths |
| Coordinator | Coordination | Priorities, exact file ownership, serialized integration, release and deployment |

The coordinator may change seat responsibilities, but must update the board before work changes. One deliverable has one accountable owner.

## Responsibilities and boundaries

### UI Designer
- Design the actual production interface, not a disconnected concept.
- Prioritize drawable canvas size, square pixel cells, sensible panel widths, compact tool rail and discoverable palette.
- Provide concrete dimensions, hierarchy, responsive behavior and interaction-state visuals.
- No production source edits or speculative prototype work unless explicitly assigned.

### UX Designer
- Define how users discover and operate selection, layers, frames, animation, palette and project actions.
- Remove permanent disabled/irrelevant controls and hidden-gesture-only workflows.
- Specify keyboard, pointer, touch, focus, error and success feedback.
- Turn user complaints into observable acceptance criteria.
- No production source edits unless explicitly assigned.

### Competitor Analyst
- Compare a small relevant group of current pixel-art tools.
- Research real workflows for canvas sizing, zoom, toolbars, palettes, animation and workspace customization.
- Cite product, URL, access date and observed behavior.
- Recommend adopt/adapt/avoid and explain why. Avoid generic feature lists and feature copying.
- No production source edits.

### Coder 1 — Layout
- Own assigned editor layout/CSS and canvas presentation paths.
- Preserve square logical pixels, correct coordinate mapping, responsive layout and usable canvas area.
- Remove wasteful tool rail space and hide non-canvas scrollbar chrome without disabling scrolling.

### Coder 1 — Workspace
- Own assigned animation/timeline visibility, toolbar states, contextual selection actions and expandable palette behavior.
- Ensure every control performs a real action and states are accessible.
- Coordinate the `index.html` writer slot with Coder 1 — Layout; never edit it at the same time.

### Coder 2 — Safe editing
- Complete only the already-started UI-02 Clear change on the grandfathered branch.
- Preserve existing revision-aware storage and rollback contracts.
- Ensure UI/Agent API/bridge responses correctly await asynchronous safe-edit completion.
- Do not repurpose the grandfathered branch for later tasks.

### Coder 2 — Editing behavior
- Implement all-or-nothing paste and target-stable, staged image import.
- Handle asynchronous request ordering, validation, cancellation/cleanup and storage failure without partial mutation.
- Coordinate any shared `index.html` edits through the coordinator's serialized writer slot.

### Verifier — UI
- Independently inspect the actual changed UI and source.
- Check pixel geometry, responsive overflow, toolbar discoverability, timeline open/close, palette expansion, focus and accessibility.
- Report concrete defects and evidence; do not run tests during implementation.

### Verifier — safety
- Independently inspect safe-edit, paste, import and persistence paths.
- Check races, stale targets, transaction boundaries, failure rollback and false success.
- Report exact code paths and reproduction sequences; do not run tests during implementation.

### Coordinator
- Convert user feedback and design evidence into a small ordered product queue.
- Assign one writer per file and serialize changes to shared paths.
- Integrate directly into `main` under the zero-new-branch rule.
- Keep the single release-validation gate and verify deployment/live workflows before claiming completion.

## Working sequence

1. UI Designer + UX Designer + Competitor Analyst define and justify the product behavior.
2. Verifiers independently inspect the current baseline and grandfathered UI-02 change.
3. Coordinator resolves design choices and assigns exact acceptance criteria.
4. Coders implement one shared-file slice at a time in the order on `BOARD.md`.
5. Verifiers review each material diff without launching per-task tests.
6. Coordinator assembles the release and authorizes the single final validation.

Not every seat needs to be active at once. Do not manufacture work or run parallel edits on shared files.
