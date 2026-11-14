# Canvas renderer state adapter contract

## Purpose

`js/canvas-renderer-adapter.js` converts a version 2 `one-pixel-studio` project into the isolated renderer's flat `{width, height, pixels, frameId, compositeRevision, onionBefore, onionAfter}` input. It is a view adapter: it does not mutate project state, store a second document model, or change `project-model.js`.

Browser global: `ArtClubCanvasRendererAdapter.buildRendererState(project, options)`.

CommonJS: `require("./canvas-renderer-adapter.js")`.

## Composition rules

- Layers are read in project order, bottom-to-top.
- Invisible layers, zero-opacity layers and transparent cel pixels do not contribute.
- Missing layer/frame cels are transparent.
- Opaque pixels replace the composite; fractional layer opacity uses deterministic source-over compositing with premultiplied channels and rounds final RGB channels to nearest integer.
- The active frame is the only primary render frame. A caller can pass `expectedActiveFrameId` to reject an asynchronous/stale render request. An explicit `frameId` must match `project.activeFrameId`.
- Onion neighbors are the immediately previous and next entries in `project.frames`. `onionSkin: true` requests both; an object can request `{before: true, after: false}`. Missing neighbors return `null`.
- All selected-frame and requested-neighbor cel arrays are checked for exact dimensions, sparse slots, undefined entries and malformed colors before output is returned. Project structure, cel references and duplicate layer/frame cel pairs are also validated.

## Partial-alpha limitation

The existing CanvasPixelRenderer input contract permits only opaque `#RRGGBB` pixels or transparent `null`; it has no per-pixel alpha channel. The adapter therefore resolves layer opacity against an opaque lower layer or an opaque `canvas.background`. If a final composite pixel is still partially transparent, it throws rather than silently discard alpha or choose a matte color. A later renderer API that supports RGBA can remove this limitation without changing the project model.

## Invalidation contract

The returned `frameId` is the active frame ID. The deterministic `compositeRevision` signature includes:
- project ID and canvas background;
- active frame ID;
- ordered layer IDs, visibility and opacity;
- enabled onion-skin sides and their neighboring frame IDs.

This forces a full renderer redraw when active frame, layer order, visibility, opacity, background, or onion-neighbor identity/enablement changes. It deliberately excludes pixel content: ordinary cel pixel edits should retain the same revision, and callers may pass a dirty rectangle only when they know the edited composite bounds.

When onion masks are included, CanvasPixelRenderer also snapshots and compares their actual contents. Thus an in-place pixel edit in a neighboring frame changes the onion mask and forces a full redraw even when the structural revision remains stable.

Changes to the project model or renderer API are outside this adapter. Callers must build the state from a consistent project snapshot and use `expectedActiveFrameId` when asynchronous work might finish after the user switches frames.

## API

```js
const state = ArtClubCanvasRendererAdapter.buildRendererState(project, {
  onionSkin: { before: true, after: true },
  grid: true,
  selection: null,
  expectedActiveFrameId: project.activeFrameId
});
renderer.render(state); // structural changes or initial render
renderer.render(state, { x: 4, y: 7, width: 1, height: 1 }); // only accurate local pixel edits
```

No editor/UI, `index.html`, project model, Agent API, MCP, bridge or workflow integration is performed by this module.
