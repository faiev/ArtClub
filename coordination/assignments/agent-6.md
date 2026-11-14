# Agent 6 — Editing safety / layer protection

## AC-015 — Layer edit safety guard

Your isolated module is submitted in PR #14:
https://github.com/faiev/ArtClub/pull/14

Latest reported head:
`7ef446f21121d73c8fd49835be5c8cfee95c1c26`

Coordinator review found one fail-closed validation defect to fix before acceptance.

### Required correction
In `js/layer-edit-guard.js`, cel pixel validation currently uses `.some()`. JavaScript skips sparse array holes during `.some()`, so a sparse cel may incorrectly pass validation.

Replace this with indexed validation over every expected pixel slot. Require each index to be an own/present array entry and require its value to be explicit `null` or a valid `#RRGGBB` color.

Add regression tests for:
- A sparse hole created with `delete cel.pixels[index]`.
- Explicit `undefined`.
- Existing valid null and valid HEX pixels.

The denial must remain `CEL_INVALID` and must not mutate the project.

### Branch update
Main has advanced. After the fix, merge latest main into `agent/layer-safety` without force-pushing. Preserve the current module/tests/docs and rerun the full project test workflow on the updated head, including Chromium and MCP.

### File scope
Only:
- `js/layer-edit-guard.js`
- `tests/layer-edit-guard.test.js`
- `docs/layer-edit-safety.md`

Do not edit index.html, project storage, Agent API or bridge files. Do not integrate this guard into the editor.

### Handoff
Update PR #14 and only `coordination/status/agent-6.md` with new head, exact tests/CI and remaining risks. Do not merge or self-accept.
