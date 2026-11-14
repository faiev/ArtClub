# AC-091 — Workstation prototype review

**Artifact:** `docs/ux/prototypes/workstation.html`  
**Design system:** `docs/ux/DESIGN_SYSTEM.md`  
**Status:** Interactive design prototype; not production UI.

## 1. Design rationale

The production UI is a single-page editor with a broad header/introduction, a separate tools panel, a central canvas, a right inspector and a frame strip. It exposes familiar controls, but the layout spends significant vertical space on introductory copy and card-like panel chrome, keeps layers and frames separate, and does not present an explicit workstation hierarchy.

The AC-091 prototype makes the editor itself the primary surface:
- A compact application bar carries menus, document identity, local-save state and global commands.
- A contextual strip changes with the active tool.
- A persistent tool rail reserves a narrow vertical path for creation and navigation.
- The canvas owns the largest central region.
- A timeline below the canvas combines layer rows with frame columns, making cel occupancy visible as part of the editing model.
- A docked inspector groups tool, layer and color properties without competing with the canvas.

The interface uses restrained graphite surfaces and thin separators; muted green is a selection/action accent, not a decorative theme. Pixel artwork is the most saturated content on the screen. No external stock art, emoji icons, gradient backgrounds or remote UI libraries are used.

## 2. Production comparison checklist

| Area | Current production UI (source review) | AC-091 prototype direction |
|---|---|---|
| Application structure | Brand/top metadata plus intro copy before the editor | Compact application menu and document tab; editor occupies the full work area |
| Tool access | Two-column tools panel with labels | Persistent vertical tool rail plus contextual options |
| Canvas navigation | Existing fit-relative zoom presentation; no distinct Fit/Actual Size action in the reviewed UI | Separate Fit, 100% Actual Size and manual zoom controls; explicit Hand tool |
| Canvas input | Pixel grid is the live drawing surface | Canvas is a standalone prototype surface; no renderer swap implied |
| Layer/frame organization | Separate layer list and frame strip | Layer-row × frame-column matrix with cel state markers |
| Cel state | Current UI does not surface the full sparse-cel distinction | Populated, allocated blank and unallocated cells have different glyph treatments and accessible names |
| Inspector | Palette, layers, export, canvas settings and stats arranged as one long panel | Tabbed Tool/Layer/Color inspector with collapse, resize and responsive drawer |
| Palette import | Current UI has preset/swatches/custom HEX controls; no palette file import flow | Import preview dialog illustrates parse results and metadata-loss disclosure; parser is not connected |
| Export | Current UI offers PNG, scaled PNG, SVG, project JSON and JSON open | Export dialog illustrates selection, preflight and format limits; no file is encoded |
| Accessibility | Existing labels and keyboard canvas paths provide a baseline, with audit findings still open | Focus outline, pressed/selected states, named matrix controls, responsive drawer and reduced-motion CSS are design requirements; manual AT review remains open |
| Production integration | Live editor and data model | Standalone file under `docs/ux/prototypes`; production app unchanged |

## 3. Responsive review captures

Four genuine screenshots were captured from the running prototype in Chromium at device scale factor 1. They are supplied as downloadable WebP attachments in the Agent 5 handoff response in this conversation, rather than committed to GitHub; the repository connector available in this session does not expose a binary asset upload operation. The files are:

- `workstation-1440x900.webp` — desktop, 1440 × 900.
- `workstation-1280x800.webp` — compact desktop, 1280 × 800.
- `workstation-860x740.webp` — inspector drawer open, 860 × 740.
- `workstation-390x844.webp` — phone width, 390 × 844.

No relative repository links are provided because these binary files are not part of the PR. The exact attachments are linked in the Agent 5 handoff response. At 860 px the inspector becomes a drawer. At 390 px application menus consolidate under More, the document tab truncates rather than pushing the viewport wider, and timeline overflow remains local to the matrix region. A 320 CSS-pixel width was also checked for body-level horizontal overflow; no screenshot was captured at that width.

## 4. Interaction review checklist

