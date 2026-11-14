# Status — Agent 9

- **Workstream:** Project diagnostics / developer tooling
- **Latest main observed:** `57eb9fe78101528a5e26bc12d3cedff96cf73f62`
- **Active phase:** AC-095 — project fingerprints and duplicate detection; submitted as draft PR #89, exact-head CI passed.
- **Working branch:** `agent/project-fingerprint` / `16bdc5e7a7853f8e9dd5d544f8b79d28e8459a3e`
- **Local execution:** Not available in this session; a local clone could not resolve `github.com`. All passing test evidence below is from GitHub Actions.
- **Ownership:** This session changed only the AC-095 branch files and this Agent 9 status file. No project model, inspector CLI, storage, UI, bridge, Agent API, workflow or other-agent-owned paths changed.

## PR and branch ledger

| Phase | Branch / PR | Parent | Latest state / evidence |
|---|---|---|---|
| AC-018 — read-only inspector | `agent/project-inspector` / [#12](https://github.com/faiev/ArtClub/pull/12) | `main` | Open draft; earlier exact-head CI passed |
| AC-074 — batch inspection | `agent/project-inspector-batch` / [#46](https://github.com/faiev/ArtClub/pull/46) | #12 | Open draft; earlier exact-head CI passed |
| AC-075 — structural comparison | `agent/project-inspector-diff` / [#59](https://github.com/faiev/ArtClub/pull/59) | #46 | Open draft; earlier exact-head CI passed |
| AC-076 — deep diagnostics | `agent/project-inspector-diagnostics` / [#64](https://github.com/faiev/ArtClub/pull/64) | #59 | Open draft; earlier exact-head CI passed |
| AC-077 — migration preview | `agent/project-inspector-migration-preview` / [#71](https://github.com/faiev/ArtClub/pull/71) | #64 | Open draft; earlier exact-head CI passed |
| AC-078 — CI artifact report | `agent/project-inspector-ci-report` / [#83](https://github.com/faiev/ArtClub/pull/83) | #71 | Open draft; earlier exact-head CI passed |
| AC-079 — docs and diagnostic fixture pack | `agent/project-diagnostics-docs` / [#85](https://github.com/faiev/ArtClub/pull/85) | #83 | Open draft; Actions run [#43621314697](https://github.com/faiev/ArtClub/actions/runs/43621314697): test and browser-e2e jobs passed |
| AC-095 — project fingerprints | `agent/project-fingerprint` / [#89](https://github.com/faiev/ArtClub/pull/89) | #85 | Open draft; head `16bdc5e7a7853f8e9dd5d544f8b79d28e8459a3e`; Actions run [#43630959731](https://github.com/faiev/ArtClub/actions/runs/43630959731): 303 tests passed, 0 failed, 0 skipped; browser-e2e passed |

Stack: **#12 → #46 → #59 → #64 → #71 → #83 → #85 → #89**. The Agent 9 PRs remain drafts and unmerged. Do not retarget or merge descendants before their parents are reviewed and accepted. No UI integration is claimed.

## AC-079 — completed deliverable submitted

PR #85 adds:
- `docs/PROJECT_DIAGNOSTICS.md`, covering single-file, batch, compare, diagnostics, migration preview and CI report modes.
- Nine malformed/invalid project fixtures for the deep-diagnostic coverage matrix.
- Fixture-corpus assertions for stable diagnostic codes and byte-for-byte source immutability, plus a byte-limit test using a temporary file.

The PR keeps the inspector CLI unchanged and does not modify other agents' ownership. Both Actions jobs passed on the submitted PR head.

## AC-095 — implementation submitted

PR #89 adds exactly three paths:
- `tools/project-fingerprint.mjs`: local read-only exact-byte SHA-256 and versioned semantic SHA-256; single-file and bounded batch modes; deterministic duplicate groups; stable errors; no symlink following.
- `tests/project-fingerprint.test.js`: focused tests for exact bytes, identity/content separation, ID-changed semantic equality, pixel/cel/frame differences, legacy projects, unsupported versions, malformed JSON/UTF-8, optional canvas background, batch duplicates, symlinks, file limits and immutability.
- `docs/PROJECT_FINGERPRINTS.md`: canonical version 1 include/exclude policy, comparability rules, batch limits and CLI schema.

Semantic canonical version 1 includes canvas geometry/background, palette ordering, ordered layer/frame properties, cel presence, transparency and exact pixel values. It excludes project ID/name, layer/frame IDs, metadata/timestamps and editor selection. Cels use positional layer/frame references in the projection. Only equal canonical versions may be compared; this is exact projection equality, not fuzzy similarity. Legacy migration uses the existing project model in memory only and never reports generated IDs as source identity.

### CI corrections and final evidence

- Initial PR run [#43630476259](https://github.com/faiev/ArtClub/actions/runs/43630476259) failed one new batch duplicate-group test (301 passed / 1 failed). The grouping helper filters on `ok`; the successful-result projection had omitted that flag.
- Added `ok: true` to successful candidates and changed directory enumeration to bounded streaming traversal. Also made file-count/directory-limit overflow reject partial batch output.
- Intermediate exact-head runs [#43630860597](https://github.com/faiev/ArtClub/actions/runs/43630860597) and [#43630943655](https://github.com/faiev/ArtClub/actions/runs/43630943655) passed both jobs.
- Final exact-head run [#43630959731](https://github.com/faiev/ArtClub/actions/runs/43630959731) on `16bdc5e7a7853f8e9dd5d544f8b79d28e8459a3e`: **303 passed, 0 failed, 0 skipped**; both `test` and `browser-e2e` jobs completed successfully.

## Next queue / blockers

1. AC-095 is the final phase currently authorized in this workstream; implementation, tests, documentation and draft PR are submitted.
2. Keep PR #89 stacked on #85. Coordinator review/merge of the parent chain is external to this worker; do not merge or self-accept.
3. After the parent chain lands, coordinator may request a fresh base revalidation. No further Agent 9 implementation phase is currently listed in the assignment.

## Constraints

- Read-only, offline tools only; no source repair or write-back.
- Use the existing project model as the authoritative validation/migration boundary.
- Do not edit project-model/storage, inspector CLI (for AC-095), editor UI, Agent API, bridge, workflow or any other agent's tests.
- Report PR/CI completion separately from merge, deployment and user-visible integration. None of the Agent 9 diagnostics/fingerprint PRs are merged or integrated into the live editor UI.
