# Safe-edit integration contract

**Phase:** AC-060  
**Status:** documentation only; no live editor integration is authorized  
**Dependencies:** AC-015, AC-055, AC-056, AC-057, AC-058 and AC-059.

This document maps future integration points to the isolated safety modules. It does not authorize edits to index.html, project model/storage, Agent API or bridge files. The coordinator must grant relevant shared-file locks before wiring anything into the live editor.

## 1. Commit boundary and invariants

Every pixel edit follows this sequence:

1. Resolve the intended active layer/frame/cel through ArtClubLayerEditGuard.resolveEditableTarget().
2. Supply expected/current project, frame and composite revision tokens. The library tolerates omitted tokens for backwards compatibility, but production mutating adapters must require them.
3. Validate selection bounds, input buffers, dimensions and every operation payload before history, live-state or storage writes.
4. Build the complete next project state through ArtClubSafeEditOperations.
5. Publish one complete state and one undo entry; never expose an intermediate or partially patched buffer.
6. Persist the complete state. If persistence fails, restore the exact prior project and saved-state snapshot.
7. Render and report success only after the durable commit succeeds.

A denial returns structured { ok:false, reason, message } data. A denied operation must not change caller-owned project data, active pixel buffers, serialized project JSON, composed/export pixels, undo/redo history or persistent storage.

Whole-project replacement (project import, undo/redo restore) is a different transaction class. Validate the entire candidate using ArtClubImportStaging.stageProjectImport(); do not treat it as a single-layer edit.

## 2. Public API mapping

| Public surface / action | Guard / staging call | Transaction operation | Required checks |
|---|---|---|---|
| Pointer brush / eraser | resolveEditableTarget(project, revisionContext) | applyPixelPatches() | Active visible/unlocked/non-zero-opacity layer; integer points; current gesture revision; one atomic stroke commit |
| Bucket / flood fill | Same active target and revision checks | applyResultBuffer() | Fully validate output length, dense own slots and null/HEX values before commit |
| Line / rectangle / ellipse | Resolve target before preview and revalidate at commit | applyPixelPatches() or applyResultBuffer() | Preview is not project state; validate full result, bounds and selection before one commit |
| Toolbar Clear | Resolve active target/revisions | clearActiveCel() | Decide and label scope as active cel only. Full multi-layer/frame clear requires a separate document operation |
| Selection clear | Resolve target with validated selection | clearActiveCel(project,{selection,...revisions}) | Non-empty integer selection inside canvas; no out-of-bounds clipping |
| Selection cut | Resolve target and validate clipboard | applyPixelPatches() with null patches | Validate copied payload first; copy is read-only, clear is atomic |
| Selection paste | Resolve target with selection and revisions | applyPixelPatches() | Dense clipboard, valid dimensions/colors, every coordinate inside canvas and selection; reject partial paste instead of clipping |
| Selection move / transform | Resolve target and selection | applyPixelPatches() or applyResultBuffer() | Precompute complete destination buffer; validate rotation bounds before mutation |
| Image import | ArtClubImportStaging.stageImageImport(), then resolve active target again at commit | replaceActiveCel() | Byte/dimension ceilings; palette mapping; capture target IDs/revisions before processing; reject stale target after async decode |
| Project JSON import | ArtClubImportStaging.stageProjectImport() | Whole-project replace transaction | Byte ceiling, dense arrays, full model validation, migration warnings; do not replace live project until stage succeeds |
| Agent API drawing batch | Resolve target/revisions once at mutation boundary | applyPixelPatches() / applyResultBuffer() | Mutating commands require expected revisions; validate whole batch and output before commit; one undo entry |
| Undo / redo | Stage/validate complete history snapshot | Whole-project replace transaction | Restore an entire valid project atomically; do not apply active-layer checks to history navigation |
| Layer / frame selection | Not a pixel edit; retain navigation access for hidden/locked layers | Separate structural/navigation transaction | If ensureCel() creates a blank cel, treat it as explicit structural change with revision/history/persistence rules |

## 3. Revision token contract

AC-055 supports paired expectedRevisions and currentRevisions objects with non-negative safe integers:

~~~js
{
  expectedRevisions: { project: 18, frame: 4, composite: 12 },
  currentRevisions:  { project: 18, frame: 4, composite: 12 }
}
~~~

Mismatches return PROJECT_REVISION_STALE, FRAME_REVISION_STALE or COMPOSITE_REVISION_STALE. Partial/malformed token objects return REVISION_CONTEXT_INVALID.

The current editor exposes one documentRevision; it does not maintain independent project/frame/composite counters. Integration must not fabricate three counters by copying one number into all fields. The adapter owner must implement and test:

- project: increments for any project-wide structural or content mutation (layer/frame/cel/palette/name/canvas changes).
- frame: increments when the active frame's duration/order/identity or any cel attached to it changes.
- composite: increments when a change can alter the displayed frame's rendered composite (visible pixels, visibility/opacity/order, active composite selection).
- Tokens are returned by read/status APIs and captured before an operation.
- Tokens are checked again at the final commit boundary, including after asynchronous image decoding.
- Project replacement, undo and redo update all affected counters atomically.
- Rollover is defined; use safe integer bounds and reset only with a project/session generation change.

Until the adapter and read APIs are implemented under a coordinator lock, callers may omit revision enforcement only in isolated unit tests. Live mutation APIs must not claim stale-write protection without comparing caller tokens.

## 4. Import staging and storage rollback

### Image

