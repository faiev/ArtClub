# Agent 5 — UX / product

## READY — AC-009: Turn the UX audit into an implementation-ready roadmap

The UX audit is already on main as `UX_AUDIT.md`. You do not need to wait for a review PR to begin planning from it.

### Branch
Use `agent/ux-implementation-plan`, created from current main commit `fe66725f7d010beca7ca60f497778d419e753d7b`. Do not edit `UX_AUDIT.md`.

### Work
Read the full `UX_AUDIT.md` and inspect source for the findings that matter most. Produce `UX_IMPLEMENTATION_PLAN.md`.

For the five highest-impact problems:
1. State the user problem and current reproduction/workflow.
2. Separate source-verified facts from assumptions requiring browser validation.
3. Define the exact target behavior and acceptance criteria.
4. Identify impacted files/modules and dependencies.
5. Specify unit/browser/accessibility tests.
6. Estimate scope as S/M/L and recommend order.
7. Call out conflicts with current agent file ownership.

Include a short phase plan: correctness/safety first, workflow usability second, optional polish last. Avoid vague recommendations such as "make it cleaner".

### Initial audit findings to investigate
The audit's executive summary flags: Clear/import interacting with hidden or locked layers; lack of canvas pan and usable large-canvas navigation; DOM-per-pixel rendering scale; missing game-ready animation delivery; and discoverability/feedback gaps. Validate these against the actual current code before turning them into tasks.

### File scope
Only `UX_IMPLEMENTATION_PLAN.md` and its tests/checklist if needed. Do not modify app source.

### Acceptance criteria
Five or more concrete implementation tasks, each with priority, acceptance criteria, dependencies, test plan, scope and file ownership. Mark any unverified behavior for live validation.

### Handoff
Commit to `agent/ux-implementation-plan`, open a draft PR and update only `coordination/status/agent-5.md`.
