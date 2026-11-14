# Art Club — Integrated UX Implementation Sequence

**Task:** AC-054 — Integrated UX implementation sequence  
**Owner:** Agent 5 — UX / accessibility / interaction design  
**Branch:** `agent/ux-implementation-sequence`  
**Base:** `4192df678b48167eb1f76558a75523138970d7ee`  
**Status:** Coordinator-facing implementation roadmap. This document does not authorize production UI edits or change any shared-file lock.

---

## 1. Executive recommendation

The UX workstream now has a connected specification pack for keyboard commands, canvas navigation, layer/timeline editing, palette/export journeys, accessibility and static interaction patterns. The next implementation phase should not start by wiring every isolated module into the editor at once.

Use one coordinator-appointed UI integrator, one serialized UI change at a time, and four release gates:

1. **Correctness and safe mutation:** editing targets, recovery, focus routing and destructive operations must fail closed.
2. **Rendering and navigation:** accept viewport and renderer contracts, prove browser pixel parity, and retain the DOM renderer as fallback until integration is verified.
3. **Editing and production workflows:** timeline/cel matrix, palette tools and exports consume their accepted module contracts rather than duplicating logic in event handlers.
4. **Accessibility and release quality:** run the complete keyboard, responsive, contrast, screen-reader and browser validation against the integrated editor—not only the isolated modules.

The strongest user-visible wins are: safe Clear/import and cel editing; dependable large-canvas navigation; an understandable layer/frame/cel workspace; reliable GIF/sprite-sheet delivery; then palette interoperability and optional pixel-art/tile tools.

A module PR is not a shipped feature. A green workflow is evidence for its exact head and tested merge context. The UI is integrated only after the controls are wired into the live editor, the browser journey is tested, and the relevant fallback/recovery path is proven.

## 2. Product and architecture principles

All UI implementation should preserve the shared decisions:

- **Local-first:** Art Club remains deployable as a static app. Palette, pixel and export workflows must not require accounts, backend uploads, paid services or remote APIs.
- **Plain JavaScript:** do not add TypeScript or build tooling to solve a UI integration problem.
- **Exact pixels:** preserve integer logical coordinates, source HEX/null pixels and nearest-neighbor scaling. Viewport state and overlays are not artwork.
- **No silent mutation:** destructive operations validate the target and the complete input before mutation; failed operations leave pixels, history, revision and autosave state unchanged.
- **Deterministic bounded work:** respect project and module limits; preflight large allocations; do not silently clamp values, truncate frames, drop colors or scale output to fit a budget.
- **Module-first:** the editor shell consumes accepted modules through explicit contracts. Do not reimplement palette parsing, animation encoding, viewport maths or edit validation inside index.html.
- **Accessible by construction:** keyboard, focus, names/states, contrast, status and responsive behavior are part of each feature's acceptance criteria—not a post-release cleanup.
- **Single writer:** index.html and the test workflow have explicit owners. No simultaneous edits, stacked UI branches or unapproved API wiring.

## 3. UX specification pack and intended use

