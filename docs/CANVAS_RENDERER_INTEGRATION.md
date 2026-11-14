# Canvas renderer integration readiness

## Purpose and decision boundary

This package demonstrates composition of four independent parts:

1. **ProjectModel v2** remains the document source of truth.
2. **CanvasViewport** owns CSS-space pan, bounded zoom, fit/reset, coordinate mapping and DPR conversion.
3. **CanvasRendererAdapter** converts a consistent v2 project snapshot into HEX/null pixels, frame identity, composite revision and onion-neighbor masks.
4. **CanvasPixelRenderer** draws the raster and its separate grid/selection/onion overlays.

It is an isolated engineering demo, not a production editor integration. The coordinator owns production UI integration and `index.html`; Agent 2 supplies specialist contracts, browser validation and review.

## Dependencies and stacked branch

- Renderer prototype: merged PR #6, `js/canvas-renderer.js`.
- Viewport utility: merged PR #34, available from `main`.
- State adapter: merged PR #43, available from `main`.

The AC-038 branch has been retargeted to `main` after merging the latest main ancestry. Its diff contains only the isolated demo, integration contract and demo tests; it no longer adds a duplicate viewport module.

## Run the demo

Serve the repository root:

```sh
python3 -m http.server 8000
```

Open:

`http://localhost:8000/demos/canvas-renderer-integration.html`

The page constructs a small 32×24 v2 sample project with three frames and two layers. Controls switch active frame, grid, selection and onion-before/after; fit, actual-size, button zoom, pointer-anchored wheel zoom and pan are implemented. The canvas preview has a programmatic name and is keyboard focusable. Arrow keys pan, plus/minus zoom, Home fits, and 1 resets to actual size.

The demo has a bounded DOM fallback for initialization/adapter/render failure. It is intentionally only 32×24: it illustrates fallback semantics without creating an unbounded pixel grid. Failure is surfaced in the status strip. The live application renderer is untouched.


## Automated Chromium interaction evidence

A dedicated runner is committed at `tests/canvas-renderer-integration-demo.browser.mjs`. It inlines the four local module files into the demo page before calling Playwright `page.setContent()`; this keeps the test local-first and also works in restricted environments where Chromium navigation to a local HTTP origin is blocked.

Reproduce from the repository root after installing the existing bridge Playwright dependency and Chromium:

```sh
cd agent-bridge
npm install --ignore-scripts
npx playwright install chromium
node ../tests/canvas-renderer-integration-demo.browser.mjs
```

The local real-browser run used Python Playwright with the **exact demo HTML from the PR branch** and the **exact ProjectModel, viewport, renderer and adapter source files fetched from main**. Browser: Chromium **144.0.7559.96**, headless Linux. Context matrix: DPR **1, 1.25, 1.5 and 2**.

For each DPR context, the run verified:
- v2 sample project creation (32×24, three frames, two layers);
- Canvas renderer initialization and logical buffer dimensions;
- accessible canvas name and role;
- onion-after mask composition on the first frame;
- active-frame switching and redraw;
- grid, selection and onion toggles;
- zoom button, fit, actual-size, Home/1 keyboard navigation and pointer-wheel zoom;
- ResizeObserver refresh with DPR retained and full redraw;
- explicit renderer cleanup and backing-buffer reset.

Result: **4/4 DPR contexts passed, 0 page errors**. A separate fallback context intentionally omitted the Canvas renderer module and verified that the 32×24 DOM fallback rendered all **768 cells**, hid the Canvas element, showed the fallback grid and produced 0 page errors. The committed Node Playwright runner was added for reproducibility; it was not invoked in this local runtime because Node Playwright is not installed here. The Python Playwright run is the actual local interaction evidence.

The existing repository workflow also passed on the previous AC-038 head, but that standard editor/GIF/MCP workflow does not itself open this standalone demo. The dedicated run above is separate evidence.

## Coordinate and resize contract

- Project dimensions are logical pixel units.
- Viewport pan offsets, displayed canvas dimensions and pointer positions are CSS pixels.
- DPR applies only when creating visible/overlay backing stores.
- The visible canvas CSS size is logical dimensions × viewport scale; its CSS position is the viewport `offsetX/offsetY`.
- Pointer positions are first translated to viewport-local CSS coordinates using the viewport DOMRect, then transformed into project space. Never use backing-store coordinates as project pixel positions.
- Wheel zoom anchors at the pointer; toolbar and keyboard zoom anchor at viewport center.
- A ResizeObserver watches the viewport. On resize the host calls `resizeViewport()`, refreshes DPR and renderer `displayWidth/displayHeight`, then performs a full render. Viewport resizing preserves the logical point at the viewport center subject to edge clamping.

## Invalidation contract

