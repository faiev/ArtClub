# Status — Agent 9

- **Workstream:** Project diagnostics / developer tooling
- **Active phase:** AC-077 — Deterministic migration preview
- **Latest main:** `b140cbefbcfb3cbe1a2774d1c0025e64efb052ba`
- **Completed:** AC-018, AC-074, AC-075, AC-076 — each refreshed and fully revalidated with Node/Chromium/GIF/MCP CI.

## Branch and PR ledger

| Phase | Branch / tested head | PR | Parent | State |
|---|---|---|---|---|
| AC-018 — single-file inspector | `agent/project-inspector` / `1da26998155639f6899e6dd1d0481f671d6f3115` | [#12](https://github.com/faiev/ArtClub/pull/12) | `main` | Open draft; zero commits behind main |
| AC-074 — batch inspection | `agent/project-inspector-batch` / `2ed6f38c959ebae793212a6c16950a455f1bd3bf` | [#46](https://github.com/faiev/ArtClub/pull/46) | PR #12 | Open draft; zero commits behind parent |
| AC-075 — structural comparison | `agent/project-inspector-diff` / `3a944a34950c0756a90fed2529d66fbe60af63ce` | [#59](https://github.com/faiev/ArtClub/pull/59) | PR #46 | Open draft; zero commits behind parent |
| AC-076 — deep diagnostics | `agent/project-inspector-diagnostics` / `b284e966a999e697f7ce31bd274ae83d01154a23` | [#64](https://github.com/faiev/ArtClub/pull/64) | PR #59 | Open draft; zero commits behind parent |
| AC-077 — migration preview | To create next | Not opened | PR #64 stack | Active phase; start on separate branch |

Stack remains PR #12 → #46 → #59 → #64. Do not merge descendants ahead of parents or retarget until the parent chain is accepted. No PR has been merged or self-accepted by Agent 9.

## Completed phases

### AC-018 — Read-only project inspector CLI
- Offline Node CLI using built-in modules and `js/project-model.js` validation/migration.
- Human/JSON output, stable errors, 64 MiB per-file cap, source immutability, legacy migration in memory only.
- Reports project structure, active targets, layers/frames/cels, pixel accounting and frame durations.
- Changed scope is the exact nine assigned files.

### AC-074 — Bounded batch project inspection
- `--batch` for files/directories and `--recursive` for nested traversal.
- Lexical deterministic ordering, duplicate warnings, per-file/discovery errors, symlink non-following.
- Bounds: 500 files, 32 MiB total, 64 MiB per file, 10,000 directory entries, 32 directory levels.
- Source files remain read-only.

### AC-075 — Structural comparison
- `--compare left.json right.json` for human and JSON output.
- Compares canvas/background, palette, project fields, metadata, layers, frames, cels and bounded row-major pixel-index changes.
- v2 identities match only on exact source IDs; legacy-to-legacy uses normalized position; mixed legacy/v2 entities are not cross-matched.
- Missing cels differ from present transparent `null` pixels; pixel samples capped at 100 per modified cel.

### AC-076 — Deep diagnostics and risk scoring
- `--diagnostics [--json] <project-file>` keeps model validation authoritative and supplemental diagnostics separate.
- Reports stable diagnostic code/severity/path/message; includes unsupported format/version, invalid dimensions, duplicate IDs/pairs, invalid references, missing active targets, malformed/short/long/sparse arrays, invalid colors, byte/pixel budgets and suspicious palette entries.
- Explicit `null` is transparency, not a sparse hole. No repair/write-back.
- Risk score capped 0–100, with severity weights critical 60/high 25/medium 10/low 3/info 0.

## Exact CI evidence on current refreshed heads

| Phase | Head | Run | Node suite | Browser / GIF / MCP |
|---|---|---|---|---|
| AC-018 | `1da26998155639f6899e6dd1d0481f671d6f3115` | [#426](https://github.com/faiev/ArtClub/actions/runs/43613626112) | 79 pass, 0 fail, 0 skip | All passed |
| AC-074 | `2ed6f38c959ebae793212a6c16950a455f1bd3bf` | [#431](https://github.com/faiev/ArtClub/actions/runs/43613665233) | 87 pass, 0 fail, 0 skip | All passed |
| AC-075 | `3a944a34950c0756a90fed2529d66fbe60af63ce` | [#435](https://github.com/faiev/ArtClub/actions/runs/43613699515) | 97 pass, 0 fail, 0 skip | All passed |
| AC-076 | `b284e966a999e697f7ce31bd274ae83d01154a23` | [#427](https://github.com/faiev/ArtClub/actions/runs/43613628824) | 107 pass, 0 fail, 0 skip | All passed |

For all four runs:
- `node --check agent-bridge/server.mjs`: passed.
- Chromium editor E2E: passed.
- Animated GIF ImageDecoder browser verification: passed.
- MCP client integration E2E: passed.
- Both workflow jobs completed successfully.

Earlier failed AC-076 runs #397/#399 were caused by a test invoking an intentionally rejected option combination before `--json`; the test invocation order was corrected. Run #427 is the successful validation of the corrected head.

Local execution was not performed because this environment could not resolve github.com for a local clone. All listed passing results are from GitHub Actions.

## Next queue

1. **AC-077 — Deterministic migration preview** (active): preview normalized legacy output and structured migration report, source SHA-256/byte count, transformed field list and warnings; no disk writes and no synthetic source IDs.
2. **AC-078 — CI/artifact report mode:** stable report schema with severity/path/count and exit policy; evaluate SARIF only if dependency/schema semantics stay clear.
3. **AC-079 — Diagnostics documentation/integration pack:** `docs/PROJECT_DIAGNOSTICS.md`, examples, limits, output schemas, fixtures and immutability tests.
4. **AC-095 — Project fingerprints and duplicate detection:** separate `tools/project-fingerprint.mjs` and tests; distinguish byte and semantic fingerprints, preserve artwork-significant ordering/pixels/transparency, bounded batch mode.
5. After PR review/merge, reconcile stacked PR bases in order; never merge own PRs or claim UI integration.

## Constraints / handoff

- All inspection/preview operations remain read-only; no automatic correction or write-back.
- Do not modify project-model/storage, UI, Agent API, bridge, workflows or another agent's tests.
- PR #12/#46/#59/#64 are open stacked drafts. Coordinator should review/merge in parent-first order.
- Agent 9 is now working on AC-077 in a separate branch and does not self-accept or merge.