1. Decode RGBA bytes without changing the current project.
2. Call stageImageImport({width,height,rgba,sourceBytes},{palette,targetWidth,targetHeight,alphaThreshold}).
3. Display returned transparency, palette-quantization and resize warnings when confirmation is required.
4. Capture active layer/frame IDs and revision tokens before processing; resolve again immediately before commit.
5. Use replaceActiveCel() with the staged pixels and captured revision context.
6. Publish and persist the returned detached project as one transaction. On failure, retain or restore the exact old project.

### Project JSON / legacy project

1. Read bytes and call stageProjectImport(); report diagnostics and migration/metadata warnings without touching the current editor.
2. Require explicit user confirmation when import replaces the active project.
3. Snapshot current project and library metadata.
4. Commit the complete staged project and persist it.
5. If persistence fails, restore the pre-import project/library snapshot; do not leave a partial import in memory or storage.

The staging module has no storage capability. The integration owner is responsible for storage transaction/rollback and browser tests that simulate save failure.

## 5. Denial feedback

| Reason family / code | UI feedback |
|---|---|
| LAYER_HIDDEN | “Show this layer before editing it.” Keep selection/tool active; do not mutate pixels |
| LAYER_LOCKED | “Unlock this layer before editing it.” Offer the existing layer control where appropriate |
| LAYER_ZERO_OPACITY | “Increase layer opacity before editing; edits at zero opacity would be invisible.” |
| LAYER_NOT_ACTIVE / FRAME_NOT_ACTIVE | Refresh target/status and ask the user/agent to select the intended active layer/frame; never silently redirect |
| LAYER_NOT_FOUND, FRAME_NOT_FOUND, CEL_NOT_FOUND | “The edit target no longer exists. Refresh the project and retry.” |
| *_AMBIGUOUS, *_METADATA_INVALID, CEL_INVALID | Treat as corrupt/invalid document data; block and report diagnostics, do not auto-repair |
| *_REVISION_STALE | Refresh project/canvas/status and retry with new tokens; never auto-apply stale patches |
| REVISION_CONTEXT_INVALID | Report invalid/missing revision metadata; mutating integrations must not silently fall back to unguarded writes |
| SELECTION_INVALID, patch bounds/shape errors | Keep source unchanged and report the invalid rectangle/pixel/field |
| *_BYTES_EXCEEDED, *_DIMENSIONS_EXCEEDED, *_PIXEL_BUDGET_EXCEEDED | Explain the import limit and preserve the current project |
| PROJECT_MODEL_INVALID, malformed JSON/RGBA/palette | Display staging diagnostics/warnings; never expose a partial commit |

Preserve technical reason codes in API/log output. Do not infer success from a toast; report success only after commit and persistence.

## 6. Required automated and browser verification

### Node decision/transaction tests

- Every guard reason: active/non-active, hidden, locked, zero opacity, missing/duplicate layer/frame/cel, malformed metadata/cel, stale revisions, selection and canvas limits.
- Sparse holes and explicit undefined in every candidate pixel array.
- Complete safe-edit buffer validation and no input mutation on success and denial.
- Project/image staging byte, dimension, pixel, collection, palette, metadata and migration cases.
- No commit object on failure; warnings are deterministic and structured.
- Cyclic/non-serializable input fails closed.

### Chromium/browser integration tests (only after UI lock)

For every pixel mutation path, compare before/after:
- project JSON and active cel buffer;
- full composed pixel raster, including transparency;
- exported PNG dimensions and complete RGBA raster;
- saved project/IndexedDB payload and library metadata;
- undo/redo availability and exact restored pixels.

Include hidden/locked/zero-opacity targets, stale revisions, missing/duplicate cels, malformed clipboard/import, sparse/undefined project import, oversized files, async target changes during image decode, storage failure rollback and successful commit.

A denial must leave every listed representation and history snapshot unchanged. A successful transaction must create one coherent undo entry and consistent in-memory, saved and exported state.

### MCP / Agent API

Mutating API calls require expected revision tokens and return stable structured reason codes. An invalid command anywhere in a batch rejects the whole batch; no earlier command may leak into project state. Include stale revision, hidden/locked/zero-opacity, malformed pixels, invalid selection/import and persistence rollback cases.

## 7. Shared-file locks required before integration

| File / area | Required owner approval |
|---|---|
| index.html | Coordinator must grant a dedicated UI integration lock; it remains coordinator-controlled |
| js/agent-api.js, AGENT_API.md | Coordinator must coordinate the lock with Agent 4 |
| agent-bridge/* | Agent 4 is sole owner during AC-004 reconciliation; no Agent 6 edits without handoff |
| .github/workflows/project-tests.yml | Agent 3 owns workflow changes during exporter reconciliation; do not edit until released |
| Project model/storage | Not in this workstream's ownership; requires a separate assignment and tests |

No integration is authorized by this document. The safety modules remain isolated until the coordinator grants locks and acceptance criteria.

## 8. Integration checklist

- [ ] Coordinator grants index.html and any API/bridge locks to named owners.
- [ ] Revision counters and status/read payloads are implemented and documented.
- [ ] Toolbar Clear wording and actual scope are aligned (active cel vs full document).
- [ ] Brush, eraser, fill, shapes and selection operations commit only through validated transaction helpers.
- [ ] Image import stages/quantizes before commit and rechecks target/revisions after async decode.
- [ ] Project import stages complete candidates and rolls back on persistence failure.
- [ ] Agent API mutating batches require expected revision and remain atomic.
- [ ] Undo/redo whole-project validation/rollback contract is separately tested.
- [ ] Chromium tests prove denied operations preserve project JSON, pixels, PNG and saved storage.
- [ ] MCP tests prove structured denials and all-or-nothing batch behavior.
- [ ] Full Node, Chromium and MCP CI passes on the exact reviewed head.
- [ ] Coordinator reviews, merges and accepts integration; Agent 6 does not self-accept or merge.
