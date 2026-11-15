# Art Club — live product board

**Authority:** `main`  
**Last refreshed:** 2026-11-15  
**Team model:** `TEAM_MODEL.md`  
**Rules:** `ORCHESTRATION_POLICY.md`

## Live repository state

- Main baseline before the cleanup: `276e4f2ee9e70b483a5e0f0fbb8c68f8aa4bcee5`.
- Role-based coordination reset commit: `18d7876b54fcc24f679ccb9db52074bdf86b7d5f`.
- Open PRs: 0 at the last live check.
- Non-main branches: one existing grandfathered branch, `coordinator/ui-02-safe-edit-mainline`.
- New branch creation: prohibited permanently.
- The grandfathered branch contains the previously started UI-02 Clear implementation only. It is not a branch template and must not be reused for a later release.
- Do not inspect, revive, close, merge, restore or recreate old PRs or deleted branches unless the user explicitly requests it.
- The old numbered assignment/status files and AC workstream backlog have been retired. Their content remains in Git history, not as current instructions.

## Product objective

Build Art Club as a polished, practical pixel-art editor. The canvas must remain the center of the workspace. Every control must earn its space and every visible action must work.

## Current priority queue

### P0 — Canvas geometry and workspace integrity
- Canvas stays centered and usable on desktop; the editor must not arbitrarily shrink the canvas.
- Every logical pixel remains square at all supported canvas dimensions, viewport sizes and zoom levels.
- Pointer coordinates must continue to target the correct logical pixel after resize, zoom and device-pixel-ratio changes.
- Side panels must not distort the canvas or silently force rectangular pixel cells.

**Acceptance:** square pixel cells, correct edge-pixel input, stable responsive layout and no canvas clipping at common desktop sizes.

### P0 — Remove unnecessary workspace chrome
- The canvas is the only area allowed to display a visible scrollbar.
- Scrolling must remain functional wherever content overflows; hide scrollbar chrome in other panels and page regions.
- Do not disable overflow as a shortcut.

**Acceptance:** visible scrollbar only on the canvas viewport; wheel, touchpad, touch and keyboard scrolling still work in other regions.

### P0 — Make animation opt-in
- Timeline is hidden/collapsed by default and does not permanently reserve canvas height.
- Add a clear **Animate** action that opens the animation workspace.
- Closing the animation workspace returns the recovered space to the canvas.
- For a one-frame project, show a useful “add another frame” entry state rather than irrelevant disabled playback controls.

**Acceptance:** animation controls are absent until requested; opening/closing the workspace works and does not disrupt the drawing area.

### P0 — Simplify tool and selection controls
- Remove meaningless empty space in the left toolbar and use a compact, intentional hierarchy.
- Show the selected tool only once visually; keep its programmatic selected state accessible.
- Show selection actions only when they are relevant to the selected tool or an active selection.
- Move the full shortcut reference into a Help/keyboard surface.

**Acceptance:** no redundant tool labels, no permanently visible disabled selection controls, and essential commands remain discoverable.

### P1 — Expandable palette
- Provide an obvious way to expand/collapse the palette and access all colors.
- Expansion must not distort the canvas or create another always-visible scrollbar.
- Preserve current color selection and make palette controls keyboard/touch accessible.

### P1 — Safe editing completion
- Preserve the existing active-cel Clear safety work on the grandfathered branch until it has a final integration decision.
- Reject paste operations that would otherwise be clipped or partially applied.
- Stage image imports against the original project/layer/frame/revision and revalidate before commit.
- The latest selected image request must win; stale asynchronous decodes must never overwrite newer intent.
- Preserve project data and history on validation or storage failure.

### P1 — Correct keyboard and feedback behavior
- Do not steal native text-field undo or browser-reserved shortcuts.
- Respect inputs, selects, textareas, contenteditable, dialogs, IME composition and AltGraph.
- Use platform-appropriate Ctrl/Cmd labels and clear, truthful status/error messages.

### P2 — Workspace polish
- Distinguish Fit from true Actual Size (1:1) zoom.
- Keep zoom centered/anchored predictably.
- Expose accessible rename, visibility, lock and palette actions without relying only on double-click or right-click.
- Profile large canvases before changing the renderer architecture.

## Current assignment policy

The coordinator assigns one outcome and exact file scope at a time using the role model. No agent self-assigns. Shared files have one writer. Designers and analysts produce decision-ready findings; coders implement approved behavior; verifiers review the implementation. Work not explicitly assigned remains paused.

## Release status

The UX requirements above are priorities, not claims that they are implemented. No new release is declared here. Automated validation remains deferred until the coordinator declares the assembled `main` candidate ready and authorizes the single release gate.
