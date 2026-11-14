# UI-01 production source map

Coordinator-owned implementation reference. This is a source inspection, not a runtime test or approval to replace the live renderer.

- Audited source: `index.html` on main, blob `1a29a9eca58d9035287af1ff58b97f2ff4040a69`.
- Page size at audit: about 128 KB; 86 static IDs and no duplicate IDs.
- The existing app is one local-first page. Keep its data/command handlers and dynamic DOM targets while changing layout around them.

## UI-01 shell mapping

| Workstation region | Current production target / behavior | Preservation requirement |
|---|---|---|
| Application bar / document tab | `.topbar`, `.brand`, `#projectLibraryBtn`, `#saveState`, `#projectName` | Keep Projects dialog, document name editing and truthful local-save status. The introductory `.intro` can be removed/replaced only after its useful status/copy is accounted for. |
| Tool rail | `#toolList [data-tool]` with `brush`, `eraser`, `fill`, `eyedropper`, `line`, `rect`, `ellipse`, `select`; `setTool()`, `applyTool()`, shape preview helpers | Preserve every tool identifier and existing shortcuts; context controls must reflect active tool. Do not introduce a decorative/inert replacement rail. |
| Selection actions | `#selectionCopyBtn`, `#selectionCutBtn`, `#selectionPasteBtn`, `#selectionClearBtn`, `#selectionAllBtn`, `#selectionDeselectBtn`, `#selectionFlipHBtn`, `#selectionFlipVBtn`, `#selectionRotateBtn`; `copySelection()`, `cutSelection()`, `clearSelectedPixels()`, `pasteSelection()`, `transformSelection()` | Keep selection status, target restrictions, enabled/disabled states and undo behavior. Preserve clear/cut/paste non-mutation protections. |
| Canvas viewport | `#pixelGrid[role=grid]`, `.pixel-cell`; `renderGrid()`, `getCell()`, `paint()`, `renderSelectionOverlay()`; `#zoomOut`, `#zoomReset`, `#zoomIn`, `setZoom()`, `applyZoom()` | Preserve the existing DOM pixel grid and pointer-to-cell mapping in UI-01. Do not swap to the CanvasPixelRenderer just for layout. Fit/actual-size/pan may use the accepted viewport module later, but keep the current grid rendering, overlay and focus behavior until parity is proven. |
| Timeline / playback | `#timelineArea`, `#frameList`, `#frameCount`, `#playBtn`, `#playbackMode`, `#onionToggle`; `renderTimeline()`, `selectFrame()`, `addFrame()`, `duplicateFrame()`, `deleteFrame()`, `moveFrame()`, `setFrameDuration()`, `startPlayback()`, `togglePlayback()` | Keep real project frame state, duration editing, playback mode, onion skin, frame CRUD and keyboard behavior. UI-01 should reposition the existing timeline, not replace it with the prototype's synthetic cel matrix. |
| Palette inspector | `#paletteGrid`, `#colorPicker`, `#hexValue`, `#palettePreset`, `#addColorBtn`, `#colorCount`; `renderPalette()`, `syncColorUI()`, `setColor()` | Keep actual palette mutations and existing preset/custom HEX flows. New palette-file import is a later gated workflow unless a reviewed parser/transaction is accepted and wired. |
| Layer inspector | `#layerList`, `#addLayerBtn`, `#duplicateLayerBtn`, `#deleteLayerBtn`; `renderLayers()`, `setActiveLayer()`, `addLayer()`, `duplicateLayer()`, `deleteLayer()`, `toggleLayerVisibility()`, `toggleLayerLock()`, `moveLayer()` | Preserve layer identity, order, visibility, lock, active cel selection, limits, and autosave/undo. A new visual matrix must not silently allocate an absent cel. |
| Export / project I/O | `#pngBtn`, `#scaledBtn`, `#svgBtn`, `#jsonBtn`, `#importProjectBtn`, `#projectInput`, `#importImageBtn`, `#imageInput`, `#demoBtn`; `exportPNG()`, `download()`, project serializers/import handlers | Keep all current PNG 1×/16×, SVG, project JSON, JSON open, image import and starter-art flows. New GIF/sprite-sheet actions remain gated by accepted export PRs and browser-decoder proof. |
| Project library / canvas setup | `#projectDialog`, `#projectLibraryBtn`, `#dialogNewProjectBtn`, `#newProjectBtn`, `#customCanvasBtn`, `#canvasDialog`, `#canvasForm`; `openProjectLibrary()`, `renderProjectLibrary()`, `createBlankProject()`, `resizeCanvas()`, `openCanvasDialog()` | Keep local project CRUD, IndexedDB/localStorage recovery, canvas-size validation and dialog semantics. |
| Save / recovery | `#saveState`; `syncProjectDocument()`, `snapshot()`, `saveCurrentProject()`, `persistNow()`, `scheduleSave()`, `restore()`, `writeLocalBackup()` | Do not break debounce timing, local backup, library fallback, restore or truthful save errors. Test reload/recovery after any DOM changes. |
| Agent API | `./js/agent-api.js`, `installAgentAPI()`, `validateAgentCommands()`, `executeAgentCommands()`, project/layer/selection/frame command handlers | Preserve API method names, state semantics and command errors. Avoid editing bridge E2E owned by Agent 4 / shared workflow owned by Agent 3. |