| Work | Deliverable / PR | What the implementation must take from it |
|---|---|---|
| AC-026 — Keyboard and command discoverability | KEYBOARD_SHORTCUTS_PLAN.md · [PR #20](https://github.com/faiev/ArtClub/pull/20) | Platform modifier policy, reserved-key exclusions, focus routing, shortcut reference, accessible keyboard matrix |
| AC-049 — Canvas workspace/navigation | docs/ux/CANVAS_WORKSPACE_SPEC.md · [PR #24](https://github.com/faiev/ArtClub/pull/24) | Fit vs Actual Size, cursor anchor, pan bounds, touch/trackpad behavior, resize, CSS-pixel/DPR contract |
| AC-050 — Layer/frame/timeline | docs/ux/LAYER_TIMELINE_SPEC.md · [PR #30](https://github.com/faiev/ArtClub/pull/30) | Layer rows × frame columns, cel lifecycle, structural operations, active-target rules, playback/onion behavior |
| AC-051 — Palette/export journeys | docs/ux/PALETTE_EXPORT_SPEC.md · [PR #35](https://github.com/faiev/ArtClub/pull/35) | Local import preview, preserve/merge policy, metadata-loss disclosures, export preflight, naming and failure recovery |
| AC-052 — Accessibility audit | docs/ux/ACCESSIBILITY_AUDIT.md · [PR #41](https://github.com/faiev/ArtClub/pull/41) | 14 severity-rated findings, focus/semantics/contrast/status/dialog/reduced-motion remediation and manual test requirements |
| AC-053 — Static interaction prototypes | docs/ux/prototypes/ · [PR #47](https://github.com/faiev/ArtClub/pull/47) | Visual/layout reference for shortcut help, canvas workspace, layer/timeline matrix, palette/export preview |

These PRs are documentation/prototype submissions. They do not create production controls and remain distinct from implementation acceptance.

### Cross-spec decisions that must be reconciled before coding

1. **Shortcut context vs the matrix:** AC-026's separate layer/timeline key contexts must be reconciled with AC-050's two-dimensional matrix navigation. Arrow keys must have one owner based on focus; text fields and dialogs keep native behavior.
2. **Fit vs Actual Size:** the current percentage is fit-relative. A later UI must distinguish Fit from exactly one CSS pixel per logical pixel and must announce the mode accurately.
3. **Cel state:** missing/unallocated cel, allocated blank cel and populated cel are distinct. Normal selection or pixel edit must not silently allocate a missing cel.
4. **Opacity:** the v2 model stores layer opacity, but the current main composite path does not apply it. Do not expose a functional opacity slider until the rendering and export composition contract applies opacity consistently.
5. **Palette names:** the current v2 palette is HEX-only. GPL/JSON names may appear in import preview, but cannot be described as persisted unless a separate project schema/versioning decision adds that support.
6. **Frame order:** timeline order is the default playback and all-frames export order. Explicit selected frame IDs retain the user's order and must not be silently sorted.
7. **GIF limits:** timing rounds to 10 ms centiseconds; GIF transparency is binary; palette overflow can quantize; module output budgets are enforced. The UI must disclose these before encoding.
8. **Renderer status:** PR #6's isolated Canvas renderer is merged, but the DOM renderer remains the active production path. A browser-tested isolated module does not authorize switching the live surface.

## 4. Current dependency and PR state snapshot

This is a planning snapshot of the latest state reviewed for AC-054. It must be refreshed by the coordinator before assigning a specific integration slice.

### 4.1 Foundation and safety

| Contract / PR | Current status reviewed | What it unlocks | Remaining gate |
|---|---|---|---|
| Recovery snapshot fix · PR #10 | Merged | Reliable recovery after editing and import/save workflows | Preserve recovery assertions in all later E2E changes |
| Agent API/MCP hardening · PR #8 / AC-004 | Open draft; current PR metadata reports not mergeable. Agent 4 reports a previously green full browser/MCP run on an earlier synced head | Optional agent-driven editing and later export/pixel-tool adapters | Refresh latest main, reconcile shared E2E, rerun Node/Chromium/MCP; resolve timeout and cross-process limitations in AC-043/044 before claiming broader concurrency |
| Layer safety guard · PR #14 / AC-015 | Open and currently not mergeable against its old base | Fail-closed target validation for Clear/import/cel edits | Refresh to current main and revalidate exact current head |
| Expanded safety contract · PR #23 / AC-055 | Open, stacked on PR #14 | Stale revision, selection and metadata checks | Do not merge before parent #14; validate the combined parent/child contract |
| Safe edit transactions · AC-056 | Assigned to Agent 6, not yet reviewed as an accepted module at this snapshot | Atomic/immutable pixel and structural mutation operations | Wait for exact API, tests and no-mutation evidence before wiring editor paths |
| Import staging / adversarial audit · AC-057/059 | Assigned to Agent 6 | Safe import and recovery semantics | UI must consume the accepted stage/commit contract; do not mutate the active project during preview |

**Product consequence:** safe Clear, image import, cel clear/paste and any destructive palette or transform workflow must not be integrated against an informal or duplicated guard. Use Agent 6's accepted guard/transaction modules after they are synchronized and validated.

### 4.2 Canvas rendering and navigation

| Contract / PR | Current status reviewed | What it unlocks | Remaining gate |
|---|---|---|---|
| Canvas renderer · PR #6 | Merged as isolated module | Candidate Canvas rendering backend | DOM renderer remains active; no automatic UI switch |
| Browser renderer validation · PR #18 / AC-028 | Open draft; seven dedicated Chromium assertions and one benchmark run are reported separately; workflow does not invoke that dedicated runner | Raster parity, overlay and pointer mapping evidence | Refresh latest main; reproduce dedicated browser runner and record environment/raw timings; no general speedup claims from one runner |
| Viewport utility · PR #34 / AC-034 | Open draft; prior Node/Chromium/MCP CI reported green on its submitted head | Pure pan/zoom/fit/reset and coordinate transform functions | Sync latest main, rerun exact tests, accept deterministic API/serialization and DPR contract |
| Renderer state adapter · PR #43 / AC-035 | Open draft; latest reported Node tests passed, browser/MCP run was still in progress at the last detailed status | Project v2 → renderer mapping, opacity/visibility/onion composition and revision invalidation | Wait for all exact-head CI jobs; test partial alpha limitation and frame/onion invalidation |
| Visual/accessibility pack · AC-036 | Agent 2 active | Browser tests for DPR/focus/overlays/resize/teardown | Required before any live renderer switch |
| Large-canvas characterization · AC-037 | Agent 2 queued | Measured limits and performance/memory evidence | Do not turn a single sample into a general speed claim |
| Integration readiness · AC-038 | Agent 2 queued | Isolated viewport+adapter+renderer demo and fallback contract | Must not edit index.html without a coordinator UI lock |

**Product consequence:** implement AC-049 controls against the accepted viewport API, but retain the current DOM renderer as fallback until AC-028 and AC-034–038 evidence is complete and the coordinator explicitly authorizes the live switch.

### 4.3 Animation and export

| Contract / PR | Current status reviewed | What it unlocks | Remaining gate |
|---|---|---|---|
| GIF encoder · PR #11 / AC-011 | Merged | Native-size GIF Blob, frame timing/loop/transparency/diagnostics | No production download UI exists; maintain format warnings and output caps |
| Sprite-sheet PNG · PR #3 | Open draft, old base | Native-size atlas PNG | AC-027 real-browser full-raster PNG decode and metadata verification |
| Grid/layout contract · PR #21 / AC-039 | Open draft, stacked on PR #3 | Layout/margin/spacing/metadata planning | Parent dependency #3 and exact combined tests |
| Export planner/manifest · PR #22 / AC-040 | Open draft; branch based on GIF merge head | All/range/custom ordered frame selection, deterministic preflight and JSON manifest | Refresh current main, run exact tests, verify planner preserves explicit ID order |
| Export compatibility/stress · AC-041 | Agent 3 queued | Format/size/timing/metadata confidence | Exact full-output tests and budget rejection before allocation |
| Integration contract · AC-042 | Agent 3 queued | One exporter contract shared by browser UI and optional Agent API | Do not duplicate encoding; coordinate with Agent 4 before API adapter work |

**Product consequence:** GIF is the first production-ready encoder module, but its editor UI remains a separate deliverable. Sprite-sheet UI should wait for AC-027/039/040. Never offer a “Cancel” control until the encoding path has a real cancellable contract.

### 4.4 Palette and color operations

| Contract / PR | Current status reviewed | What it unlocks | Remaining gate |
|---|---|---|---|
| GPL/JASC-PAL/JSON parser · PR #16 / AC-017 | Open, ready; previous exact-head run reported 75 Node tests plus Chromium and MCP success | Import/export parsers and serializers | Refresh current main and rerun before merge; add UI preview/atomic apply separately |
| Palette analysis · AC-067 | Agent 8 queued | Used/unused/duplicate/color usage report | Read-only deterministic output, no automatic mutation |
| Color conversion/ramp · AC-068 / PR #33 | Separate module phase; source-owned by Agent 8 | Deterministic conversion/ramp utilities | Exact rounding/tie-breaking tests and no-mutation evidence |
| Palette transformations · PR #39 / AC-069 | Open draft | Immutable reorder/dedupe/merge/replace transformations | Verify preview/commit separation and source immutability |
| Extraction/mapping · PR #45 / AC-070 | Open draft | Extract colors and map project pixels to a palette | Exact impact report; nearest-color suggestions require explicit user approval |
| Palette accessibility/fixtures/contracts · AC-071–073 | Agent 8 queued | Accessible reports and stable integration API | Complete format corpus, diagnostics, limits and no silent mapping |

**Product consequence:** the import UI must show format, source order, duplicates, parse diagnostics, name-loss and current artwork-color impact before Apply. Preserve duplicate/order behavior unless the user explicitly chooses a transformation. The current v2 project does not persist palette/color names; do not promise that it does.

### 4.5 Optional tool families

| Workstream | Modules / PRs / queue | UX dependency |
|---|---|---|
| Tile preview and seamless workflows | PR #13 / AC-016, Agent 7 AC-061–066 (tile transforms, map data, diagnostics, atlas plan, fixtures and integration contract) | Add a non-destructive repeat-preview toggle and diagnostics only after transform/map contracts are accepted; never write preview pixels into project cels |
| Pixel-art craft tools | PR #15 / AC-019; PR #31 primitives / AC-080; PR #37 region operations / AC-081; PR #44 color / AC-082; AC-083–086 transforms, dithering, fixtures and contracts | Offer preview/commit flows; do not apply partial results on failure; do not move these tools into the main UI until algorithms are deterministic, bounded and documented |
| Project diagnostics | PR #12 / AC-018; Agent 9 AC-074–079 batch, diff, deep diagnostics, migration preview and CI reports | Keep the inspector read-only/offline; use as a developer/QA workflow, not as an automatic editor repair feature |
| Bridge/API adapters | Agent 4 AC-043–048 | Only after shared modules are accepted; require revision tokens, bounded payloads, explicit read/write semantics and separate E2E coverage |

## 5. Prioritized implementation sequence

The following is the recommended order for production UI slices. It is not an assignment of files or a grant of UI ownership. The coordinator must appoint one integrator and issue the shared-file lock before implementation.

### Phase A — Safety, focus and command foundation

**P0 · Correctness and data safety**

**Slice A1 — Keyboard/focus routing and accessible state**

- Correct global shortcut routing before adding more shortcuts.
- Preserve text/browser/OS shortcuts, protect dialog/menu/editable contexts, and keep IME/AltGraph unhandled.
- Expose tool, swatch, layer, frame and playback states programmatically.
- Give icon-only actions explicit accessible names.
- Strengthen focus indicators and text contrast.
- Add stable save/error status announcements and field-associated errors.
- Verify native dialog focus containment/restoration and any fallback path.
- Keep the responsive shortcut/help reference available on small screens.

**Dependencies:** AC-026, AC-052; latest-source audit and a coordinator-granted UI lock.  
**Primary validation:** keyboard interaction suite, accessible name/state assertions, focus/contrast checks, manual screen-reader and 320px/400% zoom checks.  
**Why first:** every later workflow adds controls, state and dialogs. Fixing the focus router and announcement patterns first avoids multiplying inaccessible interactions.

**Slice A2 — Fail-closed editing and import commits**

- Integrate accepted Agent 6 target guard and safe transaction modules.
- Route Clear, image import, brush/eraser/fill, selection paste and cel operations through the same target/revision checks.
- Keep import as stage → preview → validate → explicit commit/cancel.
- Do not create missing cels implicitly in a pixel mutation path.
- Preserve the Project Library recovery/undo behavior and make failed commits non-mutating.

**Dependencies:** PR #14 and #23 accepted/rebased; AC-056 transaction API; AC-057/058 adversarial/browser evidence; AC-059 import staging. Agent 4's AC-004 must be accepted before any bridge write adapter is wired.  
**Primary validation:** hidden/locked/zero-opacity/stale/missing/sparse/undefined cel cases; exact no-mutation assertions; undo/redo; autosave/recovery; actual Chromium import and edit paths.  
**Why second:** safety must be established before adding more destructive cel, palette or algorithm actions.

### Phase B — Editing foundation and workspace

**P1 · Core editing usability**

**Slice B1 — Canvas navigation and responsive workspace**

- Add distinct Fit, Actual Size and manual zoom actions.
- Add cursor-anchored zoom, bounded pan and explicit Hand mode.
- Keep browser zoom gestures browser-owned.
- Preserve the view through panel resize in Manual mode; recompute in Fit mode.
- Expose the viewport name/instructions, zoom state and focus route.
- Keep the existing DOM renderer as fallback until renderer parity and acceptance gates pass.

**Dependencies:** PR #34 AC-034 accepted; PR #43 AC-035 accepted with complete CI; PR #18/AC-028 and AC-036–038 browser evidence; coordinator UI lock.  
**Primary validation:** exact pointer-to-logical-pixel mapping at DPR 1/1.25/1.5/2, browser zoom, resize/panel changes, 512×512 edge reach, pixel fidelity and no artwork/history mutation.  
**Why early:** large-canvas access is an everyday editing capability and can be integrated independently of palette/export UI once the viewport contract is stable.

**Slice B2 — Layer/frame/cel matrix**

- Replace separate anonymous layer/frame selectors with a clear layer-row × frame-column matrix.
- Distinguish populated, allocated-blank and unallocated cels.
- Add explicit create cel, select, clear, copy and paste actions.
- Add layer/frame add, duplicate, rename, reorder and protected delete workflows.
- Expose visibility, lock and opacity states; opacity is not complete until composition and exports use the same blend semantics.
- Add thumbnails with visible-region rendering/caching rather than eagerly allocating or rendering 8,192 expensive thumbnails/cels.
- Separate stopped/playing/paused preview from the editing frame.

**Dependencies:** AC-050 accepted; Agent 6 AC-055/056 safe transaction contract and AC-058/060 tests; Agent 3 AC-040 stable frame-order/metadata contract; adapter opacity/onion composition acceptance; coordinator UI lock.  
**Primary validation:** stable IDs and unrelated cels after reorder/duplicate/delete, exact undo/redo, missing-vs-blank states, accessible matrix navigation, max 32 layers/256 frames and no eager 8,192-cel allocation.  
**Why next:** this is the core animation editing workflow; export selection and order should derive from the same timeline state.

### Phase C — Palette and delivery workflows

**P1 · Production workflows**

**Slice C1 — Palette import, editing and export**

- Add GPL/JASC-PAL/JSON file import with full parse preview and stable diagnostics.
- Offer explicit Replace, Append All, Add Unique and Cancel; no silent dedupe.
- Report duplicates, missing used colors and name/metadata loss.
- Keep project pixels unchanged when the palette list changes.
- Add keyboard-accessible color removal and readable swatch labels.
- Add export choice and explicit format metadata disclosure.

**Dependencies:** PR #16 AC-017 accepted; AC-067–073 analysis/conversion/transformation/mapping/fixtures/contracts accepted; any project-model metadata persistence change requires a separate schema/versioning decision; coordinator UI lock.  
**Primary validation:** round trip for all formats, malformed/oversized files, 1–4,096 color limits, duplicates and source order, no mutation on cancel/failure, name-loss warning and project/cel immutability.

**Slice C2 — Animation export UI**

- Add All Frames / Current Frame / Range / Explicit Ordered Selection.
- Add sprite-sheet layout, rows/columns, margin/spacing, transparency/background and companion JSON preview.
- Add GIF loop, duration rounding, binary transparency, palette quantization, output-size and frame-pixel budget disclosures.
- Reuse the accepted export planner and encoders; do not copy encoder logic into UI handlers.
- Show preflight before large allocation and only show progress/cancel when implemented.

**Dependencies:** merged GIF exporter PR #11; AC-027/039/040 accepted with real-browser PNG/GIF full-raster and metadata evidence; AC-041/042 format/budget/docs; Agent 4 AC-004 and AC-047 only if Agent API/MCP export adapters are included; coordinator UI lock.  
**Primary validation:** full decoded pixel equality; frame order/duration/loop/transparency; sheet rects/margins/spacing; metadata correspondence; 16 MiB GIF and 1,048,576 selected frame-pixel budgets; project immutability.  
**Why after timeline:** export UI should use the timeline's stable order and frame IDs rather than invent another selection model.

### Phase D — Optional creative tools

**P2 · Extend after core workflows**

**Slice D1 — Seamless tile workflows**

- Add repeat preview as a view-only overlay/toggle.
- Add edge and corner diagnostics with reports, not silent repair.
- Later add tile transforms/map stamping/atlas layout only after those contracts are accepted.
- Do not allow preview pixels to enter saved cels or exports.

**Dependencies:** Agent 7 AC-061–066 accepted; renderer contract; coordinator UI lock.  
**Primary validation:** wrap-around edge/corner fixtures, non-mutation, touch/pointer boundaries and exported raster isolation.

**Slice D2 — Pixel-art craft tools**

- Start with the most useful tools: symmetry, outline, fill/region, palette map and gradients.
- Each tool presents preview → inspect impact → explicit commit/cancel.
- More advanced transforms/dithering/shading follow after raster primitives and stress corpus.

**Dependencies:** Agent 10 AC-080–086 modules and fixtures; Agent 6 safe transaction API; coordinator UI/API locks.  
**Primary validation:** deterministic golden buffers, exact integer boundaries, bounded memory/runtime, malformed input rejection, no partial commits and undo.

**Slice D3 — Developer diagnostics**

- Keep the project inspector CLI and future batch/diff diagnostics offline and read-only.
- Link to developer documentation or export a diagnostic report only after the CLI schema is accepted.
- Do not add auto-repair or a large diagnostic dashboard to the core editor.

**Dependencies:** Agent 9 AC-074–079 accepted. This is a developer/QA workflow rather than a prerequisite for ordinary drawing.

### Phase E — Release polish and capability disclosure

**Slice E1 — Consolidated accessibility and UX verification**

- Re-run the AC-052 audit against the integrated editor, not just the old source snapshot.
- Verify keyboard/focus/ARIA/contrast/status/dialog/reduced-motion behavior for every new flow.
- Test responsive states and accessible names for dynamic matrix/swatches/export controls.
- Update the canonical keyboard reference to match the implemented matrix and viewport contexts.

**Slice E2 — Feature and documentation consistency**

- Update feature lists and help text only after the corresponding UI and browser journey are integrated.
- Clearly label optional/offline tools, unsupported format behavior and export limits.
- Do not describe isolated modules, demos or static prototypes as shipped editor features.

## 6. Shared-file ownership and integration protocol

### Production UI

- **index.html remains coordinator-controlled.** No PR in this roadmap implicitly grants an edit lock.
- Coordinator appoints one UI integrator for a defined implementation slice and a specific time/file scope.
- That integrator must take a fresh main base, make one coherent UI change, run the matching test matrix, open a PR, and release the lock in their handoff before another worker edits the file.
- Agent 4 owns bridge/API code and bridge-related index.html edits. If AC-004 or later bridge/API work touches index.html, coordinate the shared window with the UI integrator; do not edit simultaneously.
- Static prototype files under docs/ux/prototypes are references only and must not be copied into production without a separate review of semantics and responsive behavior.

### Test and workflow files

| Path | Current lock / rule |
|---|---|
| agent-bridge/e2e-test.mjs | Agent 4 sole writer while PR #8 / AC-004 is reconciled. Use new focused UX test files for other work. |
| .github/workflows/project-tests.yml | Agent 3 owns the AC-027 sprite-sheet browser verification/CI wiring until explicitly released in status. Agent 2 may prepare/run harnesses but must not edit the workflow meanwhile. |
| tests/editor-interactions.test.js | Do not extend without its assigned owner/coordinator permission; create dedicated test files for new workflows. |
| project-model.js / project storage | Shared foundation; no UI integrator changes schema or recovery without a specific assigned scope. |

### Module ownership

- Agent 2: renderer, viewport, adapter, renderer browser validation/benchmarks.
- Agent 3: GIF/sprite-sheet exporters, export planner and exporter workflow while AC-027 lock is active.
- Agent 4: Agent API, MCP bridge, bridge E2E and security/reliability.
- Agent 6: layer/edit guard, safe transactions, import staging and safety audit.
- Agent 7: tile transforms/map/diagnostics/atlas planning.
- Agent 8: palette formats, analysis, transforms, extraction and mapping.
- Agent 9: read-only project inspector and diagnostics.
- Agent 10: pixel algorithms/primitives/regions/color/transforms/dithering.
- Agent 5: UX specifications, audit, prototypes and integration sequence—not production UI unless a later coordinator assignment grants it.

## 7. Required release gates for every UI slice

A slice is not ready to merge merely because it renders once or its unit tests pass.

### Gate 1 — Contract and branch readiness

- Every consumed module PR is accepted/merged or explicitly approved for a tested stacked integration.
- Feature branch is synchronized with latest main without force.
- The UI integrator owns the shared file for the slice; no other agent overlaps.
- Document any known limitations (e.g. GIF alpha/timing, renderer fallback, palette name persistence).

### Gate 2 — Correctness and non-mutation

- Unit tests cover successful and failed operations.
- Invalid/stale/hidden/locked/missing targets fail closed.
- Undo/redo restores exact IDs, order, buffers and metadata.
- Cancel/failure leaves project pixels, history, revision and saved state unchanged.
- Pixel art and exports remain nearest-neighbor/exact; preview overlays never enter output.

### Gate 3 — Real browser workflow

- Node 24: run the project test suite on the exact feature head.
- Run Chromium editor E2E for the actual user workflow.
- Run MCP E2E if the slice exposes/changes Agent API or MCP behavior.
- Run dedicated browser tests for renderer, PNG/GIF decoding, pointer/DPR, touch, download and accessibility cases where applicable.
- Record exact commit SHA and workflow run URL. Never reuse an earlier green run after the base/head changes.

### Gate 4 — Accessibility and responsive behavior

- Keyboard-only path succeeds from entry to completion; no action is pointer-only.
- Focus is visible and not lost after panel/dialog/row/frame changes.
- Accessible names and selected/pressed/disabled/preview states are programmatically exposed.
- Small text meets the appropriate contrast target; UI/focus indicators are measured against rendered backgrounds.
- Screen-reader behavior is manually sampled for the grid, matrix, status, errors, dialogs and playback state.
- Responsive reflow works at 320 CSS px and at high browser zoom; no essential controls are hidden.

### Gate 5 — Product communication and rollback

- UI labels and help text match actual implemented behavior and supported limits.
- Feature flags/fallbacks are not falsely presented; keep DOM renderer available until Canvas integration gates pass.
- No backend/network dependency is introduced for core flows.
- Release note distinguishes new UI from isolated module capability.
- Known limitations and retry/recovery path are explicit.

## 8. First user-visible release candidate

The first coordinated UI release should focus on a small set of high-value outcomes rather than the full queue.

1. **Editing safety:** correct focus routing, safe Clear/import/cel edits, visible lock/hidden/opacity state and undoable commit.
2. **Canvas usability:** Fit/Actual-size/pan and reliable access to every edge at large canvas dimensions.
3. **Animation editing:** layer/frame/cel matrix with clear active target, thumbnails/states, timing and playback preview.
4. **Asset delivery:** reliable GIF and sprite-sheet export with order/timing/transparency/metadata/budget preview.
5. **Palette interoperability:** local GPL/JASC-PAL/JSON import/export with loss-aware preview and explicit merge choices.

Tile preview, advanced pixel effects and extended diagnostics can follow after the primary drawing/timeline/export journeys are solid. These are valuable but are not prerequisites for a usable first release.

## 9. Coordinator actions and next 5 steps

1. **Resolve current module PRs and stale bases** in ownership order: Agent 3's AC-027 workflow/PNG verification; Agent 4's PR #8 reconciliation; Agent 6's parent #14 then stacked #23; then Agent 2 renderer/viewport/adapter evidence. Require exact-head tests after sync.
2. **Choose one UI integrator and issue a narrow index.html lock** for Phase A1/A2. Explicitly release the lock before the next slice.
3. **Accept Agent 6 guard/transaction and Agent 2 viewport/adapter contracts** before assigning destructive edit or Canvas UI integration.
4. **Approve the timeline/export/palette integration windows** after the related Agent 3/8 module contracts and browser tests are accepted. Keep exporter, palette parser and API logic in their modules.
5. **Run an integrated accessibility/production review** using AC-052 and each feature's matrix; only then update FEATURES/README and call the corresponding workflows shipped.

## 10. Definition of done

AC-054 is ready for coordinator review when:

- All six Agent 5 specification/audit/prototype phases are linked and reconciled.
- Current module PR states, dependencies and limitations are distinguished from shipped integrations.
- UI slices are ordered by user value and safety dependency.
- Shared index.html, bridge E2E, workflow and module ownership are explicit.
- Each slice has acceptance/test/release gates and fallback expectations.
- No production code or shared files are changed by this roadmap.
