# Status — Agent 9

- **Workstream:** Project diagnostics / developer tooling
- **Active phase:** AC-075 — Structural project diff
- **Phase 0 / AC-018:** implementation refreshed and fully revalidated
- **Phase 1 / AC-074:** bounded batch inspection implemented and fully revalidated
- **Last synced main:** `4192df678b48167eb1f76558a75523138970d7ee`

## Branches and PRs

| Deliverable | Branch / head | PR | State |
|---|---|---|---|
| AC-018 — single-file inspector | `agent/project-inspector` / `c15a5791d12ae577cfce1708dbb047f0fc3f54be` | [#12](https://github.com/faiev/ArtClub/pull/12) | Open draft; zero commits behind main at sync |
| AC-074 — bounded batch inspector | `agent/project-inspector-batch` / `590de8cd03d62f0271e523ba135fde6ec98ae36e` | [#46](https://github.com/faiev/ArtClub/pull/46) | Open draft; stacked on PR #12; diff against parent is exactly three files |
| AC-075 — structural diff | `agent/project-inspector-diff` / `590de8cd03d62f0271e523ba135fde6ec98ae36e` | Not opened yet | New stacked branch created from the AC-074 head |

The AC-074 branch is explicitly based on `agent/project-inspector`; retarget it to `main` after PR #12 merges. AC-075 is being developed on a separate branch stacked on the AC-074 head. No work is merged or self-accepted.

## Completed phase summaries

### AC-018 — Read-only project inspector CLI

- Uses Node built-ins and the existing CommonJS `js/project-model.js`.
- Reuses `Project.deserializeProject()` and `Project.validateProject()` for authoritative validation and in-memory legacy migration.
- Supports human and JSON output, stable diagnostics, a 64 MiB per-file limit, and source-file immutability.
- Reports project structure, layers, frames, cels, pixel totals and frame durations.
- Added a UTF-8 BOM regression case.
- Changed scope: exactly the nine assigned AC-018 files. No model, storage, editor, renderer, Agent API, bridge or workflow implementation changes.

### AC-074 — Bounded batch project inspection

- Adds `--batch` for explicit files and directory inputs; `--recursive` opts into nested directories.
- Normalizes and lexically sorts discovered paths for deterministic output.
- Deduplicates repeated files and reports `DUPLICATE_PATH` warnings.
- Reports per-file errors and directory-discovery errors without aborting unrelated inputs.
- Never follows symlinks and keeps input files read-only.
- Fixed safety bounds: 500 unique files, 32 MiB aggregate input bytes, 64 MiB per file, 10,000 directory entries and 32 directory levels.
- Adds eight batch-focused tests, including directory ordering, recursion, source immutability, missing/malformed/unreadable files, duplicate paths, symlinks, file-count and aggregate-byte limits.

## Exact CI evidence

### AC-018 — run #293

- **Tested head:** `c15a5791d12ae577cfce1708dbb047f0fc3f54be`
- Workflow: https://github.com/faiev/ArtClub/actions/runs/43610790321
- `node --test tests/*.test.js`: **79 passed, 0 failed, 0 skipped**.
- `node --check agent-bridge/server.mjs`: passed.
- Chromium editor E2E: passed.
- Animated GIF ImageDecoder browser verification: passed.
- MCP client integration E2E: passed.
- Both workflow jobs completed successfully.

### AC-074 — run #295

- **Tested head:** `590de8cd03d62f0271e523ba135fde6ec98ae36e`
- Workflow: https://github.com/faiev/ArtClub/actions/runs/43610804649
- `node --test tests/*.test.js`: **87 passed, 0 failed, 0 skipped**.
- `node --check agent-bridge/server.mjs`: passed.
- Chromium editor E2E: passed.
- Animated GIF ImageDecoder browser verification: passed.
- MCP client integration E2E: passed.
- Both workflow jobs completed successfully.

Local execution was not performed because this environment could not resolve github.com for a local clone. The pass results above are from GitHub Actions.

## Risks / constraints

- Batch mode rejects over-limit inputs rather than processing an incomplete subset.
- Symbolic links are never followed; the CLI currently has no opt-in follow flag.
- Legacy-generated IDs are not surfaced as source IDs.
- All inspection remains read-only; no repair, normalization write-back or automatic correction is implemented.
- PR #46 and the AC-075 branch depend on the unmerged PR #12 parent.

## Next queue

1. **AC-075 — Structural project diff** (active): add `--compare`, exact source-ID matching for v2, explicit positional matching only for legacy-to-legacy, bounded pixel-index samples, and stable JSON/human summaries.
2. **AC-076 — Deep diagnostics and risk scoring:** additional non-mutating checks, clearly separate from authoritative model-invalid errors.
3. **AC-077 — Deterministic migration preview:** source hash/byte count, transformed fields and warnings; never persist migrated data.
4. **AC-078 — CI/artifact report mode:** stable severity/path/count output and exit policy; assess SARIF only if schema and dependency remain clear.
5. **AC-079 — Documentation/integration pack:** consolidated `docs/PROJECT_DIAGNOSTICS.md`, fixtures and source immutability coverage.

## Handoff

Coordinator: AC-018 and AC-074 have both passed full current-head Node/Chromium/GIF/MCP CI. PR #12 remains the parent review item; PR #46 is an isolated stacked child. AC-075 has started on `agent/project-inspector-diff`. Agent 9 does not merge its own PRs or self-mark accepted/done.
