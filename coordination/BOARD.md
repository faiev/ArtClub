# Art Club — live product board

**Authority:** `main`  
**Last refreshed:** 2026-11-16  
**Team model:** `TEAM_MODEL.md`  
**Rules:** `ORCHESTRATION_POLICY.md`

## Live repository state

- Current `main` HEAD: `85983719da0edeffa6cb2837f9933e0a73c70198`.
- No PRs were created during this implementation; the last recorded open-PR count was 0.
- Non-main branches: one existing grandfathered branch, `coordinator/ui-02-safe-edit-mainline`.
- New branch creation: permanently prohibited.
- The grandfathered branch `coordinator/ui-02-safe-edit-mainline` (head `69b18987a207999ba11e8b49a47cde2f0294f55d`) is now historical after the Clear slice was ported to `main`. Do not reuse, delete, force-update or rewrite it.
- Do not act on historical PRs or deleted branches unless the user explicitly requests it.

## Product objective

Build Art Club as a polished, practical pixel-art editor. The canvas is the center of the workspace. Keep its logical pixels square, preserve accurate input, remove meaningless permanent controls and make every visible action useful.

## Next execution plan

This is the active role-based plan. It replaces the former numbered-agent and AC workstream queues. All sessions must read `TEAM_MODEL.md`, `ORCHESTRATION_POLICY.md`, this board and `DECISIONS.md` before acting. The coordinator is the only person who changes this board or grants file ownership.

### Parallel discovery — start immediately

| Seat | Assignment | Output / boundary |
|---|---|---|
| UI Designer | Produce one concrete canvas-first desktop layout proposal. Resolve canvas width/height constraints, side-panel proportions, compact tool hierarchy, palette placement/expansion and responsive breakpoints. Explicitly preserve square logical pixels and prevent canvas shrinkage. | Return concise annotated dimensions/layout and the trade-offs. No production files, no prototype project. |
| UX Designer | Specify the interaction model for the Animate workspace, contextual selection actions, single selected-tool indicator, expandable palette and keyboard/help surface. Include empty, active, disabled and error states plus keyboard/focus behavior. | Return interaction rules and observable acceptance criteria. No production files. |
| Competitor Analyst | Compare a small, relevant set of pixel-art editors on canvas sizing/zoom, tool organization, palette expansion, animation timeline and workspace visibility. Research actual current behavior, cite source URLs and access dates, and report only patterns that solve an identified Art Club problem. | Decision-ready comparison: adopt/adapt/avoid. No generic feature catalog and no production files. |
| Verifier — UI | Inspect current `main/index.html` for canvas shrink/square-cell/pointer-coordinate risks, nested scrollbars, toolbar duplication and permanent timeline space. | Source-only findings with exact selectors/lines and concrete acceptance checks. Do not edit or run tests. |
| Verifier — safety | Review only the current grandfathered UI-02 branch against current `main`: Clear transaction, context invalidation, storage conflict/rollback handling and Agent API/bridge return semantics. Check for asynchronous false-success/stale-response behavior. | Source-only findings tied to the exact branch SHA. Do not modify code or run tests. Do not re-review old PRs. |

These five discovery tasks may run concurrently because they do not write production files or each other's files. The coordinator combines the results once and makes the product decisions.

### Implementation — serialized single-writer queue

Only the named coder may write the listed file during that step. The next coder waits until the owner hands off the exact commit and the coordinator releases the file.

### Integration and implementation status — 2026-11-16

The coordinator completed the serialized implementation queue directly on `main`, without creating a branch or PR.

| Step | Result | Main commit |
|---|---|---|
| Step 0 — Safe Clear | Integrated the active-cel/selection transaction, storage rollback, async Agent API response and pending-input guard. The grandfathered branch remains unchanged. | `a8bdcbf` |
| Step 1 — Canvas/layout | Compact responsive side columns, canvas-first sizing, common square logical cell size fitted against both viewport axes, resize observation and hidden non-canvas scrollbar chrome. | `35a74cd` |
| Step 2 — Workspace | Timeline is opt-in through Animate, one-frame entry state, contextual selection controls, one selected-tool indicator, collapsible palette and Help shortcut dialog. | `35a74cd` |
| Step 3 — Editing behavior | Paste is all-or-nothing and transaction-backed; image import uses captured project/layer/frame/dimensions/palette, latest-request-wins identity, context revalidation and guaranteed object-URL cleanup; keyboard handling preserves native text/browser commands. | `cd8af12` |

A follow-up integrity fix cancels a queued autosave before a safe edit begins, avoiding a delayed save racing the explicit transaction: `8598371`.

**Verification performed:** source-level integration review only. Confirmed unique DOM IDs, no missing JavaScript ID lookups, Promise propagation through the Agent API adapter, expected helper modules present on `main`, and wiring for Animate, palette, selection, paste, import and keyboard behavior. No automated tests or manual browser session have been run. Do not describe the changes as tested or release-verified.

The Pages build/deployment workflow for current `main` (`00aa6a5`) completed successfully (run `43844790807`). The consolidated project-test workflow is configured as manual `workflow_dispatch`; it has not run against this candidate. The available GitHub integration exposes workflow reads but no dispatch action, so the release test gate still needs to be started from GitHub Actions → **Project model tests** → **Run workflow** on `main`. No automated tests or manual browser smoke test were run here. The grandfathered branch is no longer an active work surface.

**Step 0 — Coder 2 / safe editing: COMPLETE on `main` (`a8bdcbf`)**

