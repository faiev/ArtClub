# Status — Agent 8

- **Workstream:** Palette formats, interoperability, analysis and color science
- **Coordination source:** `main`
- **Latest main observed / feature-branch sync base:** `0c525c763731d044bd700f3920e95943e35c543e`
- **Status:** AC-017 and AC-094 are merged. AC-067–AC-072 are submitted in open PRs and have been refreshed to the current main snapshot with exact-head CI passing. AC-073 remains a documentation-only draft PR.
- **Ownership:** Only palette modules/tests/fixtures/docs listed in `coordination/assignments/agent-8.md`. No production UI, `index.html`, project model, exporter, Agent API or bridge changes.

## Current PR ledger

| Phase | PR | Branch / current head | Current state | Exact-head validation |
|---|---|---|---|---|
| AC-017 — palette formats | [#16](https://github.com/faiev/ArtClub/pull/16) | `agent/palette-formats` / `8a0208a152c9963331b4335d2aaee728da86711d` | **Merged** as `4198b1e095ad48df59763e7a39853d277f0b0bda` | Run [#661](https://github.com/faiev/ArtClub/actions/runs/43618468770): 214 Node tests; syntax, Chromium editor E2E, GIF/ImageDecoder and MCP passed |
| AC-067 — palette analysis | [#27](https://github.com/faiev/ArtClub/pull/27) | `agent/palette-tools` / `844bf1af692db2679197fbd74a142a058927e383` | Open; refreshed non-force from main | Run [#43629401639](https://github.com/faiev/ArtClub/actions/runs/43629401639): test and browser-e2e jobs passed |
| AC-068 — color conversion / ramps | [#33](https://github.com/faiev/ArtClub/pull/33) | `agent/palette-color-science` / `eb648cc90fab78062a149ab50ce98f4d3285127d` | Open; refreshed non-force from main | Run [#43629434541](https://github.com/faiev/ArtClub/actions/runs/43629434541): test and browser-e2e jobs passed |
| AC-069 — palette transformations | [#39](https://github.com/faiev/ArtClub/pull/39) | `agent/palette-transformations` / `22b47e3067be37bcb61ab2ab2a7d4e2311639eab` | Open; refreshed non-force from main | Run [#43629441719](https://github.com/faiev/ArtClub/actions/runs/43629441719): test and browser-e2e jobs passed |
| AC-070 — extraction / mapping | [#45](https://github.com/faiev/ArtClub/pull/45) | `agent/palette-mapping` / `fea53df850ee9262b88a9d73f8ae5491d8cbbf82` | Open; refreshed non-force from main | Run [#43629466913](https://github.com/faiev/ArtClub/actions/runs/43629466913): test and browser-e2e jobs passed |
| AC-071 — accessibility diagnostics | [#53](https://github.com/faiev/ArtClub/pull/53) | `agent/palette-accessibility` / `a06361fe5b4f2b324e1b99c5250b689c7c79508f` | Open; refreshed non-force from main | Run [#43629473248](https://github.com/faiev/ArtClub/actions/runs/43629473248): test and browser-e2e jobs passed |
| AC-072 — interoperability corpus | [#56](https://github.com/faiev/ArtClub/pull/56) | `agent/palette-corpus` / `c4474f7b249e7f5402aad433cc66e5b48b4985ca` | Open; refreshed; no longer depends on unmerged #16 because #16 is merged | Run [#43629507422](https://github.com/faiev/ArtClub/actions/runs/43629507422): completed success; test and browser-e2e jobs passed |
| AC-073 — workflow contract | [#60](https://github.com/faiev/ArtClub/pull/60) | `agent/palette-workflow-contract` / `76dfb5ac9a7d9374394be57da377197c45d16b12` | Open draft; documentation-only | No code CI expected; exactly `docs/PALETTE_WORKFLOW.md` |
| AC-094 — perceptual palette distance | [#78](https://github.com/faiev/ArtClub/pull/78) | `agent/palette-distance-bounded-v2` / `46487e8fc3e5241a01fcef1c807b3f1ae0696585` | **Merged** as `d0d5e02c866544aae41fb18b8fef6488be04199b` | Run [#652](https://github.com/faiev/ArtClub/actions/runs/43618272887): 218 Node tests; syntax, Chromium, GIF/ImageDecoder and MCP passed |

## Latest-main branch refresh

On 2026-11-15, the seven open feature branches (#27, #33, #39, #45, #53, #56 and #60) were refreshed from main snapshot `0c525c763731d044bd700f3920e95943e35c543e`.

- Each refresh is a two-parent merge commit with the previous feature head as first parent and main as second parent.
- Branch refs were advanced with `force: false` and an `expected_sha` matching the prior head.
- PR metadata confirms every head SHA matches the new commit and each PR is based on main at `0c525c763731d044bd700f3920e95943e35c543e`.
- All refreshed code/test PRs (#27/#33/#39/#45/#53/#56) report mergeable=true. PR #60 is also mergeable but intentionally remains draft.

## AC-094 implementation contract

- Deterministic sRGB → Lab, CIE76 and CIEDE2000; D65 reference white and documented sRGB transfer/precision policy.
- All 34 Sharma, Wu & Dalal (2005) reference pairs are retained in the conformance tests.
- Squared RGB remains the default; CIE76 and CIEDE2000 are opt-in.
- Palette values and each source pixel are precomputed once per mapping call; stable first-index tie handling is retained.
- Null transparency is explicit. Mapping rejects workloads above 4,194,304 pixel × palette comparisons before reading pixel entries or allocating result arrays.
- Full mapped pixel output is preserved; per-pixel match details are capped or can be disabled. Aggregate diagnostics remain bounded.
- No existing palette nearest-color default or Agent 10 quantization behavior is changed.

## Next queue

1. Coordinator review/integration of AC-067–AC-071 PRs #27, #33, #39, #45 and #53 against their refreshed exact heads.
2. Coordinator review of AC-072 PR #56; its previous AC-017 parent dependency is removed because PR #16 has merged.
3. Coordinator review of documentation-only AC-073 PR #60.
4. Do not start palette editor controls or modify `index.html`; AC-022 remains gated on explicit production UI ownership/file lock. No further isolated implementation phase is currently authorized beyond AC-094.

## Risks / boundaries

- Palette utilities remain isolated modules; they are not yet connected to production editor controls or file-picker workflows.
- AC-073 describes the import/export decision contract; it does not implement a UI, download flow, project mutation endpoint or Agent API integration.
- Do not merge or self-accept any Agent 8 PR.
- **Last updated:** 2026-11-15.
