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
| Canvas renderer | Strict #RRGGBB/null input, full source validation before mutation, dirty clipping, 512×512 bound, frame/composite invalidation, onion-mask invalidation, overlay isolation and hit testing | Root `tests/canvas-renderer.test.js` covers the merged module; PR #61 adds QA boundary tokens and invalid hit-test bounds | Public `parseColor()` currently exposes a mutable cached RGBA array; defensive-copy regression is a TODO in PR #61 | 
| Release readiness tooling | Required-file/script checks, nested-test discovery, coordination freshness limits, CI evidence state | AC-033 checker and release docs are in PR #57 | Checker is read-only and does not query CI |

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
node --test tests/qa/renderer/canvas-renderer-contract.test.js
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
| QA-008 | Medium | `parseColor()` returns the internal cached RGBA array from the renderer's `COLORS` map. A caller can mutate a channel and corrupt later parsing/rendering of that same color. | PR #61 QA TODO; suggested defensive-copy fix handed to Agent 2. Renderer implementation remains unchanged. |

## Evidence rules

- Record the exact tested commit SHA, Node version, command and result count.
- Distinguish test doubles, Node unit tests, real Chromium/IndexedDB, full-raster decoder tests, MCP client tests and benchmarks.
- A benchmark harness without captured samples is not performance evidence.
- A source test or open PR is not proof that CI executed it.
- This matrix does not query GitHub Actions. CI state is **unverified** until a reviewer supplies a workflow run URL and confirms it tested the relevant commit.


## Production UI integration — UI-01 workstation shell smoke coverage

This section is a **prepared test plan**, not evidence that UI-01 is implemented or has passed. The coordinator owns production `index.html` and UI wiring. Agent 1 will execute these cases against the approved UI-01 PR/head after it exists; until then, all UI-01 rows remain pending.

### Viewports and evidence

| Viewport | Required checks | Evidence to capture |
|---|---|---|
| Desktop 1440×900 | Full workstation shell; canvas remains dominant; tool rail, inspector and timeline remain visible and usable | Full-page screenshot plus canvas close-up; browser/viewport metadata |
| Compact 1280×800 | No clipped or unreachable primary controls; docked regions remain operable; any collapsed panel has a clear reveal path | Full-page screenshot plus focused walkthrough of collapsed/revealed panels |

### User-flow smoke matrix

| ID | User flow | Steps / expected result | Regression guard |
|---|---|---|---|
| UI01-01 | Open and orient | Load the editor; identify document/menu bar, tool rail, canvas viewport, inspector and bottom timeline. No decorative control may imply an unavailable feature. | Console/page errors remain empty; no dead or placeholder controls |
| UI01-02 | Draw and erase | Choose brush, set a color, draw known pixels, then erase a pixel. Canvas pixels match the requested coordinates/colors. | Pixel-exact assertions; canvas overlay/grid never changes document pixels |
| UI01-03 | Selection | Create a rectangular selection, move/copy/paste or clear it using supported current commands. Visible selection feedback matches the selected bounds. | Selection changes do not leak into unrelated cels; undo/redo restores exact source pixels |
| UI01-04 | Layer workflow | Add/select/rename/reorder a layer; toggle visibility and lock; draw to the selected layer. | Active layer indicator and rendered composite agree; locked/hidden target behavior remains non-mutating |
| UI01-05 | Timeline/frame workflow | Add/select/duplicate/delete frames using supported existing controls; draw a distinct pixel on two frames. | Correct active frame/cel is edited; switching frames does not display or save another frame's pixels |
| UI01-06 | Playback | Play and stop a multi-frame sequence. Frame order/timing follows the existing timeline state. | Playback does not alter saved cels or active project data |
| UI01-07 | Save/reload/recovery | Rename project; wait for saved state; reload; verify name and exact pixels. Make a subsequent edit and exercise Project Library recovery where supported. | Autosave does not report success before persistence; recovery rotates only on meaningful content changes |
| UI01-08 | Import | Import a valid image/project using the existing production flow and its existing preview/confirmation steps. | Cancel/failure leaves source project unchanged; accepted import targets the intended project/frame/layer |
| UI01-09 | Export | Export currently supported PNG/SVG/project formats, and GIF if its download UI is wired in the integration PR. | Independently inspect output type, dimensions and pixels; export must not mutate project state |
| UI01-10 | Keyboard/focus | Navigate toolbar and panels with keyboard; activate supported shortcuts; observe a visible focus indicator. | No keyboard regression or focus trap; canvas/document labels remain accessible |
| UI01-11 | Compact layout | Repeat drawing, layer selection, frame selection and save on 1280×800. Reveal/collapse any docked panel and reach all essential controls. | No off-screen critical action; pointer coordinates still map to intended logical pixels |
| UI01-12 | Failure/denial states | Trigger only supported validation/denial cases (e.g. invalid import, locked edit target). | Clear error/denial feedback; source pixels, project JSON and recovery state remain byte-for-byte unchanged |

### Execution record template

Record for each UI-01 candidate head:
- PR URL and exact tested commit SHA
- browser/version, OS and viewport/DPR
- passed/failed/blocked IDs from UI01-01…UI01-12
- page errors and console errors
- screenshot/evidence artifact locations
- Node/editor E2E, relevant specialist tests and exact run URLs
- regression details, reproduction steps and whether source project bytes/pixels remained unchanged

Do not mark UI-01 accepted from screenshots alone. The smoke matrix passes only when task flows work against the real editor, with pixel/state assertions and no critical console/page errors. A successful merge is not proof of publication; inspect GitHub Pages after the coordinator confirms deployment.
