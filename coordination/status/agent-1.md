# Status — Agent 1

- **Task:** AC-025 — Audit remaining frame-aware QA coverage in PR #1
- **Status:** REVIEW
- **Coordination source:** `main`; PR #7 merged as `f0c470392fe4411ca79b1d17bfe72e928af3be00`.
- **Latest main audited:** `829a85925eff9cf3cbf1931b56e5819952805bcc`.
- **PR #1 / audit branch:** `agent/qa-release` at `ffd5b1bda4dd0879949098709cbbe18474205675`; PR #1 remains open/draft/unmerged and GitHub reports unmergeable. Diff changes only `agent-bridge/e2e-test.mjs` (+49/-4); compare to current main: 3 commits ahead, 85 behind, diverged.
- **PR #8 comparison:** `agent/bridge-hardening` at `9d21f0c9ca87cd0044de36c48a646e411482ed3e`; PR #8 remains open/draft/unmerged and GitHub reports unmergeable. Compare to current main: 22 ahead, 82 behind, diverged. Agent 4 remains the sole writer of `agent-bridge/e2e-test.mjs`.
- **AC-006 dependency:** PR #10 is merged as `57b4da3cf9be2a9a4b1c98fea942729e42314d54`; its recovery E2E is already present on main. Preserve it.

## Read-only audit findings

### Keep from PR #1
1. **Browser Agent API JSON import round-trip** — PR #1 lines 114–126 parse the exported JSON, change its name, call `onePixelStudio.import_project({ project })`, then assert imported project name, project ID and restored pixel. Main currently checks only `export_project()` JSON parsing and format at `agent-bridge/e2e-test.mjs` lines 111–113; no direct browser `import_project()` verification exists. PR #8's MCP test separately checks `artclub_export_project` JSON format and that `artclub_import_project` does not error (its branch's `agent-bridge/mcp-e2e-test.mjs` lines 522–532), but does not verify imported pixels or metadata and is not yet on main. Keep PR #1's direct browser-path assertion.
2. **Debounced autosave for animation cels** — PR #1 lines 237–245 waits for the normal `SAVED IN PROJECT LIBRARY` state after the frame/cel edits, instead of calling explicit `save()`. Current main calls explicit `save()` at line 222 before reload. Main's later AC-006 recovery test does exercise autosave for recovery snapshots, but that is a separate workflow and does not establish that the three-frame cel edits reached storage through autosave. Keep the autosave wait in the frame persistence scenario.
3. **Selected-frame and frame inventory persistence** — PR #1 lines 250–251 assert three frames remain and `active_frame.id === frameTwoId` after reload. Current main does not assert either; it switches to the original frame after reload to inspect two pixels.
4. **Per-frame cel persistence** — PR #1 lines 263–278 selects each owning frame and checks frame one's `#aa1100` pixel, frame two's `#00bb00` pixel and frame three's `#0000cc` pixel. Current main creates/plays three frames but does not verify these three cels after reload. Keep these assertions.

### Duplicate coverage to avoid carrying twice
- PR #1's original red pixel `(1,1)` and visible layer composite `(2,2)` checks at lines 256–262 are already covered by current main lines 231–239 after selecting the original frame. Keep one version only.
- PR #1's `firstFrameId` captured after reopening the saved project can replace the older `initialFrameId` captured at startup in main lines 63–64 and used at lines 231–233. Retain one canonical original-frame ID; capturing it from `reopenedStatus` is closest to the saved project being tested.
- Main's AC-006 recovery sequence at lines 241–307 covers A→autosaved B→open Project Library→Recover A and a later genuine edit/save/recovery. Keep this full sequence unchanged; PR #1 adds no necessary replacement for it.

### PR #8 frame-selection conflict
- PR #8 adds a pre-save reset to `reopenedStatus.active_frame.id` and an assertion of that same ID at its branch's `agent-bridge/e2e-test.mjs` lines 222–235, then saves/reloads and reads a pixel on that frame.
- This reset changes the test setup back to frame one before persistence. If retained, it prevents the E2E from checking whether the selected frame two survives reload, which is exactly what PR #1's line 251 tests.
- Recommendation: when rebasing/reconciling PR #8, Agent 4 should drop this pre-save reset/assertion, preserve frame two as the selected editing frame through autosave/reload, assert its ID after reload, and then explicitly select frames one/two/three only when reading their cel pixels. Do not remove the post-reload frame selections; those are correct because pixel reads are scoped to the active frame.

### Export/import gaps still visible on main
- PNG export is only checked for MIME type, width and PNG signature at main lines 106–109; no decode-and-raster/pixel/alpha verification exists in this E2E.
- Project JSON export is parsed and its `format` checked at main lines 111–113; browser Agent API import is not tested. PR #1's direct import assertions are the useful keep.
- PR #8's MCP export/import round trip is not on main and, as submitted, only checks exported JSON format and import success; consider a post-import readback assertion when Agent 4 integrates it.

## Recommended handoff sequence
1. Agent 4 rebases/reconciles PR #8 against latest main, preserving all AC-006 recovery assertions.
2. While Agent 4 owns the file, port the non-duplicative PR #1 coverage: browser import round-trip, autosave wait for frame edits, restored frame count/selected-frame assertion, and frame-one/two/three cel checks.
3. Drop the PR #8 pre-save frame reset. Keep only one original-frame ID and one set of original red/composite assertions.
4. Rerun `npm run test:e2e` and `npm run test:mcp` on the combined/reconciled PR #8 head; add decoded PNG raster tests separately if in scope/assigned.
5. Keep PR #1 unmerged as a stale overlapping source branch; coordinator decides whether to close it after Agent 4's integrated changes pass. Agent 1 did not edit PR #1, PR #8 or the shared E2E file.

- **Evidence links:** [Current main E2E](https://github.com/faiev/ArtClub/blob/829a85925eff9cf3cbf1931b56e5819952805bcc/agent-bridge/e2e-test.mjs); [PR #1 import/frame assertions](https://github.com/faiev/ArtClub/blob/ffd5b1bda4dd0879949098709cbbe18474205675/agent-bridge/e2e-test.mjs); [PR #8 frame reset](https://github.com/faiev/ArtClub/blob/9d21f0c9ca87cd0044de36c48a646e411482ed3e/agent-bridge/e2e-test.mjs); [PR #8 MCP export/import checks](https://github.com/faiev/ArtClub/blob/9d21f0c9ca87cd0044de36c48a646e411482ed3e/agent-bridge/mcp-e2e-test.mjs).
- **Tests:** None run. AC-025 is explicitly read-only; this audit compared the exact GitHub file contents and PR patches. Historical PR #1 CI evidence predates current main and is not a current-base validation.
- **Blockers:** None for the audit. Shared E2E changes are prohibited for Agent 1 and remain assigned solely to Agent 4.
- **Next:** Coordinator/Agent 4 to use this keep/drop map during PR #8 reconciliation; no code PR from Agent 1.
- **Last updated:** 2026-11-14 — AC-025 read-only audit completed against main `829a85925eff9cf3cbf1931b56e5819952805bcc`.
