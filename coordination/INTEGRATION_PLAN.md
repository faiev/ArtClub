# One Pixel Studio — Production UI integration and release plan

Coordinator-owned plan. Updated: 2026-11-14.
Repository: `faiev/ArtClub`.
Deployment: GitHub Pages from `main` at repository root.

## Objective

Stop optimizing for the number of isolated modules and PRs. The next release milestone is a visibly improved, functional production editor. Modules, specifications and prototypes only count as delivered to users after they are integrated into the production editor, tested as complete workflows, merged to `main`, and confirmed on the published GitHub Pages site.

## Ownership model

- **Coordinator is sole production UI integrator and sole writer of `index.html`** until an explicit handoff is recorded. Production CSS and UI wiring in that file follow the same lock.
- **Agent 5 is design owner, not production UI owner.** Complete AC-091 as a standalone interactive prototype and design system under `docs/ux/**`. Coordinator reviews and approves the design before production wiring begins.
- **Specialist agents** continue their assigned modules and provide integration contracts, tests, risks and review support. They do not edit `index.html` or production CSS as part of their current assignments.
- **Agent 1** supplies release QA and task-based regression scenarios.
- **Agent 2** reviews viewport/renderer wiring and supplies browser validation. No production Canvas renderer switch without parity and performance evidence.
- **Agent 3** reviews export UI wiring and supplies decoder/output validation.
- **Agent 6** reviews safe mutation wiring and supplies guard/transaction/staging test cases.
- **Agent 4** reviews Agent API/bridge compatibility if production commands are exposed. The bridge E2E ownership lock remains unchanged.
- UI integration PRs are coordinator-authored unless the coordinator explicitly issues a temporary single-writer lock to another agent. Locks are file-specific and must be released explicitly.

## Release policy

Pause expansion of new feature backlog as a team priority. Existing AC-087–096 assignments remain documented but are not the immediate release focus; do not start them ahead of current critical work and production integration planning.

A feature is not complete for users merely because:
- a module exists on a feature branch;
- a PR is open;
- unit tests pass;
- a static prototype exists;
- a documentation page describes the behavior.

A user-visible release requires:
1. implementation wired into the live editor;
2. clear interaction and error states;
3. exact regression coverage;
4. successful Node and real-Chromium editor E2E on the integration head;
5. any relevant specialist browser/decoder/MCP tests;
6. merged commit on `main`;
7. successful GitHub Pages deployment and direct inspection of the published app.

## Integration milestones

### UI-00 — Design approval and implementation contract

**Lead:** Agent 5 (AC-091), coordinator review.

Deliver:
- high-fidelity, interaction-aware workstation prototype;
- design tokens, density, component and interaction-state rules;
- desktop 1440×900 and compact 1280×800 layouts;
- task flows for drawing, layer/frame editing, importing and exporting;
- written mapping from prototype elements to existing production commands and available specialist modules.

Exit gate:
- coordinator reviews the complete prototype at actual dimensions;
- no placeholder controls that imply unavailable behavior;
- design and scope are approved before production UI wiring.

### UI-01 — Workstation shell: first visible redesign

**Lead:** Coordinator. **Review:** Agent 5 and Agent 1; Agent 2 for canvas-area constraints.

Target:
- replace the promotional/editorial hero layout with a compact creative-workstation structure;
- introduce a restrained menu/document bar, persistent tool rail, dominant canvas viewport, docked inspector and bottom timeline region;
- keep current working editor commands and project data behavior intact;
- apply the palette and visual system approved at UI-00. The AC-091 submission currently proposes graphite/olive chrome; do not silently force the older warm-light palette or combine an unreviewed theme change with functional migration. Keep pixel artwork visually dominant and retain verified focus/contrast states;
- ensure desktop and compact layouts, keyboard focus, useful labels and sensible panel collapse.

Do not:
- replace the active renderer merely for visual reasons;
- remove existing capabilities;
- introduce nonfunctional timeline cells, fake tabs, decorative badges or placeholder menus;
- redesign the project model or storage.

Exit gate:
- existing drawing, selection, layers, timeline, playback, save/recovery, import and export smoke tests remain functional;
- real Chromium screenshots and task walkthrough reviewed;
- a visible difference is confirmed on the actual published Pages site.

### UI-02 — Editing safety integration

**Dependencies:** reviewed/current safety contracts from PR #14, #23, #26, #48 and #49.

**Lead:** Coordinator. **Specialist reviewer:** Agent 6. **QA reviewer:** Agent 1.

Integrate safe target validation and immutable operations into high-risk paths in this order:
1. toolbar Clear / selection clear;
2. asynchronous image import with preview, target capture and revalidation;
3. selection paste/replace paths;
4. later pixel-effects apply/commit workflows.

