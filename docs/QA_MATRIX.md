# Art Club QA Matrix

Last maintained: 2026-11-14  
Owner: Agent 1 — QA / release reliability

This is a living index of regression coverage and known release risks. It separates tests that exist on `main`, tests proposed in open PRs, real-browser evidence, and CI evidence. An open PR or a test file alone is not proof that a test has executed.

## Coverage matrix

| Area | Required behavior | Current coverage / evidence state | Release note |
|---|---|---|---|
| Project model v2 | Dimensions, layers, frames, cels, palette, references, limits, stable diagnostics | Root `tests/project-model.test.js` is part of the standard Node suite | Run against the exact release SHA |
| Project storage | Save/reopen, one-step recovery rotation, legacy migration | Root `tests/project-storage.test.js`; AC-006 recovery fix merged in PR #10 | Check save failures and no-op behavior |
| Editor/browser interaction | Mouse drawing, editing, frames, layers, playback, IndexedDB persistence | `agent-bridge/e2e-test.mjs` and project workflow browser job | Agent 4 owns shared bridge E2E edits |
| Frame-aware persistence QA | Selected frame restored, every cel read on its owning frame, browser import path, autosave path | AC-025 audit submitted; useful PR #1 assertions are to be ported by Agent 4 during PR #8 refresh | PR #1 is stale/overlapping and is not the integration source |
| Project lifecycle | Create, save, autosave, explicit no-op save, Recover, rename, duplicate, switch, delete, independent active frame/layer and cels | AC-029 PR #25 adds a QA-owned test double suite; not yet verified by local execution or current CI | Test double is not a browser test |
| Project format / migration | v2 bounds, v1 logical migration, malformed JSON, references/IDs, HEX, duration, palette/layer/frame/cel limits, non-mutation | AC-030 PR #32 adds fixture-driven checks | Sparse cel array holes remain a known validation gap; see risk ledger |
| GIF export | Frame order, source/effective timing, loop policy, binary transparency, hidden layers, Blob, source immutability, malformed/oversized rejection | AC-031 PR #36 adds QA-owned contracts for merged GIF module; not yet executed here | Keep palette overflow quantization and full-raster GIF decode in exporter coverage |
| Sprite-sheet PNG | Frame order, exact PNG RGBA, dimensions, frame rectangles, transparency, margins/gutters, metadata | PR #3 / AC-027 remains open; a Chromium full-raster harness is present on that branch | Real-browser decode was reported as unverified; require exact-raster proof after merge |
| Palette formats | GPL/JASC-PAL/JSON ordering, duplicates, names where supported, strict diagnostics, size limits | PR #16 remains open; source tests exist on its branch | JASC-PAL does not encode palette or color names |
| Standalone lifecycle browser QA | Real Chromium/IndexedDB create, switch, edit, reload and recovery with exact pixels | AC-032 PR #42 adds an isolated Playwright runner | Runner is not yet wired into the shared workflow and has not been executed here |
| Release readiness tooling | Required-file/script checks, nested-test discovery, coordination freshness limits, CI evidence state | AC-033 checker and release docs are being added in this workstream | The checker is read-only and does not query CI |

## Required commands

Run from the repository root unless the line says otherwise.

### Release readiness checker

Run read-only structural checks:

```bash
node tools/qa-release-check.mjs
node tools/qa-release-check.mjs --json
```

The checker reports required files, bridge scripts, workflow commands, QA commands documented in the release checklist, nested test discovery and coordination freshness where local Git refs permit a comparison. JSON includes check counts, `localCheckStatus`, and `releaseReady: false` / `releaseStatus: "unverified"`. Its `ci` object is always `unverified`; this tool never queries GitHub Actions or declares a release green. A local structural pass is not a release approval.

### Core CI-equivalent commands

```bash
node --test tests/*.test.js
node --check agent-bridge/server.mjs
cd agent-bridge && npm install --ignore-scripts
cd agent-bridge && npm run test:e2e
cd agent-bridge && npm run test:mcp
node tests/gif-export.browser.mjs
```

### QA-owned focused suites

```bash
node --test tests/qa/lifecycle/project-lifecycle.test.js
node --test tests/qa/lifecycle/editor-switch-contract.test.js
node --test tests/qa/compatibility/project-compatibility.test.js
node --test tests/qa/compatibility/gif-export-contract.test.js
node --test tests/qa/release/qa-release-check.test.js
```

### Standalone project lifecycle browser harness

```bash
cd agent-bridge && npm install --ignore-scripts
cd agent-bridge && npx playwright install chromium
node tests/qa/browser/project-lifecycle.mjs
```

The standard workflow currently uses the non-recursive glob `node --test tests/*.test.js`. It does not discover tests nested under `tests/qa/`. Those focused commands must be run explicitly or added by the coordinator/workflow owner. Agent 1 does not own the shared workflow.

## Known risks / bug ledger

| ID | Severity | Finding | Status / owner |
|---|---|---|---|
| QA-001 | High | `project-model.js` validates cel colors with `Array.prototype.some()`, which skips sparse array holes. A sparse cel may pass color validation although explicit undefined entries are rejected. | Known gap from AC-030; production model change is outside Agent 1 ownership |
| QA-002 | High | Nested QA test files are not included by `node --test tests/*.test.js`. | Needs explicit test commands or workflow-owner integration |
| QA-003 | High | Standalone project lifecycle Chromium runner is not invoked by the current project workflow. | AC-032 PR #42; CI integration note supplied |
| QA-004 | Medium | PR #3 sprite-sheet PNG browser harness's full real-browser decode was not reported as executed. | Agent 3 AC-027; keep acceptance pending exact Chromium raster evidence |
| QA-005 | Medium | PR #16 palette-format PR and its contract tests are not yet on main. | Pending merge/revalidation |
| QA-006 | Medium | PR #1 frame-aware assertions overlap the shared bridge E2E owned by Agent 4. | AC-025 keep/drop audit handed to Agent 4; do not edit bridge E2E |
| QA-007 | Medium | A green baseline browser workflow does not prove QA-owned nested harnesses ran unless the workflow log names the exact runner. | Evidence rule; verify run URL and tested SHA |

## Evidence rules

- Record the exact tested commit SHA, Node version, command and result count.
- Distinguish test doubles, Node unit tests, real Chromium/IndexedDB, full-raster decoder tests, MCP client tests and benchmarks.
- A benchmark harness without captured samples is not performance evidence.
- A source test or open PR is not proof that CI executed it.
- This matrix does not query GitHub Actions. CI state is **unverified** until a reviewer supplies a workflow run URL and confirms it tested the relevant commit.