### Drawing task
- [x] Select Pencil, Eraser, Fill, Eyedropper and Hand tools; the drawing/picker tools operate on the synthetic sample only.
- [x] Select Line and Rectangle Select to inspect their context states. These are explicit demonstrations only: Line does not rasterize and Rectangle Select does not create a pixel selection.
- [x] Pointer drawing changes the synthetic canvas sample without changing the UI overlay/grid.
- [x] Line and Rectangle Select pointer activation display a disclosure and leave the sample pixel buffer unchanged.
- [x] Keyboard arrows move the canvas pixel cursor; Space/Enter applies supported sample tools. Line and Rectangle Select remain disclosure-only.
- [x] Hand mode pans the viewport without running the drawing tool.
- [x] Fit, Actual Size, manual zoom and centering controls are distinct.
- [ ] Validate actual artwork/history/export immutability against production model APIs; this prototype has no production model.

### Layer and frame task
- [x] Select layer and frame from matrix row/column headers and cel buttons.
- [x] Distinguish populated, allocated blank and unallocated cels through visuals and accessible names.
- [x] Navigate matrix cells by arrow keys, Home and End.
- [x] Toggle layer visibility and lock state; the state is reflected in control labels/pressed state.
- [x] Add a frame or layer once per activation and update the matrix.
- [x] Play/pause preview and expose preview separately from the editing frame.
- [x] Collapse timeline; inspector can collapse, resize or move to a drawer.
- [ ] Validate structural reorder/duplicate/delete, undo/redo, sparse-cel creation and renderer/export composition with accepted production modules; these are not wired here.
- [ ] Enable layer opacity only after the renderer/export composition contract applies opacity consistently.

### Import task
- [x] Open/close native palette import dialog and return to the editor.
- [x] Choose a local file and show its file name/size in the prototype.
- [x] Show a preview with duplicate and metadata-loss disclosure.
- [x] Select Replace preview, Add Unique preview or Cancel.
- [ ] Connect the accepted GPL/JASC-PAL/JSON parsers, diagnostics and safe stage/commit contract.
- [ ] Verify malformed/oversized files, source order, duplicate preservation and no mutation after cancel/failure.

### Export task
- [x] Open/close export dialog and select format/frame mode.
- [x] Show output order and format-specific preflight text.
- [x] Explicitly disclose GIF binary transparency and 10 ms timing units.
- [x] Label export action as prototype-only; no download is claimed.
- [ ] Connect accepted export planner and encoders; run decoded PNG/GIF full-raster and metadata checks.
- [ ] Verify file naming, download feedback, budgets, error recovery and output immutability.

## 5. Browser review record

Manual Chromium 144.0.7559.96 review was recorded at device scale factor 1 for:
- 1440 × 900 full workstation.
- 1280 × 800 compact desktop.
- 860 × 740 responsive workspace with inspector drawer open.
- 390 × 844 phone width with the inspector drawer dismissed after Escape.
- 320 CSS px body-width overflow check.

All four captured viewport sizes completed with **zero page errors** and **no body-level horizontal overflow**. The accessibility checks found associated accessible names for Canvas size, Frame rate, Current frame, Active layer and Choose a palette file. Line and Rectangle Select pointer activation was checked against the sample canvas pixel buffer; both displayed their demo-only disclosure and left the buffer unchanged. Tool/context switching; frame/layer/cel selection; one-frame-per-click insertion; playback state; inspector tab visibility, collapse, resize and drawer behavior; dialog open/close; export preflight; text-field focus/native editing behavior; and matrix keyboard navigation were also exercised.

Known follow-up: this is a browser interaction/design review, not a formal accessibility audit. Screen-reader output, cross-browser behavior, touch hardware, reduced-motion behavior with a running browser preference, real parser/encoder integration and production data mutation must be tested in the owning integration work. No production app test or production UI change was performed for AC-091.

## 6. Acceptance handoff

- [x] Design system tokens and semantic component rules documented.
- [x] Standalone interactive workstation prototype created.
- [x] 1440 × 900 and 1280 × 800 desktop layouts captured.
- [x] Narrow responsive layout captured at 860 × 740 and 390 × 844.
- [x] Tool, matrix, playback, panel, dialog and focus interactions implemented.
- [x] Original synthetic pixel-art sample and inline SVG icons used.
- [x] Prototype scope and non-production behavior disclosed in UI and documentation.
- [ ] Production integration, visual regression approval and assistive-technology sign-off remain separate future work.