Requirements:
- locked, hidden, zero-opacity and stale targets produce explicit non-mutating denials;
- invalid import never partially changes active cel or project;
- async completion revalidates the target and revision before commit;
- undo/redo and autosave/recovery remain correct;
- every failure path preserves source pixels/project state.

Exit gate:
- tests assert both the denial message and byte-for-byte source immutability;
- Chromium tests exercise the real UI paths, not only isolated helpers.

### UI-03 — Canvas navigation and renderer decision

**Dependencies:** reviewed viewport/adapter PRs #34/#43 and Agent 2's current AC-037/038 evidence.

**Lead:** Coordinator. **Specialist reviewer:** Agent 2. **QA reviewer:** Agent 1.

First integrate reliable navigation (fit, actual-size, bounded zoom, cursor-anchored zoom and pan) without forcing a renderer migration.

Canvas renderer replacement is a separate gated decision:
- full raster parity at supported dimensions;
- correct pointer mapping at fractional CSS sizes and DPR;
- overlay/accessibility/focus parity;
- frame and onion invalidation correctness;
- repeated representative benchmark results, not one isolated run;
- fallback remains available until the new renderer passes the complete gate.

Exit gate:
- canvas remains usable at min/max supported dimensions and narrow desktop windows;
- no artwork pixels change due to UI overlays, zoom or panning.

### UI-04 — Timeline, layers and palette workflow

**Dependencies:** Agent 5 specs; Agent 6 safe-edit contract; current project model; reviewed Agent 8 palette contracts. Any model changes require a separate explicit plan.

Target:
- move from a simple strip of frame cards to a clear layer/frame/cel workspace;
- expose active frame, active layer, visibility, lock and cel presence without ambiguity;
- add thumbnails only when they are real, stable and correctly invalidated;
- improve palette import/merge/replace preview and error reporting using accepted palette parsers;
- keep old workflows operational and avoid silently creating/editing the wrong cel.

Exit gate:
- full frame/layer selection, visibility, lock, reorder, undo/redo and save/reload flows tested in Chromium.

### UI-05 — Export and release workflows

**Dependencies:** PR #3 → #21 → #55 sprite-sheet chain; PR #22 planner; merged GIF exporter PR #11; Agent 3 export contract.

Target:
- expose GIF and sprite-sheet export in a coherent dialog;
- allow clear frame range/order/layout/timing settings supported by planner;
- show bounds, progress, cancellation/error states and download completion;
- preserve existing PNG/SVG/project export controls;
- independently decode produced files in browser tests.

Exit gate:
- real files are decoded and validated independently;
- cancellation never reports or downloads partial output;
- project state remains unchanged after exports.

## PR and release discipline

- Coordinator opens narrow UI integration PRs against the latest `main`; do not mix UI-01 through UI-05 in one enormous PR.
- A UI integration PR should cite the specialist module PRs/commits it consumes and list exact user-visible changes.
- Run existing root Node tests, Chromium editor E2E, GIF/browser decoders where relevant, and MCP tests where command contracts may be affected.
- Test the exact PR head after any merge-base update.
- Merge only after source/diff review, tests and dependencies are clear.
- After merge, verify GitHub Pages deployment and inspect the actual published URL. If deployment is pending or failed, report that plainly rather than treating main merge as publication.
- Maintain a short release note that separates user-visible features from internal engineering work.

## First execution sequence

1. Agent 5 completes AC-091 prototype; coordinator reviews and requests corrections if needed.
2. Coordinator creates UI-01 production shell PR, retaining all currently working editor actions.
3. Agent 1 prepares the UI-01 smoke-test checklist and later verifies actual browser workflows.
4. Agent 2, Agent 5 and Agent 6 review the corresponding UI changes in their specialties.
5. Once UI-01 is merged and Pages is verified, start UI-02 safety integration. Keep UI-03/04/05 ordered by dependency and test readiness.

## Current status

- UI-00: AC-091 submitted as draft PR #77 and under coordinator review. Coordinator source mapping is in `coordination/UI_01_SOURCE_MAP.md`. Pending accessible screenshot evidence / corrected screenshot references, accessible labels for read-only controls and palette file input, explicit disclosure of prototype-only Line/Rectangle Select behavior, and a status update synchronized to the latest feature head. No production UI authorization yet.
- UI-01: queued; production UI owner is coordinator.
- UI-02: contracts and modules submitted across open PRs; coordinator review/dependency acceptance required.
- UI-03: viewport and adapter modules submitted; renderer remains separate until evidence gate.
- UI-04: interaction specification submitted; production integration not started.
- UI-05: export modules/planner submitted or in progress; visible UI integration not started.

This plan is a product-delivery commitment, not a claim that any of these milestones are already implemented or published.


## Coordinator live integration update — 2026-11-14