The demo calls `buildRendererState(project, {expectedActiveFrameId, onionSkin, grid, selection})` for each render. The adapter's `frameId` and `compositeRevision` change for active frame, background, layer order, visibility, opacity and enabled onion-neighbor identities. Such structural changes require full redraw.

Ordinary pixel edits keep the structural revision stable and may use dirty rectangles only when exact affected bounds are known. AC-037 measured a material cost for repeated one-pixel dirty calls because the current Canvas renderer validates the complete source array on every `render(state, dirtyRect)` call. Do not use a dirty-call-per-pixel brush path until that cost is addressed or measured input latency justifies it.

The renderer snapshots onion masks; in-place neighbor pixel edits change their contents and force full redraw. Grid and selection remain on a separate overlay surface and must not enter project artwork pixels.

## Fallback and failure behavior

A production host should:
- keep the DOM renderer active until all adoption gates pass;
- catch renderer construction/runtime failure and redraw from the authoritative project state in the DOM fallback;
- never make Canvas buffers the source of truth;
- never silently matte invalid/partial-alpha pixels or discard project information;
- keep fallback when Canvas support is unavailable, allocation fails or pixel parity is uncertain;
- release observers, ImageData and offscreen surfaces on teardown.

The adapter rejects final partially transparent pixels because the current renderer accepts only opaque HEX or transparent null. An RGBA renderer or an explicitly chosen matte/background policy is required to represent those pixels; never silently discard alpha.

## Keyboard and accessibility contract

Canvas does not automatically preserve the current per-pixel DOM grid's accessibility. Production rollout must retain:
- an accessible canvas/editor name and description;
- a predictable tab stop, visible focus, and a reliable path out of the canvas;
- keyboard commands for every editing action previously supported by the grid;
- a programmatic representation of the active pixel/cell and selection region;
- announcements for active frame/layer, selection bounds and meaningful denials;
- pointer-transparent decorative overlays (`pointer-events:none`);
- DOM-grid or equivalent accessible fallback until specialist QA demonstrates parity.

This demo supports keyboard viewport navigation only. It does not implement editing commands or screen-reader pixel/cell interaction and is not production accessibility evidence.

## Resize, lifecycle and cleanup

1. Observe the viewport container (ResizeObserver preferred).
2. Read CSS dimensions from the current DOMRect/layout.
3. Call `resizeViewport()` with current DPR.
4. Update canvas CSS position/dimensions and renderer `displayWidth`, `displayHeight`, `devicePixelRatio`.
5. Full-render after backing-store recreation.
6. On unmount/pagehide disconnect observers and call `renderer.destroy()`.

Repeated mount/unmount, project close/reopen, memory trends and allocation-failure fallback must be browser-tested before production use.

## Adoption gates before any renderer switch

The coordinator owns the decision and production UI. An isolated demo or open PR does not satisfy these gates.

| Gate | Required evidence |
|---|---|
| Module acceptance | PR #34 viewport and PR #43 adapter reviewed and merged; partial-alpha limitation understood |
| Pixel parity | Full raster comparisons at supported sizes; frame/layer/order/opacity/onion cases; exports and project state unchanged |
| Pointer correctness | Fractional CSS and DPR 1, 1.25, 1.5 and 2, including browser/container resize |
| Dirty updates | Brush/eraser/fill-like workloads characterized; per-call full-array validation cost addressed or justified with measured latency |
| Frame budget | Multiple devices and browser versions; p50/p95 of actual editor workflows, not renderer-only times |
| Accessibility | Keyboard editing parity, focused-cell/selection semantics, screen-reader review, visible focus and DOM fallback |
| Overlay correctness | Grid, selection, cursor and tool overlays remain outside artwork and do not intercept input |
| Lifecycle/memory | Resize, DPR changes, repeated mount/unmount, project reopen/close, memory trend and allocation-failure fallback |
| Full editor E2E | Drawing, selection, layers, frames, onion skin, undo/redo, recovery, import/export and playback on exact integration head |
| Release | Coordinator-authored UI PR merged to main; Pages deployment succeeds; published editor inspected |

## Current recommendation

**Defer production Canvas renderer replacement.** Full-redraw and overlay results are promising in one Chromium runner, but AC-037 exposed a serious repeated-dirty-call cost, and two 512×512 dense DOM cases could not be measured to completion. The current studies are not end-to-end editor evidence. Keep the DOM renderer active until the dirty path and the gates above are addressed in the coordinator's UI-03 work and the later AC-088 production-editor-versus-renderer study.

## Scope

This package adds an isolated demo and contract only. It does not modify `index.html`, production CSS, project model, renderer core, Agent API, MCP, bridge or GitHub Actions workflow. The demo is an engineering fixture, not the redesigned production editor.
