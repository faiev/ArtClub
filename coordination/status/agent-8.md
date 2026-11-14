# Status — Agent 8

- **Workstream:** Palette tooling, interoperability and color science
- **Status:** REVIEW — PR #16 sparse-entry fix and PR #78 resource-budget fix both passed latest-main exact-head CI
- **Coordinator source:** `main`
- **Current shared base for both active PRs:** `7d11357cb61c65026604ddd76cec240299ac2765`.
- **Active branch:** `agent/palette-formats` (PR #16); HEAD `8a0208a152c9963331b4335d2aaee728da86711d`.
- **Active PR:** [#16 — AC-017 palette formats](https://github.com/faiev/ArtClub/pull/16) (open draft; based on `7d11357cb61c65026604ddd76cec240299ac2765`; zero commits behind; exactly 3 palette-format files changed).
- **Exact-head CI:** [Run #661](https://github.com/faiev/ArtClub/actions/runs/43618468770) on `8a0208a152c9963331b4335d2aaee728da86711d` — 214 Node tests passed (0 failed), `node --check` passed, real Chromium editor E2E, animated GIF/ImageDecoder and MCP E2E passed. Both workflow jobs concluded success.
- **Secondary PR:** [#78 — AC-094 resource-bounded perceptual palette mapping](https://github.com/faiev/ArtClub/pull/78), draft; head `46487e8fc3e5241a01fcef1c807b3f1ae0696585`, based on the same main snapshot; [run #652](https://github.com/faiev/ArtClub/actions/runs/43618272887) passed 218 Node tests plus syntax, Chromium, GIF/ImageDecoder and MCP checks.
- **AC-017 files:** `js/palette-formats.js`, `tests/palette-formats.test.js`, `docs/palette-formats.md`.
- **AC-094 files:** `js/palette-distance.js`, `tests/palette-distance.test.js`, `docs/palette-distance.md` (three files only).

## Completed workstream ledger

| Phase | Deliverable | Branch head | PR | Exact-head CI evidence |
|---|---|---|---|---|
| AC-017 | GPL/JASC-PAL/JSON import/export; indexed rejection of sparse/undefined entries | `8a0208a152c9963331b4335d2aaee728da86711d` | [#16](https://github.com/faiev/ArtClub/pull/16) | [#661](https://github.com/faiev/ArtClub/actions/runs/43618468770): 214 Node passed; syntax, Chromium, GIF/ImageDecoder and MCP passed |
| AC-067 | Palette usage/coverage analysis | `4e4b78098633f9dec727d79c8824b2b9c0da5528` | [#27](https://github.com/faiev/ArtClub/pull/27) | [#412](https://github.com/faiev/ArtClub/actions/runs/43613562230): 94 Node passed; full browser/GIF/MCP workflow passed |
| AC-068 | HEX/RGB/HSL/HSV, WCAG contrast and ramps | `3fc332c61883d927bcc14bccecdbea02c2a1bd88` | [#33](https://github.com/faiev/ArtClub/pull/33) | [#414](https://github.com/faiev/ArtClub/actions/runs/43613572560): 86 Node passed; full browser/GIF/MCP workflow passed |
| AC-069 | Immutable palette transformations/harmonies | `3d05bc1e1d66db9b727b131be9916a8fb0ba7ff0` | [#39](https://github.com/faiev/ArtClub/pull/39) | [#417](https://github.com/faiev/ArtClub/actions/runs/43613595647): 93 Node passed; full browser/GIF/MCP workflow passed |
| AC-070 | Used-color extraction and project mapping | `36934295c63a74ce46180c6fd4d9a13268cabe61` | [#45](https://github.com/faiev/ArtClub/pull/45) | [#422](https://github.com/faiev/ArtClub/actions/runs/43613608452): 88 Node passed; full browser/GIF/MCP workflow passed |
| AC-071 | Contrast, CIE76 near-duplicate and color-vision diagnostics | `a458cc0047723cd02e6bc0acb1e6e5a73f87d0b4` | [#53](https://github.com/faiev/ArtClub/pull/53) | [#424](https://github.com/faiev/ArtClub/actions/runs/43613620007): 87 Node passed; full browser/GIF/MCP workflow passed |
| AC-072 | GPL/JASC-PAL/JSON fixtures and seeded corpus | `d518541bde3cff3f58afc1a5a73bb4f4734ef795` | [#56](https://github.com/faiev/ArtClub/pull/56) | [#433](https://github.com/faiev/ArtClub/actions/runs/43613693918): 102 Node passed; full browser/GIF/MCP workflow passed |
| AC-073 | Import preview, export-loss and project workflow contract | `52056108ebb45eb18b21468ed743a1272e392e61` | [#60](https://github.com/faiev/ArtClub/pull/60) | Documentation-only; no application test run applies |
| AC-094 | Opt-in CIEDE2000, CIE76 and resource-bounded palette mapping | `46487e8fc3e5241a01fcef1c807b3f1ae0696585` | [#78](https://github.com/faiev/ArtClub/pull/78) | [#652](https://github.com/faiev/ArtClub/actions/runs/43618272887): 218 Node passed; syntax, Chromium, GIF ImageDecoder and MCP passed |

PR #56 is intentionally stacked on PR #16 because its corpus tests use the unmerged palette-format module. Keep #56 dependent on #16; do not merge it independently.

## AC-017 sparse-entry review fix

- Replaced sparse-skipping `slice().forEach()` normalization with an indexed loop and own-slot checks.
- Sparse holes and explicit `undefined` entries are rejected before palette output is constructed, for both object input and the string-array shorthand.
- Regression tests cover sparse holes and explicit undefined in both input forms; duplicates and original order remain supported.
- Branch `agent/palette-formats` was synchronized with latest main using a non-force merge commit `8a0208a152c9963331b4335d2aaee728da86711d`; comparison reports zero commits behind and exactly the three AC-017 files.
- PR #56 remains stacked on PR #16's old parent head and must not be retargeted until PR #16 is accepted/merged.

## AC-094 implementation notes

- CIEDE2000 uses sRGB → XYZ → CIELAB with D65 reference white, the sRGB transfer function and double-precision calculations. Converted L* is bounded to [0, 100] to remove a few-millionths overshoot at white caused by rounded matrix coefficients; caller-supplied Lab L* is strictly validated.
- All 34 Sharma, Wu & Dalal (2005) published Lab reference pairs are embedded in `tests/palette-distance.test.js` and checked at four-decimal precision.
- Metrics: `rgb-squared` remains the default; `rgb-euclidean` remains an explicit legacy alias; `cie76` and `ciede2000` are opt-in.
- Tie resolution preserves original palette order and adds an `equal-distance-tie` diagnostic. Null/transparent targets return a structured non-match diagnostic; `mapToPalette` preserves null pixels and their positions.
- Mapping enforces a 4,194,304 hard comparison budget (pixels × palette size) before reading entries or allocating output arrays; callers may lower but not raise it.
- RGB channels and Lab palette coordinates are precomputed once per call; each source color is converted once before palette comparisons.
- Full mapped pixels are preserved while match detail capture is capped at 1,000 by default (maximum configurable 10,000) or disabled; aggregate diagnostics stay bounded.
- No existing AC-067/070 matching default or Agent 10 quantization behavior is changed.

## Focused test evidence and runtime

- Focused local Node v22.16.0 suites for AC-017–070 previously passed: 17, 24, 16, 23 and 18 tests respectively.
- AC-071/072/094 are validated through exact-head Node 24 CI; no separate local focused result is claimed for those phases.
- CI also runs `node --check agent-bridge/server.mjs`, Chromium editor E2E, animated GIF ImageDecoder full-raster verification and MCP E2E.
- Local Git clone was unavailable due GitHub DNS resolution; feature branches were updated through GitHub Git Data operations with non-force expected-head checks.

## Risks / boundaries

- JASC-PAL cannot preserve palette or color names; the loss is explicitly documented.
- AC-067/070 retain deterministic RGB nearest matching; AC-094 adds opt-in CIE76/CIEDE2000 without changing defaults.
- AC-068 interpolation is encoded sRGB; WCAG contrast is one accessibility signal, not a full UI accessibility guarantee.
- AC-071 CIE76 near-duplicate detection is heuristic; color-vision simulations are approximations, not medical tests.
- AC-072 PR #56 is stacked on PR #16; parent must be accepted/merged before retargeting.
- Original AC-094 PR #63 was closed as superseded by resource-bounded PR #78. Its branch was synchronized with latest main using non-force merge commit `46487e8fc3e5241a01fcef1c807b3f1ae0696585`; comparison reports zero commits behind and exactly the three AC-094 files. Exact-head run #652 passed.
- AC-073 is a workflow contract only. No palette editor controls, downloads or Agent API endpoints are implemented.
- No project/UI/Agent API integration is included. `index.html` and production UI wiring remain coordinator-controlled.
- Earlier phase PRs retain successful exact-head CI evidence above, but were last based on earlier main tips; compare/refresh them before merge as needed. The AC-094 branch is based on current main.

## Next queue

1. Coordinator review of fixed and latest-main-synchronized PR #16 after exact-head run #661; do not merge or self-accept.
2. Coordinator review of resource-bounded AC-094 PR #78 after exact-head run #652; do not merge or self-accept.
3. Keep PR #56 stacked until PR #16 is accepted/merged; only then retarget it onto the accepted parent and rerun exact-head CI.
4. Coordinator review of earlier palette PRs #27, #33, #39, #45, #53 and #60 individually; inspect their actual base/changed-file scopes before any retarget.
5. Do not start AC-022 palette controls or edit `index.html` without an explicit production UI lock.

- **Blockers:** No blocker for the isolated palette modules. Production palette UI integration is gated on coordinator authorization/lock.
- **Last updated:** 2026-11-14; both active feature branches validated against main `7d11357cb61c65026604ddd76cec240299ac2765`; PR #16 and PR #78 each retain their three-file assigned scope.
