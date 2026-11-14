# Layer-edit safety guard

## Scope and current behavior audit

The editor stores `visible` and `locked` flags on each layer. Its current `isActiveLayerEditable()` helper resolves the active layer and returns true only when the layer exists, is visible, and is not locked. That check is used by several existing editing paths, but it is not yet a shared module and not every write path calls it.

| Operation/path | Existing protection at the base commit | Finding |
|---|---|---|
| Pointer brush, eraser, fill, line, rectangle and ellipse | Checks `isActiveLayerEditable()` before a drawing gesture begins | Hidden and locked active layers are rejected for normal pointer drawing |
| Keyboard canvas drawing | Checks `isActiveLayerEditable()` before painting/filling | Hidden and locked active layers are rejected |
| Selection move, transform, cut, clear and paste | Calls `isActiveLayerEditable()` before changing pixels | Hidden and locked active layers are rejected; copy, marquee selection and deselect are read/selection operations |
| Browser Agent API drawing commands, including `clear_canvas` | `executeAgentCommands()` checks `isActiveLayerEditable()` before applying the command batch | The boolean check rejects hidden and locked layers. Its current error wording mentions only “locked”, even when the layer is hidden |
| Toolbar **Clear canvas** | Confirms, then directly replaces the active `pixels` buffer with a blank buffer | **No visibility/lock check**; this is an uncovered write path |
| **Import image** | Decodes and quantizes the image, then writes `pixels = next` in `img.onload` | **No visibility/lock check**, including at the asynchronous write/commit point |
| Whole-project open/import and starter-art replacement | Replaces the complete project/document rather than editing one layer cel | These are document-replacement operations, not active-layer pixel edits; this guard does not block them |

The guard in this deliverable is deliberately not wired into `index.html`, the browser Agent API or the MCP bridge. Therefore, this pull request does **not** fix the live Clear or image-import bypasses. The coordinator should assign a follow-up integration task with the required shared-file ownership before wiring it in.

## Module contract

`js/layer-edit-guard.js` is a dependency-free plain-JavaScript module. It exposes a browser global, `ArtClubLayerEditGuard`, and a CommonJS export for Node tests.

### `resolveEditableTarget(project, options?)`

Returns a structured result and never mutates the document or creates a missing cel.

Success:

```js
{
  ok: true,
  reason: null,
  message: "The target layer and cel are editable.",
  layerId: "...",
  frameId: "...",
  layer: /* target layer object */,
  frame: /* target frame object */,
  cel: /* existing target cel object */
}
```

Denial:

```js
{
  ok: false,
  reason: "LAYER_LOCKED",
  message: "The target layer is locked and cannot be edited.",
  layerId: "..."
}
```

Stable denial codes are exported in `REASONS`. They distinguish malformed options/documents, missing or ambiguous targets, inactive layer/frame IDs, malformed layer flags, hidden and locked layers, missing cels and malformed cel buffers.

The editor's current mutation model edits only the active layer and active frame. Omitted IDs resolve to those active IDs; explicitly supplied IDs must also refer to the active layer/frame. A target cel must already exist and its pixel buffer must match the canvas dimensions. Every expected pixel index must be an own array entry containing explicit `null` or a six-digit HEX color; sparse holes and explicit `undefined` are rejected. Validation uses indexed iteration because JavaScript array callbacks such as `.some()` skip sparse holes. The guard fails closed for malformed targets and does not use `ensureCel()` as an implicit side effect.

### `assertEditableTarget(project, options?)`

Convenience form for imperative edit paths. Returns the same successful resolution, or throws `LayerEditDeniedError` with stable `error.code` and `error.reason` values matching `REASONS`.

## Integration examples

Load the module after `project-model.js` in the browser, or require it from a Node-side caller:

```js
const decision = ArtClubLayerEditGuard.resolveEditableTarget(projectDoc);
if (!decision.ok) {
  const error = new Error(decision.message);
  error.code = decision.reason;
  throw error;
}

// Perform the edit only after the guard succeeds.
// Keep the editor's active pixel buffer and the resolved cel synchronized.
```

A Clear implementation should guard before recording history or changing pixels:

```js
const target = ArtClubLayerEditGuard.assertEditableTarget(projectDoc);
remember();
target.cel.pixels = Array(projectDoc.canvas.width * projectDoc.canvas.height).fill(null);
// Then synchronize the active `pixels` buffer and render/save as appropriate.
```

Image import must check again at the asynchronous commit point, not only when the file is selected. The active layer can change, become hidden, or become locked while the image is decoding:

