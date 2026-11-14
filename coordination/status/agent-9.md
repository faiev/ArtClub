# Status — Agent 9

- **Workstream:** Project diagnostics / developer tooling
- **Active phase:** AC-079 — Diagnostics documentation and integration pack
- **Latest main observed:** `c2b0d4c395497f05756fb60723ef251ca2eaa788`
- **Last inspector base sync:** `573bf6fd8963781613bb43179e9c7d10f49c418e`
- **Post-sync main delta:** coordination status only (Agent 7); no inspector-owned file overlap.
- **Completed:** AC-018, AC-074, AC-075, AC-076, AC-077 and AC-078. All six current branch heads have full Node/browser/GIF/MCP CI success.

## Branch and PR ledger

| Phase | Branch / exact head | PR | Parent | Current state |
|---|---|---|---|---|
| AC-018 — single-file inspector | `agent/project-inspector` / `dc897d82d438e8a5cb6527d8f3541e65a8f7aadc` | [#12](https://github.com/faiev/ArtClub/pull/12) | `main` | Open draft; exact-head CI passed |
| AC-074 — batch inspection | `agent/project-inspector-batch` / `c273fa255207792ee2d9ef22b2a8802de8c5017d` | [#46](https://github.com/faiev/ArtClub/pull/46) | PR #12 | Open draft; exact-head CI passed |
| AC-075 — structural comparison | `agent/project-inspector-diff` / `3a3a858cbec32b8a842de05d30d755167f4a122d` | [#59](https://github.com/faiev/ArtClub/pull/59) | PR #46 | Open draft; exact-head CI passed |
| AC-076 — deep diagnostics | `agent/project-inspector-diagnostics` / `63e469679148a68c60b5aa09ad53eb55bcd115dd` | [#64](https://github.com/faiev/ArtClub/pull/64) | PR #59 | Open draft; exact-head CI passed |
| AC-077 — migration preview | `agent/project-inspector-migration-preview` / `7e2481ffb670ab15e1906b579488bcf07ffcc09a` | [#71](https://github.com/faiev/ArtClub/pull/71) | PR #64 | Open draft; exact-head CI passed |
| AC-078 — CI artifact report | `agent/project-inspector-ci-report` / `d66f74735582f24021406b87650a31ff9b340e15` | [#83](https://github.com/faiev/ArtClub/pull/83) | PR #71 | Open draft; exact-head CI passed |
| AC-079 — documentation/integration pack | To create | Not opened | PR #83 stack | Active; begin on separate branch |

Stack: PR #12 → #46 → #59 → #64 → #71 → #83. Keep descendant PRs stacked until parents merge. No Agent 9 PR has been merged or self-accepted.

## Completed phase summaries

### AC-018 — Read-only project inspector
- Offline Node CLI; uses the existing model as validation/migration authority.
- Human/JSON output, stable errors, 64 MiB per-file cap, read-only inputs and source-immutability coverage.
- Legacy migration is in memory only; generated identifiers are not represented as source IDs.

### AC-074 — Bounded batch inspection
- `--batch` and optional `--recursive`; lexical deterministic ordering, duplicate suppression/warnings, per-file errors and no symlink following.
- Limits: 500 unique files, 32 MiB aggregate, 64 MiB/file, 10,000 directory entries, 32 directory levels.

### AC-075 — Structural comparison
- `--compare left.json right.json`; stable human/JSON summaries across canvas, palette, project metadata, layers, frames, cels and bounded pixel-index differences.
- v2 matching uses exact source IDs only; legacy-to-legacy uses normalized positions; mixed-format records are not cross-matched.
- Missing cel differs from transparent `null`; pixel samples are capped at 100/cel.

### AC-076 — Deep diagnostics and risk scoring
- `--diagnostics [--json]`; model validation remains authoritative and supplemental findings are separate.
- Checks dimensions/version, duplicate IDs and cel pairs, references/active targets, malformed or short/long/sparse arrays, invalid pixels, byte/pixel budgets and suspicious palette entries.
- Fixed severity weights and risk score capped at 100; no repair/write-back.

### AC-077 — Deterministic migration preview
- `--migration-preview [--json]` invokes the actual legacy deserialize path and validates the v2 result.
- Reports exact source-byte SHA-256/byte count, source and target versions, transformed/preserved/generated/discarded fields and warnings.
- Preview IDs derive deterministically from source hash and are explicitly not source identities; timestamps use fixed epoch markers.
- Unknown top-level legacy fields are explicitly listed as discarded with a warning.
- 64 MiB source cap and 16 MiB normalized JSON output cap; no source or destination file is written.

### AC-078 — Versioned CI artifact report
- `--ci-report <project-file>` always emits JSON with `artifactSchemaVersion: 1`.
- Includes input path/size/format/version, project summary, authoritative validation, supplemental diagnostics and source paths, severity/count totals, risk, read-only flags and exit-code policy.
- Status values: `valid`, `invalid`, `incomplete`; exit codes 0/1/2 are documented.
- SARIF intentionally omitted to avoid claiming compatibility without a reviewed mapping for the inspector's diagnostic paths/codes/severity model.

## Exact-head CI evidence

| Phase | Tested head | Actions run | Node tests | Browser / GIF / MCP |
|---|---|---:|---:|---|
| AC-018 | `dc897d82d438e8a5cb6527d8f3541e65a8f7aadc` | [#705](https://github.com/faiev/ArtClub/actions/runs/43619270426) | 246 pass, 0 fail, 0 skip | All passed |
| AC-074 | `c273fa255207792ee2d9ef22b2a8802de8c5017d` | [#708](https://github.com/faiev/ArtClub/actions/runs/43619291567) | 254 pass, 0 fail, 0 skip | All passed |
| AC-075 | `3a3a858cbec32b8a842de05d30d755167f4a122d` | [#712](https://github.com/faiev/ArtClub/actions/runs/43619311939) | 264 pass, 0 fail, 0 skip | All passed |
| AC-076 | `63e469679148a68c60b5aa09ad53eb55bcd115dd` | [#717](https://github.com/faiev/ArtClub/actions/runs/43619348408) | 274 pass, 0 fail, 0 skip | All passed |
| AC-077 | `7e2481ffb670ab15e1906b579488bcf07ffcc09a` | [#718](https://github.com/faiev/ArtClub/actions/runs/43619367155) | 282 pass, 0 fail, 0 skip | All passed |
| AC-078 | `d66f74735582f24021406b87650a31ff9b340e15` | [#750](https://github.com/faiev/ArtClub/actions/runs/43619990920) | 287 pass, 0 fail, 0 skip | All passed |

For each listed run, both workflow jobs completed successfully. Browser E2E includes Chromium editor tests, animated GIF ImageDecoder verification and MCP client integration. Local execution was not performed; test claims above are from GitHub Actions logs.

## Next queue

1. **AC-079 — Diagnostics documentation/integration pack** (active): create `docs/PROJECT_DIAGNOSTICS.md` for single-file, batch, compare, diagnostics, migration preview and CI report; examples, limits, schemas and exit policies.
2. Add/organize diagnostic fixtures and immutability tests for any cases not already represented.
3. Open AC-079 as a separate draft PR stacked on #83; run the full current CI and record exact evidence.
4. **AC-095 — Project fingerprints and duplicate detection:** separate CLI/library, exact-byte and versioned semantic hashes, bounded batch mode, identity/content policy and tests.
5. Reconcile stacked PR bases parent-first after coordinator review; never merge own PRs or claim UI integration.

## Constraints and handoff

- All inspector operations remain local and read-only; no automatic correction or write-back.
- Do not modify project-model/storage, editor UI, Agent API, bridge, workflow or another agent's tests.
- PRs #12/#46/#59/#64/#71/#83 remain stacked drafts; coordinator handles review, merge and acceptance.
- The two main commits after the last code sync only changed Agent 7 coordination status; application code has no overlap, but re-sync before the next review/merge if more main changes land.