### UI-00 decision
The coordinator has accepted the AC-091 visual direction for production work under decision D-026: compact graphite/olive workstation, canvas-first hierarchy, restrained panels, warm visible focus and reduced promotional chrome. This does not complete or accept Agent 5's full prototype handoff. PR #77 remains draft until its stale status, missing screenshot references and documented accessibility/interaction limitations are reconciled. Agent 5 remains limited to docs/ux/**.

### UI-01 production candidate
- **Coordinator PR:** [#84 — UI-01: Introduce the production workstation shell](https://github.com/faiev/ArtClub/pull/84).
- **Exact tested head:** 29e348f4073d63bf2819332b4faa5ea7bf19461c.
- **Scope:** index.html and tests/ui-workstation-shell.test.js only.
- **Behavior preservation:** Existing DOM grid #pixelGrid, project model/storage, tool and selection handlers, timeline/frame CRUD, playback, layers, palette, import/export, project library, save/recovery and Agent API remain in place. No renderer swap, schema migration, bridge or workflow change.
- **Layout:** compact application bar, existing live tool controls in a left dock, central canvas with constrained grid geometry, existing live inspector at right and actual timeline/playback below the canvas. Graphite/olive theme, focus color and responsive/reduced-motion rules are added.
- **Exact-head CI:** [run #43620892261](https://github.com/faiev/ArtClub/actions/runs/43620892261) completed successfully on the exact tested head. Both test and browser-e2e jobs passed; browser job includes the real editor E2E, GIF decoder and MCP client check.
- **Regression fixed:** The first run on the earlier head found that a large pixel grid could overflow the fixed-height workspace and clip the first pixel. The CSS now constrains the live grid to the viewport while preserving the per-project aspect ratio; the refreshed exact-head browser job passed.
- **Status:** draft, not merged. Visual review at 1440×900 and 1280×800, Agent 1 task-based QA review, Agent 2 canvas sizing review and Agent 5 design review remain requested. Do not claim publication until merged and the Pages deployment is inspected.

The PR branch must be synchronized with coordination-only main advances before final merge review; re-run CI on the resulting exact head. UI-02 safety wiring, renderer replacement, the synthetic cel matrix and new export UI are explicitly outside this first shell slice.


## UI-01 live coordinator update — 2026-11-14 (exact-head revalidation)

- [PR #84](https://github.com/faiev/ArtClub/pull/84) is now **ready for review** (not merged). Current tested branch head: `129d168bcbfb73653612de515706574533766426`; base main: `e5a1cc9223b463e284847791e59622dfc59290c4`; diff: 7 commits ahead / 0 behind, two changed files only.
- Exact-head Actions run [#43622060710](https://github.com/faiev/ArtClub/actions/runs/43622060710) passed both jobs: Node/editor tests and real Chromium E2E, including GIF ImageDecoder and MCP client integration.
- The initial drawing regression on the first candidate was corrected by constraining `#pixelGrid` to the available canvas viewport while preserving its inline project aspect ratio. The earlier exact-head run #43621240342 also passed; run #43622060710 is the latest validation after the branch sync.
- Review assignments appended to `coordination/assignments/agent-1.md`, `agent-2.md` and `agent-5.md`: Agent 1 must execute/report the 12-flow QA matrix; Agent 2 must review viewport/pointer sizing and responsive behavior; Agent 5 must review visual-system fidelity and reconcile its own AC-091 prototype handoff. Those reviews are requested, not yet received.
- **Visual limitation:** Actions run #43622060710 produced no screenshot artifacts. Automated functional E2E is green, but independent screenshots at 1440×900 and 1280×800 have not yet been inspected. The PR is open for specialist review and is not approved for merge until the visual/QA gate is complete.
- Production `index.html` on main remains unchanged at blob `1a29a9eca58d9035287af1ff58b97f2ff4040a69`; no published UI change is claimed. After review and merge, GitHub Pages deployment and the live URL must be inspected.

This update supersedes the earlier UI-01 status that referenced head `29e348...` / run #43620892261 and the draft state. Do not treat prior runs as validation of a newer head.

## UI-01 exact-head update — 2026-11-14

- The review branch was synchronized non-force with the latest assignment/board/plan coordination commits. Current tested head: `15afac17d1598b46479877266fbf65f8351d35af`; current main base at this sync: `1116ddaef1670208ce0b1000acce389dfc43d116`; comparison: 8 commits ahead / 0 behind; changed-file scope remains `index.html` plus `tests/ui-workstation-shell.test.js`.
- Exact-head workflow [#43622262911](https://github.com/faiev/ArtClub/actions/runs/43622262911) completed successfully. Node/editor and Chromium jobs passed; the browser job's real editor E2E, animated GIF decoder and MCP client steps all passed.
- PR #84 is ready for review, not merged. Agent 1/2/5 review tasks are now written to their assignment files. Their independent review findings have not yet arrived, and no visual screenshot artifact was produced by Actions.
- Current production `index.html` on main is still unchanged. Do not claim Pages publication until a later merge and deployment inspection.