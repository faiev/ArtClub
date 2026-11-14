# Status — Agent 8

- **Workstream:** Palette tooling, interoperability and color science
- **Status:** REVIEW — AC-094 submitted; exact-head CI in progress
- **Coordinator source:** `main`
- **Latest main observed:** `2c84284ec0416348e8a0170eda8170a3d2279d85`
- **Active branch:** `agent/palette-distance`
- **Active HEAD:** `e38a12b9a5d160da1f7e6f93709592d9cbbe966d`
- **Active PR:** [#63 — AC-094 opt-in CIEDE2000 palette matching](https://github.com/faiev/ArtClub/pull/63) (open draft; 3 changed files; base main at `2c84284ec0416348e8a0170eda8170a3d2279d85`)
- **Exact-head CI:** Run [#482](https://github.com/faiev/ArtClub/actions/runs/43614579167) on `e38a12b9a5d160da1f7e6f93709592d9cbbe966d`: Node job passed 127/127 tests and server syntax; Chromium/editor + GIF + MCP browser job still in progress at this status write. Prior synchronized head `d758f9fac4feb9f0209b170065b8d8d22543d5f4` passed full CI run #468 (127 Node tests, server syntax, Chromium E2E, GIF ImageDecoder decode and MCP E2E).
- **AC-094 files:** `js/palette-distance.js`, `tests/palette-distance.test.js`, `docs/palette-distance.md`. Diff against main is exactly these three files.

## Completed workstream ledger

| Phase | Deliverable | Branch head | PR | Latest exact-head CI evidence |
|---|---|---|---|---|
| AC-017 | GPL/JASC-PAL/JSON import/export | `a0143623be4f6fdce0e6c22f56fc3b2d9697813b` | [#16](https://github.com/faiev/ArtClub/pull/16) | [#411](https://github.com/faiev/ArtClub/actions/runs/43613553405): 87 Node passed; server syntax, Chromium, GIF decode and MCP passed |
| AC-067 | Palette usage/coverage analysis | `4e4b78098633f9dec727d79c8824b2b9c0da5528` | [#27](https://github.com/faiev/ArtClub/pull/27) | [#412](https://github.com/faiev/ArtClub/actions/runs/43613562230): 94 Node passed; full browser/GIF/MCP workflow passed |
| AC-068 | HEX/RGB/HSL/HSV, WCAG contrast and ramps | `3fc332c61883d927bcc14bccecdbea02c2a1bd88` | [#33](https://github.com/faiev/ArtClub/pull/33) | [#414](https://github.com/faiev/ArtClub/actions/runs/43613572560): 86 Node passed; full browser/GIF/MCP workflow passed |
| AC-069 | Immutable palette transformations/harmonies | `3d05bc1e1d66db9b727b131be9916a8fb0ba7ff0` | [#39](https://github.com/faiev/ArtClub/pull/39) | [#417](https://github.com/faiev/ArtClub/actions/runs/43613595647): 93 Node passed; full browser/GIF/MCP workflow passed |
| AC-070 | Used-color extraction and project mapping | `36934295c63a74ce46180c6fd4d9a13268cabe61` | [#45](https://github.com/faiev/ArtClub/pull/45) | [#422](https://github.com/faiev/ArtClub/actions/runs/43613608452): 88 Node passed; full browser/GIF/MCP workflow passed |
| AC-071 | Contrast, CIE76 near-duplicate and color-vision diagnostics | `a458cc0047723cd02e6bc0acb1e6e5a73f87d0b4` | [#53](https://github.com/faiev/ArtClub/pull/53) | [#424](https://github.com/faiev/ArtClub/actions/runs/43613620007): 87 Node passed; full browser/GIF/MCP workflow passed |
| AC-072 | GPL/JASC-PAL/JSON fixtures and seeded corpus | `d518541bde3cff3f58afc1a5a73bb4f4734ef795` | [#56](https://github.com/faiev/ArtClub/pull/56) | [#433](https://github.com/faiev/ArtClub/actions/runs/43613693918): 102 Node passed; full browser/GIF/MCP workflow passed |
| AC-073 | Import preview, export-loss and project workflow contract | `52056108ebb45eb18b21468ed743a1272e392e61` | [#60](https://github.com/faiev/ArtClub/pull/60) | Documentation-only; no app test run applies |
| AC-094 | Opt-in CIEDE2000, CIE76 and selectable nearest-color metrics | `e38a12b9a5d160da1f7e6f93709592d9cbbe966d` | [#63](https://github.com/faiev/ArtClub/pull/63) | [#482](https://github.com/faiev/ArtClub/actions/runs/43614579167): Node 127 passed; browser/GIF/MCP still running at status write |

PR #56 is intentionally stacked on PR #16 because its corpus tests import the unmerged palette-format module. Keep #56 dependent on #16; do not merge the corpus independently.

## AC-094 implementation notes

- CIEDE2000 uses sRGB → XYZ → CIELAB with D65 reference white, the sRGB transfer function and double-precision calculations. Converted L* is bounded to [0, 100] to remove a few-millionths overshoot at white caused by rounded matrix coefficients; input Lab L* is strictly validated.
- All 34 Sharma, Wu & Dalal (2005) published Lab reference pairs are embedded in `tests/palette-distance.test.js` and checked at their published four-decimal precision.
- Metrics: `rgb-squared` remains the default; `rgb-euclidean` remains an explicit legacy alias; `cie76` and `ciede2000` are opt-in.
- Tie resolution preserves original palette order and adds an `equal-distance-tie` diagnostic. Null/transparent targets return a structured non-match diagnostic; `mapToPalette` preserves null pixels and their positions.
- No existing AC-067/070 matching default or Agent 10 quantization behavior is changed.
- Initial AC-094 CI #396 failed three cases: a kL test used a pair with zero lightness difference, and converted sRGB white slightly exceeded L*=100 in two white-containing selection tests. These were fixed. Full CI #468 then passed; #482 is the post-main-sync verification.

## Focused test evidence and runtime

- Focused local Node v22.16.0 suites for AC-017–070 previously passed: 17, 24, 16, 23 and 18 tests respectively.
- AC-071/072 and AC-094 are validated via exact-head Node 24 CI; no separate local focused result is claimed for those phases.
- CI workflow also runs `node --check agent-bridge/server.mjs`, Chromium editor E2E, animated GIF ImageDecoder full-raster verification and MCP E2E.
- Local Git clone was unavailable due GitHub DNS resolution; feature branches were updated through GitHub Git Data operations with non-force expected-head checks.

## Risks / boundaries

- JASC-PAL cannot preserve palette or color names; the loss is explicitly documented.
- AC-067/070 retain deterministic RGB nearest matching; AC-094 adds opt-in CIE76/CIEDE2000 without changing defaults.
- AC-068 interpolation is encoded sRGB; WCAG contrast is one accessibility signal, not a full UI accessibility guarantee.
- AC-071 CIE76 near-duplicate detection is heuristic; color-vision simulations are approximations, not medical tests.
- No palette controls, file picker/download flow, project-model changes or Agent API integration are implemented. AC-073 is a contract only.
- `index.html` and production UI wiring remain coordinator-controlled. No UI integration lock has been issued to Agent 8.
- The older phase PRs #16/#27/#33/#39/#45/#53/#56/#60 retain their recorded exact-head CI evidence but are behind later main updates; compare/refresh and rerun before merge as required. PR #56 remains stacked on #16.

## Next queue

1. Record the final conclusion of exact-head AC-094 run #482 after its browser/GIF/MCP job completes.
2. Keep PR #56 stacked until PR #16 is reviewed/merged; retarget #56 to main only after its parent is accepted.
3. Coordinator review of PRs #16, #27, #33, #39, #45, #53, #56, #60 and #63; do not merge or self-accept.
4. Do not start AC-022 palette controls or edit `index.html` until the coordinator provides an explicit production UI lock and ownership boundary.

- **Blockers:** No blocker for isolated palette modules. Production palette UI integration is gated on coordinator authorization/lock.
- **Last updated:** 2026-11-14; reconciled to main `2c84284ec0416348e8a0170eda8170a3d2279d85`.
