# One Pixel Studio — Workstation Design System

> **AC-091 design proposal.** This is a standalone interactive prototype and design direction, not a production UI release. It does not replace the current editor or imply that any proposed workflow has shipped.

## 1. Design intent

One Pixel Studio should feel like a focused pixel-art workstation: a large editing surface surrounded by quiet, precise controls. The artwork is the most colorful and important element. The application chrome provides orientation, editing context and feedback without competing with the image.

The proposal moves away from the current page-like composition and toward a compact desktop creative tool. Its visual character comes from the existing One Pixel identity, the pixel-art subject matter and a restrained olive accent—not oversized cards, promotional headings or decorative effects.

### Principles

1. **Canvas first.** Keep the viewport as the largest continuous region.
2. **Dense, not cramped.** Use short control heights, consistent alignment and clear grouping; never sacrifice labels, focus indicators or practical target sizes.
3. **State is explicit.** Distinguish the editing frame from the playback preview, hidden from visible layers, locked from unlocked layers, and populated, allocated-blank and unallocated cels.
4. **The interface tells the truth.** Do not imply that an unconnected parser, encoder, project model or persistence layer is working.
5. **Chrome is neutral.** Graphite provides structure. The artwork carries color. Olive is reserved for selection and a small number of primary actions; warm amber marks keyboard focus and warning.
6. **Local-first.** The design does not depend on accounts, remote APIs or network services.
7. **Keyboard is a first-class path.** Every important action has a named, focusable route and a visible focus state.

## 2. Color system

| Token | Value | Purpose |
|---|---|---|
| App background | `#15191B` | Deep application surround |
| Primary chrome | `#1B2022` | Top bar and tool rail |
| Secondary chrome | `#202628` | Context bar and supporting surfaces |
| Panel | `#202729` | Inspector and timeline |
| Raised surface | `#252D2F` | Menus and controls |
| Canvas backing | `#121719` | Viewport |
| Divider | `#354043` | Panel and component boundaries |
| Primary text | `#E2E6E2` | Main labels |
| Secondary text | `#B7C0BC` | Supporting labels |
| Muted text | `#899692` | Essential secondary information |
| Accent | `#BDCF83` | Selected tool, frame/cel and primary action |
| Selection surface | `#39432D` | Quiet selected state |
| Focus | `#E1C477` | Keyboard focus ring |
| Warning | `#D5A56B` | Warning and playback-preview marker |
| Danger | `#D58276` | Destructive or error state |

Primary text on the panel is approximately 12.0:1; secondary text is approximately 8.2:1; muted text is approximately 4.9:1. The quiet token `#6E7B77` is below 4.5:1 on the panel and is reserved for nonessential metadata. The focus token is approximately 8.9:1 against the panel. These are static token-pair calculations, not a full rendered-state WCAG conformance audit. Check actual composited colors in every production state.

Do not communicate state through color alone. Pair selection, visibility, lock and preview with shape, text, an icon or an accessible state. Artwork colors are document data; they must not be normalized to fit the UI palette.

## 3. Typography and geometry

Use the system sans-serif stack for interface labels and controls, with system monospace for dimensions, coordinates, frame identifiers, FPS, HEX values and save state. The working scale is 11–12 px for core interface text, 9–10 px for technical readouts and 17 px for dialog titles. Avoid oversized display type and pervasive all-caps.

The spacing base is 4 px, with common increments of 4, 6, 8, 12, 16 and 20 px. The desktop top bar is 46 px, contextual bar 38 px, tool targets 38 × 38 px, and standard compact controls 25–30 px high. Most edges use 2–3 px radii and 1 px dividers; alignment and separator rhythm replace large cards and shadows.

The inspector is 296 px wide by default and can be resized from 250–390 px. The timeline is 244 px in the desktop reference layout and 210 px in the compact layout. The canvas viewport must retain flexible center space and never be compressed to an unusable strip.

## 4. Application shell

### Menu row and document tab

Keep File, Edit, View, Layer, Frame and Help discoverable in a stable menu row. At phone widths, fold Layer, Frame and Help into More rather than allowing the menu row to collide with the document tab or Inspector action. Menu triggers expose expanded state and commands have explicit names.

The document tab identifies the open artifact without recreating a browser tab strip. Platform-neutral shortcut labels are used where possible. Browser and operating-system chords remain browser/OS-owned: do not intercept Ctrl/Cmd+S, Ctrl/Meta+wheel, AltGraph, IME composition or arbitrary unknown shortcuts.

### Tool rail and contextual options

Use a persistent vertical rail with one selected tool at a time. Tool selection updates the contextual bar and inspector description together. Place tool-specific options in the contextual bar rather than duplicating every setting in floating panels. Hand/Pan is an explicit navigation mode and must not mutate artwork.

### Canvas viewport