```js
img.onload = () => {
  let target;
  try {
    target = ArtClubLayerEditGuard.assertEditableTarget(projectDoc);
  } catch (error) {
    URL.revokeObjectURL(url);
    toast(error.message);
    return;
  }
  // Quantize image data, then update target.cel and the active editor buffer.
};
```

The Agent API should use the same guard at the mutation boundary for every command that writes pixels. It should convert `error.code` into a structured API error rather than relying on message matching. The existing API drawing preflight currently performs an equivalent boolean check, but it does not share this module yet.

## Tests and limitations

Run the focused suite with:

```sh
node --test tests/layer-edit-guard.test.js
```

The tests cover successful active targets, explicit active IDs, missing layers, hidden layers, locked layers, inactive layer IDs, missing cels, malformed documents/buffers, sparse pixel holes, explicit `undefined`, malformed HEX colors, valid `null`/HEX pixels, zero/malformed opacity, malformed frames, duplicate IDs/cels, stale revisions by dimension, revision-context shape, selection bounds, canvas limits, non-mutation on denial and structured thrown errors.

This is an isolated contract library, not a live editor fix. No browser verification or integration behavior is claimed in this deliverable.


## AC-055: expanded edit-target contract

The guard can optionally enforce three independent optimistic-concurrency tokens. Supply both `expectedRevisions` and `currentRevisions`; each must contain non-negative safe-integer `project`, `frame` and `composite` fields:

```js
const decision = ArtClubLayerEditGuard.resolveEditableTarget(projectDoc, {
  expectedRevisions: { project: 18, frame: 4, composite: 12 },
  currentRevisions: { project: 18, frame: 4, composite: 12 },
  selection: { x: 2, y: 3, width: 5, height: 4 }
});
```

If a caller supplies only one revision object, omits a token, or supplies a non-integer/negative token, the guard returns `REVISION_CONTEXT_INVALID`. A mismatched token returns a dimension-specific denial: `PROJECT_REVISION_STALE`, `FRAME_REVISION_STALE` or `COMPOSITE_REVISION_STALE`. For compatibility, callers that provide neither object do not request revision enforcement; production mutation adapters should supply both.

`selection` is optional. Omitted or explicit `null` means no selection; otherwise it must be a non-empty integer rectangle wholly inside the canvas. Invalid coordinates, dimensions and bounds return `SELECTION_INVALID`.

Canvas dimensions are bounded at 512 × 512. Layer opacity must be finite and within [0, 1]; an opacity of zero returns `LAYER_ZERO_OPACITY`. Target frame names and durations are checked before a cel is granted.


## AC-056: immutable safe-edit operations

`js/safe-edit-operations.js` builds a complete new project state only after the shared layer guard and all operation payloads pass validation. The caller's project, target cel and supplied buffers are never mutated.

Available helpers:

- `clearActiveCel(project, options?)`: clears the whole active cel when no selection is supplied, or only the validated selection rectangle.
- `applyPixelPatches(project, patches, options?)`: applies a batch of unique `{x, y, color}` patches. Patches must be integer canvas coordinates and use `null` or a valid HEX color. If a selection is supplied, every patch must fall inside it.
- `replaceActiveCel(project, pixels, options?)`: replaces the active cel only after validating exact canvas length, own array slots, and every null/HEX value.
- `applyResultBuffer(project, pixels, options?)`: the same validated replacement boundary for symmetry, outline, fill or other algorithm result buffers.

Every helper delegates target, opacity, selection, canvas and optional revision checks to `ArtClubLayerEditGuard`. A success returns `{ ok: true, project, layerId, frameId, changedPixels }`, where `project` is a deep detached copy with the complete new cel. A denial returns `{ ok: false, reason, message }` and never returns a partially changed project.

The module preserves sparse array shape during deep cloning and rejects cyclic/non-data project values with `PROJECT_CLONE_FAILED`. It has no storage, UI, browser API or network side effects.


## AC-058: browser safety harness

Run the isolated browser harness from the repository root:

```sh
node tests/layer-safety.browser.mjs
```

The runner uses a local Chromium/Chrome executable. Set `CHROMIUM_PATH` when it is not in a standard location. The page loads the real project model, layer guard and safe-edit operations. It verifies denial behavior for hidden, locked and zero-opacity layers, stale revisions, missing cels, invalid payloads and out-of-canvas selections. For each denial it compares the serialized project and composed raster before and after. It also checks that a successful transaction changes only the returned detached project.

The harness uses project serialization and the project model's composed RGBA-source pixel array as saved-state/export invariants. It does not claim to exercise the live editor's IndexedDB adapter or its PNG download button; those remain integration/browser-E2E responsibilities after the shared UI lock is granted.
