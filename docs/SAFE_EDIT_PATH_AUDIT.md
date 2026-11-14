# Safe-edit mutation-path audit

**Phase:** AC-057  
**Source snapshot:** \`main\` at \`ba1f36a59f08135127af6a03737f7bf92d8ade9c\`  
**Scope:** read-only audit of the browser editor, project model and Agent API. No application source or shared UI/API files are modified by this deliverable.

## Executive summary

The editor has a partial active-layer protection model. Pointer and keyboard painting, selection pixel mutations, and Agent API drawing batches check the active layer's \`visible\` and \`locked\` flags before mutating the active pixel buffer. The guard is not consistently applied across all writes.

Two direct browser paths bypass that check:

1. **Toolbar Clear** directly replaces the editor's active \`pixels\` buffer with a blank buffer without checking visibility, lock or revision. Its confirmation text says it clears every pixel on the canvas, but the write is to the current active layer/frame cel buffer.
2. **Image import** waits for \`img.onload\`, then writes the converted raster directly to the editor's current \`pixels\` buffer. It does not check visibility, lock or revision at the asynchronous commit point. Since the handler reads mutable editor globals after decoding, a layer/frame/canvas/palette change made while the image decodes can alter the import target or conversion context.

The existing protection helper also does not check opacity. The project model supports layer opacity from 0 through 1, including zero, but \`isActiveLayerEditable()\` checks only existence, visibility and lock. The isolated AC-055 contract now rejects zero-opacity layers, but existing editor call sites still use the older boolean helper until a separately authorized integration phase wires the module in.

## Path-by-path findings

| Operation | Current protection | Revision / validation behavior | Finding |
|---|---|---|---|
| Pointer brush and eraser | Pointer-down checks \`isActiveLayerEditable()\` before starting the stroke (\`index.html:1797–1813\`) | Snapshot/history is recorded before paint; no explicit revision token for human input | Hidden/locked active layers are rejected. Zero opacity is not considered by the current helper. |
| Pointer bucket/flood fill | Same pointer-down active-layer check, then \`remember()\` and \`floodFill()\` (\`index.html:1806–1808\`) | Uses the current canvas buffer; no explicit expected revision | Hidden/locked active layers are rejected, but the operation is not routed through an immutable transaction boundary. |
| Pointer line/rectangle/ellipse | Same pointer-down check; shape preview is committed on pointer-up (\`index.html:1806–1813\`, \`1850–1852\`) | One undo snapshot is recorded at gesture start | Hidden/locked active layers are rejected. The guard is not rechecked at pointer-up; while drawing, normal frame/layer switching is blocked. |
| Keyboard brush/eraser/fill | Keyboard cell handler checks \`isActiveLayerEditable()\` before painting/filling (\`index.html:1865–1885\`) | Uses current buffer and one history snapshot | Hidden/locked active layers are rejected. Zero opacity is not checked. |
| Selection move/transform | \`moveSelectionPixels()\` and \`transformSelection()\` check active-layer editability (\`index.html:682–740\`) | Selection rectangle is validated as integer/non-empty/in-canvas by \`setSelectionRect()\` (\`673–680\`) | Hidden/locked active layers are rejected. Canvas bounds are validated for selection and rotation. |
| Selection cut/clear/paste | Each pixel-changing helper checks active-layer editability (\`index.html:750–783\`) | Cut copies first, then records history and clears; paste clips the clipboard to remaining canvas space | Hidden/locked active layers are rejected. Paste truncates to fit rather than rejecting a partially out-of-bounds clipboard. |
| Selection copy / marquee / deselect | No pixel-edit guard | Selection bounds are validated for explicit rectangles; marquee uses in-canvas pointer coordinates | These are read/selection-state operations, not pixel writes. Copy should remain usable on locked/hidden layers. |
| Toolbar **Clear** | **No active-layer guard** (\`index.html:1983–1985\`) | No revision check; confirms then records history and assigns \`pixels=blank(w,h)\` | **Bypass.** Can clear a locked or hidden active layer. It clears only the active cel buffer, despite “every pixel on this canvas” wording. |
| Image import | **No active-layer guard** (\`index.html:2046–2068\`) | **No expected revision or captured target identity** at \`img.onload\` | **Bypass and async-target race.** Decoding may complete after the user changes active layer/frame, canvas size or palette. The handler writes to whichever active \`pixels\` buffer/global context exists at completion. |
| Undo / redo | No active-layer guard (\`index.html:625–626\`) | Restores complete project snapshots through \`restore()\` / \`loadProjectIntoEditor()\` (\`596–615\`) | Whole-project history restoration, not a single-layer edit. It can restore locked/hidden layer content because it restores prior document state. Treat as an explicit document/history transaction, not as a normal pixel-edit call. |
| Human frame switch | No active-layer editability check (\`index.html:984–994\`) | Blocks while a stroke is active; uses \`ProjectModel.ensureCel()\` | Navigation does not paint existing pixels, but it can create a missing blank cel as a structural side effect. It clears selection state. |
| Human layer switch | No active-layer editability check (\`index.html:1108–1117\`) | Blocks while a stroke is active; uses \`ProjectModel.ensureCel()\` | Navigation should permit selecting hidden/locked layers so users can inspect/unlock them. It can create a missing blank cel. Subsequent painting is guarded. |
| Agent API drawing batch, including \`clear_canvas\` | Checks active-layer editability before applying the batch (\`index.html:1417–1429\`) | Checks \`expected_revision\` only when the caller supplies it; validates commands, snapshots, and rolls back on an exception (\`1426–1466\`) | Hidden/locked active layers are rejected. Missing \`expected_revision\` disables stale-write protection. \`clear_canvas\` clears the active cel, not every layer/frame. Zero opacity is not checked. |
| Agent API selection mutations | \`assertAgentSelectionAction()\` checks stroke/playback and optional \`expected_revision\`; pixel helpers perform active-layer checks (\`1646–1706\`) | Selection bounds checked by \`setSelectionRect()\`; expected revision is optional | Pixel mutations inherit the active-layer guard. Copy/marquee/deselect are non-pixel operations. |
| Agent API layer/frame navigation and metadata | \`assertAgentLayerAction()\` / \`assertAgentFrameAction()\` block active drawing/playback and check optional \`expected_revision\` (\`1552–1560\`, \`1699–1706\`) | Selecting a layer/frame can call \`ensureCel()\`; metadata operations change structure/flags | These are not direct pixel edits. They need revision protection when supplied, but do not generally enforce that the selected layer itself is visible/unlocked because selecting it is how the user can manage it. |
| Agent API project import/open | Deserializes and replaces the entire document (\`1514–1532\`) | Candidate project is deserialized before replacing the live editor; save occurs around replacement | Whole-document replacement, not an active-cel edit. It belongs to the import-staging/recovery phase, not the layer pixel guard alone. |

## Shared primitives and contract gaps

### Existing active-layer helper

\`isActiveLayerEditable()\` resolves the active layer and returns true when it exists, is visible and is not locked (\`index.html:567–570\`). It does not inspect opacity. The project model's \`makeLayer()\` sets opacity to 1 and \`validateProject()\` accepts numeric opacity from 0 through 1 (\`js/project-model.js:41–48\`, \`208–210\`). Thus, a zero-opacity layer can pass current UI/API editability checks even though new pixels are not visible.

### Revision model

The editor maintains one in-memory \`documentRevision\`. \`scheduleSave()\` increments it (\`index.html:1261–1268\`); explicit selection changes also increment it. \`getAgentStatus()\` and canvas/pixel readbacks expose that token (\`1476–1494\`, \`1500–1512\`). Agent drawing, selection, layer and frame operations compare \`expected_revision\` only when supplied. There are no separate persisted frame-revision or composite-revision counters in the project document or current status payload.

The expanded AC-055 guard therefore accepts project/frame/composite expected/current tokens from its caller; this is an opt-in contract until an integration adapter owns the source and lifecycle of those counters.

### Sparse project/cel validation

The new guard validates every active-cel pixel slot with indexed own-property checks. The current project-model validator still uses array callbacks such as \`.some()\` to inspect cel colors. Such callbacks skip sparse holes. The import-staging phase must validate candidate project arrays independently before a project object is deserialized/cloned or committed; do not rely on the current model validator alone to detect sparse object-array slots.

## Integration recommendations (no integration performed here)

1. **Clear:** route the button through \`clearActiveCel(projectDoc, { expectedRevisions, currentRevisions, selection })\`; commit only the returned project/cel after success. Decide separately whether the user-facing button means “clear active cel” or a true multi-layer/frame document operation.
2. **Image import:** parse/decode/quantize into a detached candidate buffer. Capture project/layer/frame IDs and revision tokens when the operation begins, then resolve/validate them again at the asynchronous commit point. Use import staging plus \`replaceActiveCel()\`; discard the candidate on any stale-target denial.
3. **Pointer / keyboard / fill / shapes:** keep gesture ownership and UI feedback in the editor, but route final pixel changes through the safe-edit transaction boundary. Avoid committing preview or partial output before complete validation.
4. **Selection paste/cut/clear/move/transform:** pass the validated selection bounds and expected/current revisions. Preserve exact integer coordinates; reject malformed clipboard buffers before creating a new state.
5. **Agent API batch:** require the expected project revision for mutating calls, resolve the active target once, validate all commands and result buffers, then publish one complete new state. Preserve atomic rollback and structured denial reasons.
6. **Undo/redo:** define and test a separate whole-project history-restore contract. Validate the entire snapshot before replacing live state; do not silently weaken it into an active-layer check.
7. **Layer/frame navigation:** retain the ability to select hidden/locked items. Make any \`ensureCel()\` creation explicit and atomic, and distinguish this structural operation from permission to edit the target pixels.

## Ownership and limits

This is a read-only source audit. It does not modify \`index.html\`, project model/storage, Agent API, bridge files, or tests. It does not claim browser behavior beyond what is established by source inspection. The actual fixes require separate coordinator-authorized UI/API file locks; the assigned Agent 6 phases stop at isolated modules, tests, browser harness and integration documentation.


## Current-main revalidation — UI-01 production shell

**Revalidated against:** `main` commit `1c4b1e439b6ac816c0e81ffb94c8dd4324859df2`  
**Production source blob:** `index.html` `4645281c1aad8580529e7feb99cd299a88543913`  
**Method:** read-only source inspection of the current merged production editor after UI-01. This addendum supersedes the older `index.html` line references above for the paths listed here.

The UI-01 workstation shell changed the layout and moved handlers, but the audited editing-safety gaps remain in the current production source:

| Current source location | Path | Revalidated finding |
|---|---|---|
| `index.html:830–833` | `isActiveLayerEditable()` | The helper still accepts a layer when it exists, is unlocked and visible. It does not reject zero opacity. |
| `index.html:1022–1029` | `clearSelectedPixels()` | Selection clear checks the older boolean helper before mutating pixels; it still has no expected-revision token or immutable transaction boundary. |
| `index.html:1031–1046` | `pasteSelection()` | Paste checks the older boolean helper, then clips the clipboard to fit and mutates the active pixel buffer in place. A partial out-of-bounds paste is truncated rather than denied. |
| `index.html:2246–2249` | Toolbar Clear | The handler confirms, then calls `remember()` and assigns `pixels=blank(w,h)`. It does not call `isActiveLayerEditable()`, the AC-055 guard or AC-056 transaction helper. It also has no revision check. |
| `index.html:2310–2331` | Image import | The change handler creates an object URL and defers conversion/commit to `img.onload`. The callback reads mutable `w`, `h` and `palette`, then calls `remember()` and assigns `pixels=next`. It does not capture layer/frame IDs or a revision at start, and it does not revalidate the target at commit. |

The production `index.html` contains no reference to `ArtClubLayerEditGuard` or `ArtClubSafeEditOperations`. Therefore the guard, transaction and import-staging modules remain isolated contracts: UI-01 did not integrate them, and neither Toolbar Clear nor image import is fixed by the UI redesign.

**Conclusion:** AC-057's two primary bypass findings remain current after UI-01. UI-02 should retain the coordinator-owned integration order: toolbar/selection clear, asynchronous import capture and commit-time revalidation, then selection paste/replace. Integration must commit a complete validated state, preserve source state on denial, and cover the actual UI workflow in Chromium. This revalidation is documentation-only; no production source, model/storage, Agent API, bridge, workflow or test file was changed.