The viewport is a named region with concise keyboard instructions. Fit and 100% / Actual Size are distinct states: Fit is a viewport calculation; Actual Size is exactly one CSS pixel per logical artwork pixel. Manual zoom is bounded. Pan/zoom is presentation-only and cannot change document pixels, history, revision, serialization or exports. Use pixelated/nearest-neighbor rendering and keep overlays outside exported artwork.

Do not bind Ctrl/Meta+wheel to app zoom. Preserve browser zoom gestures. The first production viewport integration must keep viewport coordinates in CSS pixels and avoid applying device-pixel ratio twice.

### Layer and frame timeline

Use a real layer-row × frame-column matrix. Each row identifies one layer; each column identifies one frame; each intersection describes a cel. Show three visibly distinct states:
- **Populated:** a cel with image content.
- **Allocated blank:** an existing, explicitly empty cel.
- **Unallocated:** no cel exists for that layer/frame pair.

Selecting an unallocated cel must not silently allocate it. The active editing frame and the playback preview frame are distinct states. Visibility and lock controls have action names that include the layer name and expose their pressed state.

### Inspector

Keep Tool, Layer and Color as task-oriented tabs. The selected tool and its key options are visible without scanning unrelated settings. Layer visibility and lock are represented as explicit states. Opacity remains read-only until the production composite and export paths apply the same opacity semantics. Document dimensions, active frame and active layer are persistent reference data.

### Palette import

The dialog previews the source before applying anything. It discloses file format support, source order, duplicate entries, invalid rows and metadata/name loss. The user must choose Replace, Append/merge behavior or Cancel explicitly. Do not silently deduplicate, reorder, clamp or discard source content. The prototype preview is illustrative; no palette parser or project mutation is connected.

### Export

Present format, frame selection/order, transparency, frame duration and output budget before encoding. Distinguish All Frames, Current Frame, Range and Explicit Ordered Selection. Explicit frame IDs retain user-specified order. Disclose GIF binary transparency, 10 ms timing granularity and possible palette quantization. Keep sprite-sheet metadata paired with the matching image. Preflight precedes allocation; only show progress or cancellation if the underlying encoder supports it. The prototype does not create files.

## 5. Responsive behavior

| Viewport | Layout |
|---|---|
| 1440 × 900 | Full tool rail, dominant canvas, resizable inspector and full matrix timeline |
| 1280 × 800 | Same desktop structure with denser center proportions |
| 981–1180 px | Compact desktop columns; reduce inspector width and secondary labels |
| 701–980 px | Inspector becomes a dismissible drawer over the workspace |
| ≤700 px | Compact menu/context bar and narrow tool rail; matrix scrolls inside its own region |
| 320–390 px | Phone state; no body-level horizontal overflow; inspector and secondary actions remain reachable |

Opening or closing the inspector must not change the document, selected cel or artwork. At desktop widths, resizing the inspector updates the available canvas width. At narrow widths, horizontal scrolling belongs inside the timeline matrix, never on the whole page.

## 6. Accessibility and interaction contracts

- Use visible focus independent of selected state. Selected state uses the olive surface/edge; keyboard focus uses the warm amber ring.
- Tool buttons expose a single selected state; layer visibility/lock controls expose names and pressed state.
- The layer/frame matrix includes row, column-header and cell semantics, accessible names, current selection and arrow-key movement.
- The canvas has a named region, instructions and keyboard pixel navigation. Space/Enter apply the current tool only while the viewport owns focus.
- Native dialogs are preferred for focus containment and Escape behavior; closing returns focus to the invoking control.
- Editable controls, menus, dialogs, IME composition and AltGraph are protected from global editor shortcuts.
- Save and error state should be exposed through concise status regions; do not announce every autosave tick.
- Respect `prefers-reduced-motion` in both CSS transitions and any production preview timers.
- Responsive and screen-reader behavior must be tested in a browser; source inspection alone is not a conformance claim.

## 7. Comparison with current production UI

This comparison is based on the current `index.html` source on `main`, not on a user study or runtime performance benchmark.

| Area | Current production interface | AC-091 proposal |
|---|---|---|
| Hierarchy | Introductory page content above the editor | Workstation shell starts with the editor; canvas is the dominant region |
| Tool access | Two-column button grid inside a left panel | Persistent vertical rail plus contextual options |
| Document context | Project-name input in the canvas card | Menu row and active document tab |
| Canvas navigation | Fit-relative percentage control | Separate Fit, Actual Size, zoom and Center actions |
| Layers/frames | Separate layer list and frame strip | One layer-by-frame cel matrix |
| Cel occupancy | No combined matrix for absent vs allocated blank states | Explicit populated / blank / unallocated states |
| Inspector | Palette, layers, export, canvas options and stats stacked together | Docked Tool / Layer / Color tabs |
| Import/export | PNG, SVG, project JSON, project/image import; no inspected palette-file import or GIF UI | Preview and preflight dialog patterns; real parser/encoder intentionally unconnected |
| Accessibility | Native controls and existing labels provide a baseline, but the audit records shortcut, focus, matrix, state, contrast and reduced-motion gaps | Prototype demonstrates clearer semantics and keyboard states; requires specialist review |

