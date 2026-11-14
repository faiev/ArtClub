# Art Club Release Checklist

Use this checklist for a candidate commit on `main`. Do not infer release readiness from an open PR, a local green subset, or CI on another SHA.

## 1. Source and coordination

- [ ] Confirm the checkout is on the intended release commit and record `git rev-parse HEAD`.
- [ ] Confirm `main` is current relative to the locally available `origin/main`; fetch separately before release review.
- [ ] Read `coordination/BOARD.md`, `coordination/BACKLOG.md`, `coordination/DECISIONS.md` and active assignments/statuses.
- [ ] Resolve integration locks and stacked PR dependencies before merging.
- [ ] Confirm no worker has edited another agent's owned files or merged their own PR.
- [ ] Run `node tools/qa-release-check.mjs`; review all failures, warnings and skipped coordination checks.

## 2. Required source and Node tests

From the repository root:

- [ ] `node --test tests/*.test.js`
- [ ] `node --check agent-bridge/server.mjs`
- [ ] `node --test tests/qa/lifecycle/project-lifecycle.test.js`
- [ ] `node --test tests/qa/lifecycle/editor-switch-contract.test.js`
- [ ] `node --test tests/qa/compatibility/project-compatibility.test.js`
- [ ] `node --test tests/qa/compatibility/gif-export-contract.test.js`
- [ ] `node --test tests/qa/release/qa-release-check.test.js`
- [ ] `node --test tests/qa/renderer/canvas-renderer-contract.test.js`

The current root test command only expands top-level `tests/*.test.js`. It does not include nested QA suites; running the root suite alone does not satisfy the focused QA commands above.

## 3. Real-browser and bridge tests

Install local bridge dependencies and Chromium:

```bash
cd agent-bridge
npm install --ignore-scripts
npx playwright install chromium
```

Then run from the repository root unless stated otherwise:

- [ ] `cd agent-bridge && npm run test:e2e`
- [ ] `cd agent-bridge && npm run test:mcp`
- [ ] `node tests/gif-export.browser.mjs`
- [ ] `node tests/qa/browser/project-lifecycle.mjs`

If sprite-sheet export is included in the release, also require the sprite-sheet browser runner added by its owner and complete PNG decode/full-raster RGBA evidence. A canvas stub, PNG signature or metadata-only assertion is not a substitute for decoded raster verification.

## 4. Format and import/export checks

- [ ] Project v2 valid boundaries and malformed-input diagnostics are covered.
- [ ] Legacy v1 migration preserves logical content and leaves source bytes/input objects unchanged.
- [ ] GIF frame order, timing, loop policy, binary transparency and source immutability are covered.
- [ ] Sprite-sheet dimensions, rectangles, frame order, transparency, margins/gutters and metadata correspondence are checked against the decoded PNG raster.
- [ ] GPL/JASC-PAL/JSON preserve supported order, duplicates and names, and reject malformed/oversized input without silent clamping.
- [ ] Oversized imports/exports fail before mutating project or source data.

## 5. Known-risk review

- [ ] Resolve or explicitly accept the sparse-cel-array-hole validation gap in the project model.
- [ ] Confirm nested QA tests and standalone browser harness are executed by explicit commands or a workflow step.
- [ ] Confirm PR #1's unique frame-aware assertions are ported without duplicating or weakening PR #10 recovery checks.
- [ ] Resolve stale/diverged branch bases and rerun tests after every base update.
- [ ] Review the Canvas renderer `parseColor()` mutable-cache TODO; verify a defensive-copy fix before treating the public helper as safe.
- [ ] Review all documented TODOs, unsupported format behavior and bounded-memory constraints.

## 6. CI evidence and final decision

- [ ] Identify the exact GitHub Actions run URL for the release commit.
- [ ] Verify the run's tested head SHA exactly matches the candidate commit.
- [ ] Verify required Node, Chromium and MCP jobs completed successfully.
- [ ] Verify separately added QA runners actually appear in the workflow log.
- [ ] Record any skipped/manual tests and why they were skipped.
- [ ] Coordinator reviews/merges PRs and explicitly declares release readiness.

**Important:** The local QA release checker does not query GitHub, inspect remote CI, deploy, mutate project data or prove tests passed. Its machine-readable CI state is always reported as unverified. CI can be marked green only from a verifiable workflow run associated with the exact release SHA.


## 7. Production UI — UI-01 workstation shell smoke gate

**Prepared for the coordinator's UI-01 integration PR. Not yet executed.** Agent 1 does not modify `index.html` or production CSS and will test only after an approved candidate is available.

- [ ] Capture a 1440×900 desktop screenshot and verify menu/document bar, tool rail, dominant canvas, inspector and timeline.
- [ ] Capture a 1280×800 compact screenshot; verify no essential action becomes clipped or unreachable.
- [ ] Run UI01-01…UI01-12 in `docs/QA_MATRIX.md`: orientation, draw/erase, selection, layers, frames, playback, save/reload/recovery, import, export, keyboard/focus, compact layout and denial/error states.
- [ ] Assert known pixel coordinates/colors and exact state after project/frame/layer switching.
- [ ] Verify grid/selection/onion overlays do not alter stored artwork pixels.
- [ ] Verify import cancellation/failure and denied edits preserve source project bytes, pixels and recovery state.
- [ ] Record PR URL, exact tested SHA, browser/version, viewport/DPR, screenshots, failed/blocked IDs and console/page errors.
- [ ] Run root Node tests, Chromium editor E2E, and relevant specialist browser/decoder tests against the exact candidate head.
- [ ] After merge, verify Pages deployment and directly inspect the published URL before any user-visible release claim.

The coordinator is the sole production UI integrator. Any missing control, placeholder interaction, or removed existing workflow is a regression—not a pass because the new shell looks correct.
