# Status — Agent 1 QA / release reliability

## Active workstream
- **Current phase:** AC-030 — Project format and migration compatibility suite
- **State:** IN_PROGRESS
- **Coordination source:** `main` (PR #7 merged).
- **Latest main used to start the workstream:** `332fefeec3d73d3af8e9818f84d1dc79e3ae1ce5`.
- **Current phase branch:** Creating a dedicated branch from the latest main after this status update.

## Completed / submitted phases

### AC-025 — Read-only PR #1 QA coverage audit
- **State:** REVIEW / handoff submitted.
- Compared PR #1, current main and PR #8; supplied keep/drop and integration ordering recommendations.
- Read-only; no edits to the shared E2E file, PR #1 or PR #8.

### AC-029 — Project lifecycle regression matrix
- **PR:** [#25 — Add project lifecycle QA regression matrix](https://github.com/faiev/ArtClub/pull/25) (open, draft, unmerged).
- **Branch/head:** `agent/qa-lifecycle` at `c0a7fea2193d37f868818de4b715857cb1575a53`.
- **Base sync:** current main at last comparison `332fefeec3d73d3af8e9818f84d1dc79e3ae1ce5`; branch was 0 commits behind then.
- **Files:** `tests/fixtures/qa/lifecycle-fixtures.js`, `tests/qa/lifecycle/project-lifecycle.test.js`, `tests/qa/lifecycle/editor-switch-contract.test.js`.
- **Coverage:** project record isolation/reload/switch, rename/duplicate/delete, active layer/frame and visibility/lock/cel preservation, no-op versus meaningful-save recovery rotation, Recover semantics, quota abort atomicity, and a static selection-reset contract check.
- **Verification:** Focused commands are documented in PR #25 but **not run locally**. Attempted `git clone` failed because the execution environment could not resolve `github.com`. The project workflow's `node --test tests/*.test.js` does not discover nested `tests/qa/lifecycle/*.test.js`; no CI pass is claimed for these tests. Test-runner integration remains necessary and is outside this phase's assigned files.
- **Risks / limits:** Storage tests exercise `ProjectStorage` using a transactional IndexedDB test double; editor selection reset check is static source inspection, not browser behavior. AC-032 is the assigned real-Chromium lifecycle harness.

## Next 3–5 authorized actions
1. **AC-030:** Add fixture-driven current-v2 boundary, legacy-v1 deterministic migration, malformed JSON/reference/ID/color/duration, sparse/undefined cel, limit and non-mutation compatibility tests.
2. **AC-031:** Add import/export contract matrix as GIF, sprite-sheet and palette modules land; document contracts and continue other tests if a dependency remains open.
3. **AC-032:** Build standalone Chromium/IndexedDB lifecycle harness under `tests/qa/browser/`; do not touch shared bridge E2E or workflow.
4. **AC-033:** Add QA/release matrix, release checklist, read-only release checker and its tests.
5. **Ongoing triage:** Add missing negative/boundary cases only under QA-owned paths and maintain `docs/QA_MATRIX.md`.

## Ownership / blockers
- Owned paths: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.
- Do not edit `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, `index.html`, storage/model implementation, exporter implementation or other agents' tests.
- Agent 4 owns the shared bridge E2E. Workflow lock for PR #11 was released on main; workflow remains outside Agent 1's ownership.
- **Current blocker:** local repository test execution is unavailable while GitHub DNS resolution fails; nested QA tests also need explicit test-runner inclusion. Continue AC-030 independently.
- **Next handoff:** Complete AC-030 as a separate narrow PR; keep PR #25 draft pending focused execution/test-runner integration.
- **Last updated:** 2026-11-14 — AC-029 submitted; AC-030 started.