The proposal borrows broad creative-workstation conventions—tool rail, central viewport, timeline and inspector—without copying another editor pixel-for-pixel.

## 8. Alignment with Agent 5 specifications

| Specification | Decision carried forward |
|---|---|
| AC-026 — Keyboard shortcuts | Context-gated tool shortcuts; preserve text editing, dialogs, IME, AltGraph and browser chords |
| AC-049 — Canvas workspace | Fit vs Actual Size, bounded zoom, Hand/Pan and browser-owned zoom gestures |
| AC-050 — Layer/timeline | Layer × frame matrix and three cel occupancy states; distinguish editing and preview frames |
| AC-051 — Palette/export | Preview before apply; disclose duplicates/metadata loss and output constraints |
| AC-052 — Accessibility audit | Named controls, matrix semantics, focus ring, status and reduced-motion rules |
| AC-053 — Static prototypes | Interactive workstation follows the earlier isolated task prototypes |
| AC-054 — Implementation sequence | Safety, accepted module contracts, browser verification and coordinator file ownership remain production gates |

## 9. Prototype behavior and limitations

Open `workstation.html` directly in a modern browser. It is self-contained, with inline CSS and JavaScript and no external runtime. The sample includes original 32 × 24 pixel art, sample drawing/erasing/fill/picker interactions, tool selection, palette selection, frame/layer selection, frame and layer creation, playback state, a resizable/collapsible inspector, a collapsible timeline and native dialogs.

**This is not the production editor.** It is not connected to the real project model, persistence, renderer, undo history, palette parser, safe import transaction, GIF encoder, sprite-sheet exporter or project export. Palette preview rows are illustrative. Export only calculates a sample preflight summary. Layer opacity is intentionally disabled. The canvas sample is not a complete multi-layer/frame editing implementation. These boundaries must remain visible during review.

## 10. Task-based review checklist

- [ ] **Draw:** choose Pencil, drag on the artboard, then choose Eraser; sample pixels should change.
- [ ] **Navigate:** use Fit, 100%, zoom and Center. Switch to Hand and drag; viewport moves without painting.
- [ ] **Frame/layer:** select a frame header, a cel and a layer. Use arrow keys in the cel matrix. Confirm active frame/layer and occupancy state.
- [ ] **Playback:** start and stop preview; the preview state remains distinct from the editing selection.
- [ ] **Palette import:** open Color → Import palette, inspect the illustrative preview/disclosures and Cancel. The sample palette remains unchanged.
- [ ] **Export:** choose format/frame selection and run preflight. Inspect order, transparency and timing notes; no file is generated.
- [ ] **Panel:** collapse/reopen or resize Inspector and collapse/reopen Timeline. Confirm the canvas remains visible.
- [ ] **Keyboard:** tab through menu, rail, viewport, matrix, inspector and dialogs. Check visible focus, meaningful names and native text-field behavior. Escape closes a menu and restores focus.
- [ ] **Responsive:** check 1440 × 900, 1280 × 800, 860 × 740, 390 × 844 and 320 × 740. Confirm no body-level horizontal overflow.

## 11. Browser capture and verification record

Genuine headless Chromium captures were taken at device scale factor 1 from the reviewed prototype. The four WebP screenshots are supplied as downloadable attachments in the Agent 5 handoff response in this conversation:

- `workstation-1440x900.webp` — full workstation.
- `workstation-1280x800.webp` — compact desktop.
- `workstation-860x740.webp` — responsive workspace with the inspector drawer open.
- `workstation-390x844.webp` — phone state with the inspector drawer dismissed after Escape.

These files are **not committed to this PR**. The available GitHub repository connector in this session supports text-file writes but does not expose a binary asset upload operation. This section intentionally contains no relative repository links; the four attachments are linked directly in the Agent 5 handoff response.

Manual review used Chromium 144.0.7559.96. The 1440 × 900, 1280 × 800, 860 × 740 and 390 × 844 layouts all completed with no page errors and no body-level horizontal overflow. Accessible-name queries found one associated control for each of Canvas size, Frame rate, Current frame, Active layer and Choose a palette file. Line and Rectangle Select are explicitly demonstration-only: pointer activation leaves the sample pixel buffer unchanged and displays a disclosure rather than applying an edit.

This is prototype-level evidence, not a production integration test, manual assistive-technology test or WCAG conformance claim. Real application integration still requires the coordinator-issued UI lock, accepted module contracts, exact-head browser tests and specialist accessibility review.
