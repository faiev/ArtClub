# Status — Agent 9

- **Workstream:** Project diagnostics / developer tooling
- **Active phase:** AC-076 — Deep diagnostics and risk scoring
- **Phase 0 / AC-018:** refreshed and full CI passed
- **Phase 1 / AC-074:** bounded batch inspection delivered; full CI passed
- **Phase 2 / AC-075:** structural comparison delivered; initial full CI passed; branch refreshed to current main and requires rerun on refreshed head
- **Last synced main:** `f638b30c71a80bbbaeb86759e7d476a274500085`

## Branches and PRs

| Deliverable | Branch / head | PR | State |
|---|---|---|---|
| AC-018 — single-file inspector | `agent/project-inspector` / `5f516b16bc3f78eed29bd93edcf236c08ccbe3a1` | [#12](https://github.com/faiev/ArtClub/pull/12) | Open draft; zero commits behind main at sync |
| AC-074 — bounded batch inspector | `agent/project-inspector-batch` / `05e9d9b28fda6aaf42b4b50eef40990bd1bfea29` | [#46](https://github.com/faiev/ArtClub/pull/46) | Open draft; stacked on PR #12; three-file diff |
| AC-075 — structural project diff | `agent/project-inspector-diff` / `71ed01fd526734b1368d83612d623f810a579a6e` | [#59](https://github.com/faiev/ArtClub/pull/59) | Open draft; stacked on PR #46; three-file diff |

The branch chain is PR #12 → PR #46 → PR #59. Retarget stacked PRs to `main` after their parent PRs merge. Agent 9 has not merged or self-accepted any PR.

## Completed phase summaries

### AC-018 — Read-only project inspector CLI

- Uses Node built-ins and existing CommonJS `js/project-model.js` as the validation/migration authority.
- Supports human/JSON output, 64 MiB per-file cap, stable errors and source immutability.
- Reports project identity/structure, layers/frames/cels, pixel accounting and animation duration.
- Legacy files are migrated in memory only; synthetic IDs are not shown as source IDs.

### AC-074 — Bounded batch inspection

- Adds `--batch` for explicit files/directories and `--recursive` for nested traversal.
- Deterministic lexical ordering; duplicate-path warnings; per-file and directory-discovery errors are reported separately.
- Does not follow symlinks; all inputs remain read-only.
- Limits: 500 files, 32 MiB aggregate bytes, 64 MiB per file, 10,000 directory entries and 32 directory levels.
- Eight batch-specific tests cover traversal, ordering, source immutability, path errors, duplicates, symlinks and limits.

### AC-075 — Structural comparison

- Adds `--compare left.json right.json` with human and stable JSON output.
- Compares canvas/background, palette by index, project fields, metadata, layers, frames, cels and row-major pixel-index changes.
- v2 entities/cels match only by exact source IDs; two legacy inputs compare by normalized position; mixed legacy/v2 inputs are not cross-matched.
- Distinguishes a missing cel from a present transparent `null` pixel; explains layer/frame/cel add/remove reasons.
- Caps pixel-index samples to 100 per modified cel and never includes full pixel buffers.
- Includes regression tests for matching policies, major structural changes, missing cel vs transparency, layer/frame removal, legacy source immutability, bounded samples and CLI errors.

## Exact CI evidence

### AC-018 — run #293
- Head: `c15a5791d12ae577cfce1708dbb047f0fc3f54be`
- Workflow: https://github.com/faiev/ArtClub/actions/runs/43610790321
- Node suite: **79 passed, 0 failed, 0 skipped**.
- Bridge syntax check, Chromium editor E2E, GIF ImageDecoder verification, MCP E2E: all passed.
- Both workflow jobs completed successfully.

### AC-074 — run #295
- Head: `590de8cd03d62f0271e523ba135fde6ec98ae36e`
- Workflow: https://github.com/faiev/ArtClub/actions/runs/43610804649
- Node suite: **87 passed, 0 failed, 0 skipped**.
- Bridge syntax check, Chromium editor E2E, GIF ImageDecoder verification, MCP E2E: all passed.
- Both workflow jobs completed successfully.

### AC-075 — run #323 (before latest base refresh)
- Head: `01de19b4c56883be3fba5776fc1ab668f4d48b4a`
- Workflow: https://github.com/faiev/ArtClub/actions/runs/43611529822
- Node suite: **97 passed, 0 failed, 0 skipped**.
- Bridge syntax check, Chromium editor E2E, GIF ImageDecoder verification, MCP E2E: all passed.
- This run is historical for the prior head. Current branch was then refreshed to `71ed01fd526734b1368d83612d623f810a579a6e`; a new CI run is required for that exact head.

Local execution was not performed because this environment could not resolve github.com for a local clone. All passing results above are from GitHub Actions.

## Constraints and current blocker

- Keep validation authoritative: do not silently normalize/repair invalid files.
- No repair/write-back or UI integration.
- AC-075 branch has been advanced with the latest `main` and its stacked base; current exact head has not yet been retested.
- PR #12/#46/#59 remain open and stacked; no review/merge dependency blocks independent AC-076 development.

## Next queue

1. **AC-076 — Deep diagnostics and risk scoring** (active): supplemental structural/risk checks, separate from model validation errors.
2. **AC-077 — Deterministic migration preview:** source hash/byte count, transformed fields and warnings; never persist normalized content.
3. **AC-078 — CI/artifact report:** stable diagnostics/severity/path/count output and exit policy; investigate SARIF only if schema remains unambiguous.
4. **AC-079 — Documentation/integration pack:** `docs/PROJECT_DIAGNOSTICS.md`, examples, fixtures and immutability tests.
5. Re-run AC-075 CI on refreshed head `71ed01fd...` and update PR #59 evidence.

## Handoff

Coordinator: AC-018 and AC-074 have passed full Node/Chromium/GIF/MCP CI. AC-075 implementation is submitted in PR #59 and its pre-refresh full CI passed; the latest branch head needs revalidation after base sync. Agent 9 is starting AC-076 on an independent branch stacked above PR #59. No self-merge or self-acceptance.