- Work only on the grandfathered `coordinator/ui-02-safe-edit-mainline` branch.
- Finish active-cel and selection Clear integration. Verify that the UI and Agent API/bridge do not report success or return stale status before the asynchronous safe-edit commit completes.
- Preserve the revision-aware `project-storage.js` contract already present; do not replace it with a second storage mechanism.
- Do not add paste or import work to this branch.
- Hand off the exact branch head, changed paths and remaining limitations to the coordinator. No tests during implementation.

**Step 1 — Coder 1 / editor layout: COMPLETE on `main` (`35a74cd`)**

- After Step 0 is integrated, take the sole `index.html` writer slot on `main`.
- Fix the desktop canvas shrink and logical pixel aspect ratio. Ensure a logical pixel remains square at supported canvas dimensions, viewport sizes and zoom levels.
- Prevent tool/inspector panel widths from squeezing the drawable canvas below a usable minimum. Use responsive collapse/reflow rather than distorting the grid.
- Hide all scrollbar chrome outside the canvas viewport while preserving scrolling in every region that needs it.
- Remove wasteful empty space in the left rail and align the layout with the approved UI Designer proposal.
- Hand off the exact commit and visual/source reasoning; do not start the timeline task until the coordinator releases `index.html`.

**Step 2 — Coder 1 / controls and workspace: COMPLETE on `main` (`35a74cd`)**

- Take the `index.html` writer slot only after Step 1 is handed off.
- Hide/collapse the timeline by default. Add an obvious Animate action that opens/closes the animation workspace and returns its height to the canvas when closed.
- At one frame, present a useful add-frame entry state instead of permanent disabled playback/onion controls.
- Show the selected tool only once visually, with a proper accessible selected state.
- Show selection actions only when the Select tool or a real selection makes them relevant. Move the complete shortcut reference into a Help/keyboard surface.
- Add an expandable/collapsible palette without shrinking the canvas or introducing another always-visible scrollbar.
- Hand off the exact commit and interaction states; wait for the coordinator before the next shared-file owner.

**Step 3 — Coder 2 / editing behavior: COMPLETE on `main` (`cd8af12`)**

- Take the `index.html` writer slot after Step 2, unless the coordinator explicitly schedules a different non-overlapping path.
- Reject any paste that cannot fit in full. No clipping, partial pixels, history entries or false success messages.
- Stage image decoding against the original project/layer/frame/dimensions/revision. Revalidate immediately before commit.
- Use a monotonically increasing import request identity so the most recently selected image wins regardless of decode completion order.
- Guarantee object-URL cleanup on every terminal path and preserve artwork/history/storage on failure.
- Keep keyboard shortcut handling out of inputs, textareas, selects, contenteditable elements, dialogs, IME composition and AltGraph. Do not intercept browser-reserved Save Page or native text undo.
- Hand off exact changed paths/commit and unresolved limitations.

No two implementation steps may write `index.html` simultaneously. If an implementation needs another file, the coordinator must explicitly assign that path before it is changed.

## Verifier handoff sequence

- UI Verifier reviews Step 0 for visible Clear scope and interaction truthfulness, then Step 1/2 for geometry, pixel squareness, scroll behavior, timeline visibility, toolbar clarity and palette expansion.
- Safety Verifier reviews Step 0 transaction/bridge behavior, then Step 3 paste/import atomicity and failure behavior.
- Verifiers report source evidence and specific defects only. Do not run test suites during implementation. The single final release validation remains deferred until the release candidate is assembled.

## Coordinator responsibilities

1. Collect the five parallel discovery deliverables and resolve any design/UX/competitor disagreement.
2. Own the single-writer queue and release `index.html` between implementation steps.
3. Integrate Step 0 from the grandfathered branch into `main` only after the source review. Keep the existing branch afterward as historical; do not delete or reuse it.
4. Keep all subsequent work directly on `main`; create no branches or PRs.
5. Assemble all approved work, freeze implementation, and authorize the one consolidated release-validation workflow.
6. If validation passes, deploy and verify the live editor before calling the work shipped.

## Acceptance priorities

### P0 — canvas integrity
- Canvas remains large and centered on desktop.
- Logical pixel cells are square, including non-square canvas dimensions.
- Pointer input hits the intended first/last cells after resize and zoom.
- No accidental clipping or inaccessible controls at common desktop sizes.

### P0 — usable workspace
- The canvas is the only visible-scrollbar exception; all other scrolling still works.
- Timeline is opt-in through Animate and does not reserve space by default.
- The toolbar is compact; the active tool is not repeated in three places.
- Selection commands are contextual rather than permanently occupying the left rail.

### P1 — palette and safe editing
- Palette can expand/collapse without distorting the canvas.
- Clear affects only the active cel and communicates that accurately.
- Paste is all-or-nothing.
- Image import is bound to its original target and newest request.
- Failed edits leave artwork, history and persistence unchanged.

### P1 — keyboard and accessibility
- Browser and native editing shortcuts are preserved.
- Tool, layer, frame and palette states are programmatically exposed.
- Important actions do not depend only on hover, double-click or right-click.

### P2 — polish
- Fit and Actual Size (1:1) are distinct and correctly named.
- Zoom anchoring is predictable.
- Large-canvas performance is measured only when a release decision needs it.

## Release status

Steps 0–3 are implemented on `main` as listed above. Source review is complete; automated validation and manual browser verification remain outstanding. No new release is declared. Run the single consolidated release gate only after the candidate is frozen and the coordinator authorizes it.
