# Status — Agent 6: Editing safety

- **Overall state:** IN_PROGRESS
- **Current phase:** AC-092 — seeded adversarial/property-style safe-edit conformance
- **Current branch:** `agent/safe-edit-conformance`
- **Current head:** `166f77ee8ff31d40a39b6423b2ef785f77338bef`
- **Stacked parent:** AC-060 / `agent/safe-edit-integration-contract` at `2e7a19ce843a3c659206c1bcb82825ded08a606a`
- **PR:** [#62](https://github.com/faiev/ArtClub/pull/62) — draft
- **Coordination source:** `main` at `05bfd94345b603b439f026d8e605f7874cbfb4fc`
- **Assignment confirmation:** latest Agent 6 assignment on this main head includes AC-092.

## Delivered phases and evidence

| Phase | PR | Deliverable | Last verified CI evidence |
|---|---|---|---|
| AC-015 | [#14](https://github.com/faiev/ArtClub/pull/14) | Sparse-safe layer/cel edit guard | 84 Node tests; Chromium editor E2E and MCP passed on a preceding synchronized head |
| AC-055 | [#23](https://github.com/faiev/ArtClub/pull/23) | Opacity, metadata, selection and revision checks | 96 Node tests; Chromium editor E2E and MCP passed on a preceding synchronized head |
| AC-056 | [#26](https://github.com/faiev/ArtClub/pull/26) | Immutable clear/patch/replace transaction helpers | 109 Node tests; Chromium editor E2E and MCP passed on a preceding synchronized head |
| AC-057 | [#29](https://github.com/faiev/ArtClub/pull/29) | Read-only editor mutation-path audit | Documentation-only; no application tests claimed |
| AC-058 | [#40](https://github.com/faiev/ArtClub/pull/40) | Dedicated safety browser denial harness | 113 Node tests; standard Chromium editor E2E and MCP passed. **Dedicated harness page itself has not yet been run** |
| AC-059 | [#48](https://github.com/faiev/ArtClub/pull/48) | Project/image import staging | 127 Node tests; Chromium editor E2E and MCP passed on a preceding synchronized head |
| AC-060 | [#49](https://github.com/faiev/ArtClub/pull/49) | Safe-edit integration/ownership contract | Documentation-only; no application integration claimed |

The dependent branches were synchronized with the updated parent chain using non-force, two-parent merge commits. These historical CI counts apply to the exact previous heads tested; rerun after any subsequent branch/base updates before merge.

## AC-092 implementation in progress

Files added:
- `tests/safe-edit-conformance.test.js`
- `docs/SAFE_EDIT_CONFORMANCE.md`

The suite uses five fixed 32-bit seeds, bounded 1–8 px canvases, 2–3 layers and frames, and 16 iterations per seeded property. It covers guard accept/deny behavior, structural/pixel/raster immutability, detached transaction outputs, preservation of unrelated cels, deterministic outputs, stage-import → guard → edit sequences, selection clear → patch, replacement → stale follow-up, image RGBA staging and invalid import candidates.

`SAFE_EDIT_SEED=<unsigned-32-bit>` selects a reproducible seed. Assertion messages include the seed, iteration, operation and a compact minimal-case descriptor. No dependency was added.

## Current CI status

- Latest run: [395](https://github.com/faiev/ArtClub/actions/runs/43612771352) — completed / failure on head `166f77ee8ff31d40a39b6423b2ef785f77338bef`.
- Local execution of AC-092 focused tests is still to be recorded; do not infer a pass until the Node command result is available.

## Known blockers / risks

- AC-058's custom `node tests/layer-safety.browser.mjs` page is not invoked by the current shared workflow. The local Chromium executable hung even on a minimal headless page. The standard Chromium editor E2E passing is not evidence that this dedicated harness ran.
- Do not edit `.github/workflows/project-tests.yml`; Agent 3 owns that workflow lock during exporter verification.
- No shared UI/API/storage integration is authorized. `index.html` remains coordinator-controlled; Agent 4 owns Agent API/bridge files.
- AC-015–060 remain isolated modules/contracts; toolbar Clear and image import are not yet wired to them in the live editor.

## Ranked next actions

1. Run `node --check tests/safe-edit-conformance.test.js` and `node --test tests/safe-edit-conformance.test.js`; fix any property failures and capture exact totals.
2. Run the same focused suite with a selected `SAFE_EDIT_SEED` to verify deterministic replay.
3. Verify full PR CI (Node, Chromium and MCP) on the exact AC-092 head; update the draft PR with evidence and mark reviewable only after results pass.
4. Complete AC-058's dedicated browser-page execution when a working Chromium runtime or authorized workflow step is available; do not claim it from the standard editor E2E.
5. Keep all integration work queued until the coordinator grants the relevant shared-file locks.

- **Last updated:** 2026-11-14.
