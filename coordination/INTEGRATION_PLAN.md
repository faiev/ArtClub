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

## UI-00 / AC-091 acceptance and merge — 2026-11-14

- Agent 5's [PR #77](https://github.com/faiev/ArtClub/pull/77) was accepted and squash-merged as `a229a8c0028dc4290c3f5da811fa565fc3a17610`. It adds only the workstation design system, standalone prototype and review document under `docs/ux/**`.
- The coordinator accepted the graphite/olive workstation direction; the prototype's non-production limitations remain explicit. Agent 5 continues to own only `docs/ux/**`; production `index.html` ownership remains with the coordinator.
- The four WebP viewport captures are reported as attachments in Agent 5's handoff, but are not committed to the repository or visible in this coordinator session. This is recorded as agent-reported Chromium review rather than independently inspected screenshot evidence.

## UI-01 current production candidate — post UI-00 merge

- Coordinator PR [#84 — UI-01: Introduce the production workstation shell](https://github.com/faiev/ArtClub/pull/84) remains open and unmerged. Previous tested head: `c955acae6ae8a5e11f4b4f5cc689884362c3002e`; exact-head run [#43622555688](https://github.com/faiev/ArtClub/actions/runs/43622555688) passed both Node/editor and Chromium editor/GIF/MCP jobs.
- UI-01's only changed files remain `index.html` and `tests/ui-workstation-shell.test.js`. It preserves the existing DOM-grid renderer, project model/storage, live tool/selection/layer/frame/timeline/palette/import/export/project-library/save/recovery commands and Agent API scripts. It does not add placeholder menus, synthetic cel matrix, renderer replacement or new export functionality.
- PR #77's merge moved main after PR #84's previous tested base. The coordinator is refreshing PR #84 with a non-force merge and will rerun exact-head CI before further review/merge decisions.
- Specialist reviews remain assigned: Agent 1 (12-flow task QA), Agent 2 (canvas viewport/pointer sizing and responsive layout), Agent 5 (production visual-design review). At this update, their independent review responses are not yet recorded.
- GitHub Actions does not emit screenshot artifacts for the shell workflow. Automated interaction tests pass on the previous candidate; independent 1440×900 and 1280×800 visual inspection remains an explicit review gate.
- Production `index.html` on main remains blob `1a29a9eca58d9035287af1ff58b97f2ff4040a69`; no production shell has merged to main or been published. After PR #84 merge, inspect the GitHub Pages deployment and live editor before claiming release.

## UI-01 post-UI-00 exact-head validation — 2026-11-14

- UI-00 / AC-091 is accepted and merged via PR #77 as `a229a8c0028dc4290c3f5da811fa565fc3a17610`.
- PR #84 was synchronized non-force against the post-UI-00 coordination main. Current reviewed branch head: `fa5c105ce8f98043f92e18cab33f9cfa0d4d21f8`; main base at sync: `2551198bde4cb528ff84b0ff908b478abcb2c1fc`; compare: 10 ahead / 0 behind; changed-file scope: `index.html` and `tests/ui-workstation-shell.test.js` only.
- Exact-head Actions [#43623647840](https://github.com/faiev/ArtClub/actions/runs/43623647840) completed successfully. Node/editor test job and real Chromium browser job passed, including animated GIF decode and MCP client E2E.
- The earlier canvas clipping regression was fixed by constraining `#pixelGrid` to the available viewport; the real-browser drawing assertion now passes on the current head.
- Independent reviews remain pending: Agent 1 must report the 12-flow task matrix; Agent 2 must report canvas geometry/pointer/responsive checks; Agent 5 must review fidelity of the actual production implementation to the now-merged design system. No agent status file has yet recorded these review outcomes.
- The workflow did not publish screenshot artifacts. Automated browser behavior is green, but explicit 1440×900 and 1280×800 visual screenshot review remains outstanding.
- Current `main` production `index.html` remains unchanged at blob `1a29a9eca58d9035287af1ff58b97f2ff4040a69`; PR #84 is not merged. No production redesign or GitHub Pages publication is claimed.

## UI-01 final validation snapshot — 2026-11-14

- UI-00/AC-091 merged separately as PR #77 (`a229a8c0028dc4290c3f5da811fa565fc3a17610`).
- Current UI-01 application/test tree was validated on branch head `64d68de63abae730623ac81b670562a950d66759`, based on main `2158b11245905dc3de458784b63f7c0e391e9df2`; PR source diff is exactly `index.html` and `tests/ui-workstation-shell.test.js`.
- Exact-head workflow [#43623873430](https://github.com/faiev/ArtClub/actions/runs/43623873430) completed successfully. Node test job: **241 passed, 0 failed**. Browser job: real Chromium editor E2E, animated GIF ImageDecoder and MCP client E2E all passed.
- Verified browser log detail: drawing, undo/redo, agent batch, layers, custom canvas, real animation playback, onion skin, PNG, IndexedDB library and reload recovery passed; GIF ImageDecoder checked every pixel of both decoded frames including transparent disposal overlap; MCP E2E passed drawing, layers, selections, animation frames, playback modes, onion skin, pixel readback, PNG preview, save and input validation.
- The first candidate's clipped first-pixel drawing regression was fixed before this final run. The current tested tree includes the `#pixelGrid` viewport constraint.
- Specialist reviews are still outstanding: Agent 1's independent 12-flow task matrix, Agent 2's viewport/pointer/responsive review and Agent 5's production visual-design review. The existing workflow does not emit desktop screenshots, so manual 1440×900 / 1280×800 visual evidence remains open. Do not mark these review gates complete from the standard E2E result.
- Current production `index.html` on main remains the original blob `1a29a9eca58d9035287af1ff58b97f2ff4040a69`; PR #84 is not merged and no published workstation redesign is claimed.

## UI-01 production release — merged and deployed (2026-11-14)

- **PR #84** merged successfully as `e22ddb35ebf802b3b719e74a7329effceab28747`.
- Production `index.html` on main is now blob `4645281c1aad8580529e7feb99cd299a88543913` (the prior production blob was `1a29a9eca58d9035287af1ff58b97f2ff4040a69`). The production workstation shell is now part of main.
- Pre-merge exact-head CI [#43624220195](https://github.com/faiev/ArtClub/actions/runs/43624220195) passed. Post-merge push test workflow [#43624328658](https://github.com/faiev/ArtClub/actions/runs/43624328658) also passed both Node and Chromium/GIF/MCP jobs.
- GitHub Pages build/deploy [#43624328006](https://github.com/faiev/ArtClub/actions/runs/43624328006) completed successfully on merge commit `e22ddb35...`; build, artifact upload and deployment steps all passed. Deploy log reported environment URL: [https://faiev.github.io/ArtClub/](https://faiev.github.io/ArtClub/).
- **Visual verification limitation:** direct fetching of the public Pages URL is blocked in this coordinator session. Deployment status and the target commit are verified, but a rendered-page screenshot/visual inspection is not claimed. Ask a reviewer with browser access to inspect the published site at 1440×900 and 1280×800 and report any clipping/density issues.
- Specialist reports (Agent 1's 12-flow matrix, Agent 2's responsive/pointer review, Agent 5's production visual review) were requested but had not yet appeared in their status files at the time of merge. The functional suite is green; keep these manual reviews as post-release QA follow-up and fix any verified issues in a new narrowly scoped PR.
- Scope remains UI shell only: original DOM-grid renderer, project model/storage, commands, data behavior, local-first architecture and current exports are preserved. No renderer switch, schema migration, bridge, server/backend or new tool capability was included.

## Coordinator reset — 2026-11-15 (authoritative addendum)

### UI-01 verified state
UI-00 / AC-091 is merged via PR #77. UI-01 production shell is merged via PR #84 as e22ddb35ebf802b3b719e74a7329effceab28747. Exact-head project/browser workflow passed on PR head dee2e96ff2c3cf9b1927570d4248d95114f113c6 in run #43624220195. Pages deployment for the merge commit succeeded in run #311 (43624328006).

PR #87 was subsequently merged as 9296ca08e1e8143bb5b82c0ad48608e9c9a0b344; this is a docs-only screenshot caption correction. Pages run #319 (43629304356) for the main containing that merge was in progress at the last query. Do not claim that post-#87 main is deployed until the run succeeds and the live URL is inspected.

### UI-02 — next active product milestone
The production editor has not yet been wired to the accepted safe-edit guard/transaction modules:
- Toolbar Clear mutates the active pixel buffer directly and says “Clear canvas”, although it clears only the active cel.
- Selection Clear directly nulls pixels after only a visible/unlocked check; zero opacity is not rejected through the guard.
- Image import decodes asynchronously and writes to live pixels without complete staging and final target revalidation.
- Selection paste clips to canvas bounds and writes directly instead of rejecting a partial transaction.

Coordinator owns the narrow production integration PRs and is sole writer of index.html. Agent 1 owns QA-only coverage; Agent 6 reviews safety integration but may not change production UI; Agent 5 provides docs/design/accessibility guidance; Agent 4 is consulted only if bridge/API changes are required.

Implementation order: (A) guarded active-cel Clear + selection Clear; (B) staged asynchronous image import with pre/post-decode target checks and rollback; (C) atomic selection paste/replace. Every slice needs focused tests and real Chromium editor coverage. Do not claim the helper modules alone provide persistence rollback. Preserve project, undo/redo and saved storage on failure. Do not fabricate separate project/frame/composite counters from the existing single documentRevision.

All agents must reconcile their own status to actual PR state and exact heads. Existing PRs may be reviewed/synchronized where useful, but no new AC-087–096 feature expansion takes priority over UI-02. Workflow and bridge E2E locks remain with their named owners until explicitly released.

Current public app URL: https://faiev.github.io/ArtClub/
Main before this coordination commit: 1c4b1e439b6ac816c0e81ffb94c8dd4324859df2
Open PR count in the immediately preceding snapshot: 62 (re-query live state).