## Module status at UI-01 start

| Module / work | Status | UI-01 treatment |
|---|---|---|
| v2 project model + storage | Existing production dependency | Preserve; no schema migration in UI-01. |
| Safe edit guard / immutable operations / import staging (#14, #23, #26, #48, #49; conformance #62) | Merged to main as isolated modules/contracts/tests | Their presence does not mean production commands are all wired. Do not bypass existing guards; UI-02 owns deeper integration. |
| Raster primitives (#31) | Merged | Existing live shape tools remain authoritative; avoid duplicate raster logic in the shell. |
| Viewport math (#34) | Merged | Candidate for navigation wiring after Agent 2 review. |
| Project-to-renderer adapter (#43) | Merged | Candidate contract only; no production Canvas renderer switch in UI-01. |
| Isolated integration demo (#75) | Draft, pending clean rebase and dedicated Chromium interaction evidence | Not a live UI dependency yet. |
| GIF / sprite-sheet / async export work | Still in dependent open PR chains | Keep new export UI out of UI-01; maintain existing exports. |

## UI-01 implementation constraints

1. Treat `index.html` as a single-writer file. Coordinator-authored PR only unless an explicit temporary lock is issued.
2. Reuse existing IDs and handlers wherever possible; if an ID must change, update every binding and add focused tests for the new contract.
3. Reorganize existing nodes into the workstation regions. Avoid duplicating the same control into a prototype-like static shell that has no connection to the real command.
4. Keep the DOM-grid renderer and current project model in UI-01. Renderer migration is a separate gate.
5. Keep the local-first promise: no network runtime, account, API key, server dependency, remote font or remote asset.
6. Add keyboard-visible focus, meaningful labels, compact but usable targets, reduced-motion behavior and responsive panel collapse. Do not let canvas overlays change exported pixels.
7. Test existing task flows after layout changes: draw/erase/fill/pick/line/shape; selection copy/cut/paste/clear/transform; layer select/CRUD/visibility/lock/reorder; frame select/CRUD/duration/playback/onion; palette selection/custom HEX/presets; PNG/SVG/JSON export and image/project import; project library, save/reload/recovery; Agent API smoke.
8. Use new focused test files for UI-specific checks. Do not change Agent 1's or Agent 4's shared browser E2E files without explicit ownership handoff.

## Audit limitations

This map was built from current source IDs, function declarations and direct event bindings. It is not proof that every workflow works in Chromium today. Agent 1's 12-flow browser smoke suite remains the integration acceptance gate. Test the exact UI PR head, inspect screenshots at 1440×900 and 1280×800, then verify the actual GitHub Pages deployment after merge.
