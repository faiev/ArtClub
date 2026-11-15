# Art Club — role-based team model

## Team structure

The team has **10 agent sessions organized around seven functional roles**. A role can have more than one session, but each task has one accountable owner and explicit file boundaries. The previous numbered AC workstreams are retired.

| Function | Seats | Primary responsibility |
|---|---:|---|
| UI Designer | 1 | Visual direction, canvas-first layout, hierarchy, component and responsive design |
| UX Designer | 1 | User flows, discoverability, interaction logic, accessibility and usability |
| Competitor Analyst | 1 | Evidence-based research of competing pixel-art/design tools and actionable product opportunities |
| Coder 1 — Editor/UI | 2 | Production editor layout, canvas presentation, controls, interactions and responsive behavior |
| Coder 2 — Core/features | 2 | Application logic, state, persistence, import/export and reusable feature behavior |
| Verifier | 2 | Independent implementation review, regression-risk analysis, accessibility and release acceptance |
| Coordinator | 1 | Product priorities, task allocation, file ownership, integration, release and deployment |

The coordinator may rebalance the ten sessions between functions when the current release needs it. This does not create additional roles, branches or parallel writers.

## Role responsibilities and boundaries

### UI Designer
- Define the visual system, layout, density, sizing and responsive behavior.
- Resolve canvas prominence, pixel geometry, toolbar composition, palette presentation and workspace balance.
- Deliver specific screen/state guidance and review the actual implementation against it.
- Do not create endless decorative prototypes or claim that a design is implemented.

### UX Designer
- Define how users discover and operate tools, selections, layers, frames, animation and project actions.
- Remove unnecessary permanent controls and hidden gestures.
- Specify keyboard, pointer, touch, focus, feedback, error and accessibility behavior.
- Convert user complaints into clear, observable acceptance criteria.

### Competitor Analyst
- Research relevant competing pixel-art editors and creative tools.
- Compare actual workflows, canvas behavior, palette handling, timelines, toolbars, zoom and workspace customization.
- Cite product names, source URLs, dates and observed details.
- Recommend what Art Club should adopt, adapt or deliberately avoid. Do not copy competitors blindly or produce a generic feature dump.

### Coder 1 — Editor/UI
- Implement approved production UI, CSS, layout and input interactions.
- Preserve square logical pixels, accurate pointer mapping, responsive layout and usable canvas space.
- Wire controls to real behavior; do not add fake buttons, decorative placeholders or duplicate indicators.
- Coordinate with Coder 2 at module/API boundaries.

### Coder 2 — Core/features
- Implement approved application logic, state transitions, safe editing, storage, import/export and reusable feature behavior.
- Preserve data, history, immutability and failure semantics.
- Keep interfaces plain JavaScript and compatible with the existing local-first architecture.
- Do not build isolated modules unless the coordinator has identified a concrete production integration path.

### Verifier
- Independently inspect the exact changed code and user-visible workflow.
- Look for data loss, stale state, partial operations, race conditions, keyboard/focus failures, responsive breakage, accessibility regressions and false success messages.
- Separate verified facts from assumptions. State exact paths and reproduction conditions.
- Do not trigger tests during implementation. Participate in the one consolidated release validation gate when authorized.

### Coordinator
- Own the product roadmap, board, policy, decisions, task assignments and file-writer schedule.
- Translate user feedback and design/research findings into concrete implementation slices.
- Assign exact paths to coders; prevent overlapping writes; integrate changes to `main`.
- Keep the branch/PR restrictions and the single release gate intact.
- Publish only after the actual production build, deployment and live workflow are verified.

## Collaboration sequence

1. UX Designer and UI Designer turn the user need into an interaction and visual proposal.
2. Competitor Analyst supplies relevant evidence where comparison can change the decision.
3. Coordinator selects the product behavior and defines acceptance criteria and file ownership.
4. Coder 1 and Coder 2 implement disjoint slices; they coordinate before touching shared interfaces.
5. Verifiers review the actual change and report specific defects without starting separate test cycles.
6. Coordinator integrates, prepares the release candidate and authorizes the single final validation.

Not every task needs every role. Do not manufacture work to keep an agent busy. The coordinator may assign a small focused team and leave the other sessions paused.
