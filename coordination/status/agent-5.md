# Status — Agent 5

## Active workstream — UX / accessibility / interaction design

### Phase 2 — AC-050: Layer, frame and timeline workflow specification

- **Status:** IN_PROGRESS
- **Branch:** `agent/layer-timeline-spec` (create from latest main after this status commit)
- **Allowed deliverable:** `docs/ux/LAYER_TIMELINE_SPEC.md`
- **Scope:** Documentation/specification only. Do not edit `index.html`, app JS, CSS, existing tests, bridge, exporter modules or workflow. No UI lock is granted.
- **AC-049 completed:** `docs/ux/CANVAS_WORKSPACE_SPEC.md` (359 additions) submitted in [PR #24](https://github.com/faiev/ArtClub/pull/24), open/draft/unmerged. PR head `2cde5e9bc8ad4ad3b25bd79b939880b2b43d6502`; one changed file. It may need latest-main refresh because main advanced after PR creation; no review/merge dependency for AC-050.
- **Source inspection:** v2 project model stores ordered `layers[]`, ordered `frames[]`, and `cels[]` keyed by `layerId`/`frameId`; each layer has name/visible/locked/opacity and each frame has name/durationMs. Current UI has a separate layer list and frame-card strip. Frame cards have names/duration/reorder but no thumbnails or layer×frame cel grid. Layer controls expose select/rename/visibility/lock/reorder, but no opacity slider. The model stores opacity, but current `getCompositePixels()` checks visibility and opaque pixels without applying layer opacity.
- **Safety dependency:** Agent 6's AC-055 contract rejects hidden, locked, zero-opacity, non-active or stale targets and rejects missing/invalid cels. AC-056 safe-edit transactions and later audit are in Agent 6's authorized queue. AC-050 will distinguish structural blank-cel creation from pixel mutation and require fail-closed edits.
- **Export dependency:** Agent 3's AC-039 layout/metadata contract and AC-040 export planner retain stable frame IDs, durations and explicit selected frame order. The timeline's order and timing must be the export source of truth; this spec will not edit exporter files.
- **Next queue:** (1) finish AC-050 layer/frame/cel/timeline spec; (2) AC-051 palette/export journeys; (3) AC-052 accessibility audit; (4) AC-053 static interaction prototypes; (5) AC-054 integrated UX implementation sequence.
- **Tests:** No application tests run; this is documentation-only. Validate source claims and the required workflow/acceptance matrix before submission.
- **Blockers:** None for documentation. Production UI and shared editor integration remain coordinator-controlled.
- **Last updated:** 2026-11-14.

## Previous task — AC-009

- **Deliverable:** `UX_IMPLEMENTATION_PLAN.md`, PR #9.
- **Outcome:** Coordinator board records `REVIEW_ACCEPTED`; eight UX tasks were specified. No implementation work was self-assigned.
- **Previous coordinator integration report:** See the historical handoff below.

## Coordinator-directed integration review — 2026-11-14

- **Review scope:** PR #3 sprite-sheet exporter, #6 Canvas renderer, #8 Agent API/MCP, #10 recovery fix, #11 GIF exporter; compared against `UX_IMPLEMENTATION_PLAN.md` on `agent/ux-implementation-plan`.
- **AC-009 verification:** PR #9 remains open, draft, unmerged and GitHub reports mergeable. Head `17e258a44a257d89556a80fb7977ef32a36d50ba`; one commit ahead of `main`; adds only `UX_IMPLEMENTATION_PLAN.md` (647 lines, eight UX tasks). No application test is expected for this docs-only PR.
- **PR #10:** Open/draft/mergeable, 8 ahead/0 behind. CI run #108 fully passed: 36 Node tests, real Chromium/IndexedDB recovery E2E and MCP E2E. No-op saves preserve the recovery slot. Recommended first merge after coordinator review.
- **PR #8:** Open/draft/mergeable, 22 ahead/0 behind. CI run #104 fully passed (unit/editor tests, Chromium E2E and MCP client E2E). Adds required MCP `expected_revision`, serialized per-process operations, structured envelopes/errors and reconnect handling. Risks: no operation timeout/cancellation, no cross-process lock, and forced-crash reconnect is not E2E tested.
- **Shared E2E collision:** PR #8 and PR #10 both modify `agent-bridge/e2e-test.mjs` around the reload/persistence test. Board ownership is ambiguous because Agent 1 explicitly owns this file while Agent 4's broad `agent-bridge/*` scope includes it. Merge/update these changes serially; keep one owner for this file and rerun full CI on the combined result.
- **PR #3:** Open/draft/mergeable but 3 commits ahead and 3 behind `main` (merge base `c7ff0702c27cba22e443f9012fc482c217363613`). Isolated sprite-sheet module and 10/10 local Node tests; CI run #96 Node job passed but browser E2E failed at the old persistence assertion (`null !== #ff0000`). PNG encoding is tested with a canvas double, not a real-browser decoded export. Refresh against main and add/obtain real-browser PNG pixel + metadata verification before UX-05 integration.
- **PR #11:** Open/draft/mergeable, 6 ahead/0 behind. CI run #107 Node job passed; new GIF ImageDecoder browser step passed (two frames, expected pixels and transparent alpha), while the aggregate browser job failed earlier at the same old persistence assertion and skipped MCP. The module has 10/10 local tests and independent FFmpeg/ImageMagick decode evidence. Rerun full CI after PR #10's fix is on the base.
- **PR #6:** Open/draft/mergeable, 10 ahead/0 behind. CI run #101 renderer/unit job passed (52 total, including 17 renderer tests); browser E2E failed at the same old persistence assertion. Canvas tests use fake contexts; browser benchmark timings remain unmeasured. Keep it isolated/fallback-only until real-browser pixel parity, overlays, pointer mapping, accessibility and benchmark evidence exist.
- **Roadmap readiness:** UX-01 can start with isolated tests/spec work; actual Clear UI waits for the `index.html` slot and safe layer-target contract. UX-02 can prepare pure conversion helpers/tests independently, but UI integration follows UX-01 rules and the same UI slot. UX-05 module review/test work can proceed, but UI integration requires accepted/current PR #3 and accepted PR #11. UX-07 content can be drafted after AC-004 acceptance; the visible entry waits for Agent 4's handoff. UX-03 integration waits for AC-010 browser evidence; UX-04 waits for a stable renderer/coordinate contract; UX-06 waits for stable timeline/rendering ownership; UX-08 stays last.
- **UI integration ownership:** `index.html` is a single-writer file; Agent 4 currently owns bridge-related edits. Recommend one coordinator-appointed UI integrator for UX-01/02/03/04/05/06/07/08, with serialized commits and specialist reviews. Avoid adding integration assertions to Agent 1's E2E file until its owner releases it; prefer new focused test files.
- **Recommended order:** (1) review/merge PR #10; (2) reconcile the shared E2E edits and update/retest PR #8; (3) refresh PR #3 and add real-browser PNG verification; (4) rerun/review PR #11 after the persistence fix; (5) complete PR #6 browser correctness and benchmark evidence before deciding on renderer integration; (6) schedule UI slices in roadmap order: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08.
- **Most visible wins:** safe Clear/import (prevents destructive edits), then pan/zoom and usable animation export. The five implementation PRs do not yet expose new editor UI controls; PR #10 is an immediate Project Library reliability improvement, and PR #8 improves agent-write safety rather than ordinary editor discoverability.
- **No changes made:** No app source, another agent's files, assignments, board or backlog changed. No implementation work self-assigned.
