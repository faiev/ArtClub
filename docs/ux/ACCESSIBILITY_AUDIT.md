# Accessibility and Interaction Audit

**Task:** AC-052 — Accessibility and interaction audit  
**Owner:** Agent 5 — UX / interaction design / accessibility  
**Audited source:** `index.html` on `main`, commit `10f689611b1558966aeabbae1a93a927c7d3a022`  
**Branch:** `agent/accessibility-audit`  
**Status:** Source-based audit and remediation specification; no production code changes are included.

---

## 1. Executive summary

This is a source-level accessibility and interaction audit of the current editor. It identifies concrete gaps in keyboard focus routing, focus-indicator contrast, grid semantics, state announcements, control names and modal fallback behavior.

The most urgent issue is keyboard shortcut routing: global Undo/Redo and Save handlers run before the text-input check, so editor shortcuts can intercept native text editing and the browser's Save Page command. The largest structural concern is the canvas accessibility tree: a `role="grid"` container renders up to 262,144 direct gridcell children, without row containers, while exposing no usage instructions or row/column indexes. Several important states—active tool, selected swatch, active frame, playback preview, layer visibility and lock—are primarily visual or rely on glyph/title text.

The stylesheet has visible focus treatments, but static contrast calculations indicate they are too faint for the intended focus-indicator role. Several small labels also fall below the 4.5:1 text contrast target. A polite toast live region exists, which is a useful baseline, but the persistent save-state text has no live announcement semantics.

**Audit status:** Source review only.

**This document does not claim WCAG conformance or non-conformance.** No live browser, platform, keyboard-only, screen-reader, touch-device or colorimeter audit was performed in this task. Static contrast calculations are preliminary checks against the literal CSS foreground/background colors and must be rechecked against rendered states.

### Priority summary

| ID | Severity | Finding |
|---|---|---|
| A11Y-01 | High / P1 | Global shortcuts intercept native text Undo and browser Save Page before focus filtering |
| A11Y-02 | High / P1 | Focus-indicator contrast is low for buttons, inputs, selects and pixel cells |
| A11Y-03 | High / P1 | Canvas grid has flat cell structure and no row semantics; maximum 262,144 gridcells |
| A11Y-04 | High / P1 | Active/selected states are not consistently exposed programmatically |
| A11Y-05 | Medium / P2 | Layer action buttons and several icon-only controls have ambiguous accessible names |
| A11Y-06 | Medium / P2 | Palette removal is available only through the context menu/right-click |
| A11Y-07 | Medium / P2 | Several small text labels fall below the 4.5:1 contrast target |
| A11Y-08 | Medium / P2 | Save-state changes are not announced; toast lifetime and interruption need validation |
| A11Y-09 | Medium / P2 | Dialog fallback does not provide a modal focus-management contract |
| A11Y-10 | Medium / P2 | Zoom group and zoom status lack a clear programmatic context; “100%” is fit-relative |
| A11Y-11 | Medium / P2 | Reduced-motion CSS does not govern JavaScript-driven animation preview |
| A11Y-12 | Medium / P2 | Field validation errors are primarily toast-based, without inline invalid-state association |
| A11Y-13 | Low / P3 | Shortcut reference is macOS-specific in its labels and hidden on narrow screens |
| A11Y-14 | Medium / P2 | Responsive reflow and touch target quality require real viewport validation |

## 2. Scope, method and limitations

### Source reviewed

- `index.html`: page landmarks, editor controls, palette, layer list, timeline, canvas grid, keyboard handlers, CSS focus/contrast/responsive/reduced-motion rules, toast, project and canvas dialogs, save-state updates, playback and zoom.
- The current editor's project model and existing interaction behavior were considered where needed to interpret active layer/frame, grid focus and playback preview.

### Review method

1. Trace relevant markup, CSS and event handlers in the current source.
2. Record reproducible behaviors that are directly supported by source.
3. Calculate preliminary contrast ratios for literal CSS color pairs using the WCAG relative-luminance method. For translucent focus color, calculate the composited foreground over the stated sample background first.
4. Separate source-verifiable findings from browser/assistive-technology checks that remain unperformed.
5. Define target behavior and a testable validation plan for each finding.

### Not performed

- No screen-reader session with NVDA, JAWS, VoiceOver or TalkBack.
- No keyboard-only end-to-end browser session.
- No live browser tests at 320 CSS px, 200%/400% zoom or alternate device-pixel ratios.
- No pixel sampling from rendered screenshots; contrast figures are static CSS calculations.
- No full WCAG 2.2 checklist, legal review or formal conformance evaluation.

The source uses several native semantic controls and has a real keyboard-operable pixel grid. Those positive observations are recorded below; they do not establish that the complete editor is accessible.

## 3. Findings

### A11Y-01 — Global shortcuts intercept native text and browser commands

<badge color="danger">High · P1</badge>

**Location:** `index.html`, document keydown handler around lines 2073–2092.

**Current behavior / reproduction**

1. Focus the project-name input or HEX color input.
2. Type text and make an edit.
3. Press Ctrl+Z (Windows/Linux) or Command+Z (macOS).
4. The document handler processes Undo before checking whether the active element is an input/select/textarea. It calls `preventDefault()` and invokes project Undo/Redo.
5. With an input focused, press Ctrl+S / Command+S. The handler schedules project save and prevents the browser's Save Page command before reaching the editing guard.
6. The guard only identifies INPUT, SELECT and TEXTAREA. It does not identify contenteditable regions, `role="textbox"`, dialog/menu contexts or IME composition.

**User impact**

Native text undo, browser save and other editing behavior may be unexpectedly replaced by editor actions. A user can lose or undo canvas work when they intended to edit text, and the browser's own save action is intercepted.

**Target behavior**

- Perform focus/context filtering before any global editor shortcut.
- Preserve native text editing, clipboard, browser and OS commands in editable controls.
- Detect `isContentEditable`, contenteditable ancestors, role=textbox, IME composition and AltGraph.
- Suspend global editor shortcuts while a modal dialog or menu owns focus.
- Do not globally intercept Ctrl/Cmd+S; use the product's visible local-save state and controls instead.
- Call `preventDefault()` only after a non-reserved command is confirmed in an eligible editor context.

**Validation**

- Automated interaction test: focus project-name, HEX and canvas width/height inputs; type text; press Ctrl/Cmd+Z, A, C, V, Backspace and Save Page. Assert native input behavior and unchanged canvas history.
- Browser test: repeat with contenteditable and `role="textbox"` fixtures.
- Browser test: open each dialog; press tool letters and Undo; verify background editor commands do not run.
- Manual browser smoke test: verify Ctrl/Cmd+S still invokes browser Save Page where supported.

### A11Y-02 — Focus indicators do not reach the intended non-text contrast target

<badge color="danger">High · P1</badge>

**Location:** `index.html` CSS near the initial focus rule and pixel-cell focus rule.

**Current behavior / static calculation**

- General focus rule: `button:focus-visible,input:focus-visible,select:focus-visible` uses `rgba(66,107,132,.35)`.
- Composited over the panel sample `#fffefa`, the resulting focus color is approximately `#bdcbd1`; calculated contrast against `#fffefa` is **1.65:1**.
- Pixel cells use `outline:1px solid #e97960`.
- On the checkerboard's light sample `#f7f8f2`, the calculated ratio is **2.67:1**; on the darker checker sample `#dfe5dc`, it is **2.22:1**.
- The cell outline is only one CSS pixel thick.

These calculations use the literal CSS values and do not replace rendered-state sampling. The general focus color may appear on backgrounds other than white.

**User impact**

Keyboard focus can be difficult to locate, especially over the canvas checkerboard, selected controls and low-contrast surfaces. Focus may be particularly hard to distinguish at high zoom or under reduced display contrast.

**Target behavior**

- Choose an opaque or sufficiently strong focus color with at least 3:1 contrast against adjacent colors in every supported component state.
- Use an outline thickness and offset that remain visible on small controls and pixel cells.
- Ensure focus is not obscured by clipped panels, overlays, sticky headers or scrolling.
- Preserve a visible focus indicator when a tool/layer/frame is selected; selected state and keyboard focus must be visually distinct.

**Validation**

- Automated screenshot/color-sampling tests for focus on buttons, inputs, selects, tool buttons, layer actions, frame cards, swatches, pixel cells and dialog controls.
- Test focus over both checkerboard colors and selected/hover/disabled backgrounds.
- Manual keyboard-only pass at desktop, mobile and high-zoom viewports.

### A11Y-03 — Canvas grid lacks row structure and scales to an enormous accessibility tree

<badge color="danger">High · P1</badge>

**Location:** `index.html`, `renderGrid()` around lines 801–844; keyboard handler around 1865–1894.

**Current behavior / reproduction**

- The grid container is a `div role="grid"` with `aria-label="Pixel art canvas"`.
- `renderGrid()` sets `aria-rowcount` and `aria-colcount`.
- Each pixel is a direct child `div role="gridcell"`; the implementation does not render row containers with `role="row"`.
- Every cell gets a coordinate/color label (for example, “Pixel 4, 7, #E96F55”) and one roving tab stop.
- At 512×512, the source creates 262,144 cell elements and exposes that many gridcells in the accessibility tree.
- The grid has arrow navigation and Space/Enter activation, but the markup provides no `aria-describedby` keyboard instructions or coordinate/state status region.

**User impact**

The grid may not be interpreted consistently as a two-dimensional grid by assistive technology. Navigation can become verbose and slow, and the large number of individual cells may burden browser and screen-reader performance.

**Target behavior**

- Use valid grid structure with row groups and cells, or another tested semantic pattern that conveys dimensions and current row/column.
- Provide a concise description of the canvas controls and current tool.
- Expose row/column coordinates, color/transparency and current focus without announcing every redraw.
- Evaluate whether all 262,144 logical cells must exist as separate accessibility nodes; if virtualization or a summarized interaction model is adopted, retain a keyboard route to inspect and edit any pixel.
- Keep one predictable tab stop for the canvas region and make entry/exit instructions available.

**Validation**

- Automated DOM assertions for grid/row/gridcell hierarchy, row/column counts and indexes.
- Browser test at 24×24 and 512×512 for focus movement and performance.
- Manual screen-reader test: enter canvas, hear concise name/instructions, move by arrow keys, hear coordinate/color, activate a cell, leave grid by Tab, and return.
- Check that screen-reader output is not flooded by pixel redraws.

### A11Y-04 — Active and selected states are primarily visual

<badge color="danger">High · P1</badge>

**Location:** tool markup around lines 250–270; palette rendering around 844–855; layer rendering around 1077–1147; timeline rendering around 856–900.

**Current behavior / reproduction**

- Active tool is shown with a CSS `.active` class; tool buttons do not set `aria-pressed`.
- Selected palette swatch is shown with a `.selected` class and outline; its accessible name says “Select #HEX” but selected state is not exposed with `aria-pressed`.
- Active frame is shown by `.frame-card.active`; preview frame by `.frame-card.preview`. The frame-select button has frame number/name but no programmatic selected/current state.
- Layer active state is partly appended as visible text “· ACTIVE” to the layer name button, but is not represented consistently using selected/current state semantics.
- Playback preview is a CSS class; there is no corresponding state announcement.

**User impact**

Screen-reader users cannot reliably determine which tool, color, layer or frame is currently active, or distinguish an active editing frame from a playback preview frame. Visual-only selection indicators also make automated state assertions difficult.

**Target behavior**

- Expose mutually exclusive tool selection using `aria-pressed` or a tested radio-group pattern.
- Expose selected palette color, active layer and active frame via appropriate current/selected state semantics.
- Expose playback preview separately from editing selection, with words such as “Preview frame 3; editing frame remains 1”.
- Keep state text available even when the visual highlight is clear.
- When state changes, update the programmatic state and announce only meaningful changes.

**Validation**

- Automated tests assert ARIA state before and after each tool, swatch, layer and frame selection.
- Browser tests distinguish active frame from preview frame while playing and paused.
- Manual screen-reader test for all state changes.

### A11Y-05 — Layer action names depend on glyphs and title tooltips

<badge color="warning">Medium · P2</badge>

**Location:** `renderLayers()` around lines 1077–1147; add buttons in markup around lines 385–389.

**Current behavior / reproduction**

- Visibility and lock buttons render glyph characters (eye/circle and lock/diamond); their meaning/state is primarily conveyed by `title`.
- Layer reorder buttons render only up/down arrows with title text.
- Add Layer and Add Color controls render plus glyphs and title attributes but no explicit `aria-label`.
- The active layer name is visible in a button, but there is no dedicated semantic row grouping that conveys visibility, lock and active state together.

**User impact**

Accessible names may be inconsistent across browser/assistive technology combinations, and glyphs can be announced literally or ambiguously. Tooltips are not a dependable substitute for explicit accessible names.

**Target behavior**

- Add explicit action names including the target layer, e.g. “Hide Background layer”, “Lock Sketch layer”, “Move Background layer up”.
- Use `aria-pressed` for visibility and lock toggles and announce the resulting state.
- Add explicit names to Add Layer and Add Color controls.
- Group each layer row semantically and expose layer name, active/hidden/locked state in text or an accessible description.

**Validation**

- Automated accessible-name checks for every generated layer action at multiple layer counts.
- Manual screen-reader test when the layer is hidden, locked, active and at the top/bottom reorder boundary.

### A11Y-06 — Palette removal is only available through right-click/contextmenu

<badge color="warning">Medium · P2</badge>

**Location:** palette help text around lines 376–379 and swatch `contextmenu` handler around lines 844–855.

**Current behavior / reproduction**

- The visible instruction says “Right-click a swatch to remove it.”
- The swatch click selects the color.
- The only remove handler listens for the browser `contextmenu` event and calls `preventDefault()`; it then displays a browser confirm dialog.
- No keyboard action, separate remove button or touch-friendly alternative is provided.

**User impact**

Touch users have no reliable equivalent to right-click. Keyboard users can focus a swatch but cannot discover or invoke the remove action using ordinary keyboard controls.

**Target behavior**

- Provide a visible and keyboard-accessible Remove Color action for the selected swatch, or a semantic context menu with an accessible keyboard trigger.
- Preserve the final-color guard and the confirmation that existing pixels keep their HEX value.
- Make the destructive action's target explicit in the accessible name and confirmation.

**Validation**

- Keyboard-only: focus swatch, navigate to Remove, activate and cancel/confirm.
- Touch emulation: remove a color without contextmenu/right-click.
- Verify one-color palette cannot be reduced to zero and project pixels remain unchanged.

### A11Y-07 — Small secondary text has low static contrast

<badge color="warning">Medium · P2</badge>

**Location:** global CSS near lines 10–100 and secondary label rules in later studio styles.

**Current behavior / static calculations**

Preliminary contrast ratios for literal source color pairs include:

| Text role / sample | Foreground | Sample background | Ratio |
|---|---|---|---:|
| Field labels | `#78817d` | `#fffefa` | **3.98:1** |
| Muted panel text | `#74807b` | `#fffefa` | **4.07:1** |
| Canvas tip | `#929a93` | `#fffefa` | **2.86:1** |
| Footer text | `#7d8782` | `#f2f0e9` | **3.25:1** |
| Statistics caption | `#7b8580` | `#f3f4ee` | **3.45:1** |
| Timeline sublabel | `#849087` | `#fffefa` | **3.29:1** |
| Selection status | `#839087` | `#fffefa` | **3.30:1** |
| Local-status badge | `#53705e` | `#e4ebd8` | **4.46:1** |

The first seven samples are below the 4.5:1 text target for normal-size text. The local badge is just below 4.5:1. Primary button text and toast text on dark surfaces have high contrast in the static samples.

**User impact**

Small labels and help text can be difficult to read, particularly on low-quality displays, at reduced brightness or for users with low vision.

**Target behavior**

- Use at least 4.5:1 for normal-size text and at least 3:1 for large text, evaluated against the actual rendered background.
- Increase contrast of labels, hints, footer text, timeline captions and canvas tips without relying on opacity or muted color alone.
- Preserve separate visual hierarchy through size, weight and spacing rather than lowering essential text contrast.

**Validation**

- Automated CSS token contrast tests for all foreground/background state pairs.
- Screenshot sampling for default, hover, selected, disabled, darkened/dialog and responsive states.
- Manual review at normal and enlarged browser zoom. Recalculate any translucent/composited text or backgrounds from rendered pixels.

### A11Y-08 — Save-state changes are not exposed as live status

<badge color="warning">Medium · P2</badge>

**Location:** save-state markup near the top bar; `scheduleSave()` and `persistNow()` around lines 1238–1270; toast near line 1280.

**Current behavior / reproduction**

- The save-state text changes through “SAVING LOCALLY…”, “SAVED IN PROJECT LIBRARY”, “LOCAL BACKUP ONLY” and “SAVE FAILED · EXPORT JSON”.
- The save-state element is a visual text span, not a status/live region.
- The toast uses `role="status" aria-live="polite"`, which is a positive baseline for transient messages, but JavaScript removes its visible message after approximately 2.1 seconds.
- Repeated saves overwrite the same toast node; announcements and timing have not been verified with assistive technology.

**User impact**

A screen-reader user may not know whether the most recent project change was saved, saved only as a local backup or failed. A transient message may disappear before it can be reviewed visually.

**Target behavior**

- Expose persistent save state as a concise polite status region.
- Announce transitions only when the state changes meaningfully; do not announce every autosave timer tick.
- Keep errors persistent until addressed or provide a discoverable error history.
- Keep toast content short and avoid duplicating the same message through multiple live regions.

**Validation**

- Automated test for live-region role and text updates for saving, saved, backup-only and failure.
- Manual screen-reader test with autosave success/failure and rapid successive edits.
- Confirm that the message remains understandable after it is no longer visible.

### A11Y-09 — Dialog fallback lacks an explicit modal focus-management path

<badge color="warning">Medium · P2</badge>

**Location:** `openCanvasDialog()` around lines 1940–1965 and `openProjectLibrary()` around lines 2230–2250.

**Current behavior / reproduction**

- Both dialogs use native `<dialog>` elements with `aria-labelledby`, which is good.
- Modern path calls `showModal()`, using native modal behavior.
- Fallback path only sets the `open` attribute when `showModal` is unavailable; it does not implement an explicit focus trap, background inertness, Escape behavior or focus restoration.
- Close controls have accessible labels; canvas form fields have associated labels.

**User impact**

In the fallback path, keyboard focus may move behind the open dialog and the background may remain interactive. Focus restoration is not explicitly handled outside native browser behavior.

**Target behavior**

- Prefer native modal dialog where supported.
- If fallback is retained, explicitly manage initial focus, focus containment, Escape/cancel, background inertness and restoration to the invoking control.
- Ensure closing by Cancel, close button or submit returns focus to a predictable place.

**Validation**

- Browser test in the native `showModal()` path for focus entry, Tab/Shift+Tab containment, Escape and focus restoration.
- Unit/browser test the fallback path with `showModal` unavailable.
- Manual screen-reader test of both dialogs.

### A11Y-10 — Zoom control lacks a semantic group and announces an ambiguous percentage

<badge color="warning">Medium · P2</badge>

**Location:** zoom control markup around lines 313–321; `applyZoom()` / `setZoom()` around lines 1214–1228.

**Current behavior / reproduction**

- Zoom is a generic `div aria-label="Canvas zoom"` rather than a named group.
- Zoom in/out buttons have accessible names.
- The center button is labelled by its changing visible text (e.g. “100%”) and its title says “Reset zoom”; the action is not reflected in the accessible name.
- The current calculation scales the largest canvas side to a fitted reference width multiplied by a zoom factor. The displayed 100% is therefore fit-relative, not one CSS pixel per logical pixel.
- Updating the zoom text does not use a live status announcement or expose an unambiguous scale description.

**User impact**

A user may hear only “100 percent” without knowing it resets zoom, or believe that one logical pixel equals one CSS pixel. Changes to zoom may not be announced.

**Target behavior**

- Use a semantic labelled group for zoom controls.
- Give the reset/actual-size action an accessible name that explains the action.
- Distinguish Fit, Actual size and manual zoom in both visible and accessible labels.
- Expose the zoom mode and current scale in a concise status announcement after user-triggered changes.
- Keep canvas instructions available without requiring the user to infer them from visual layout.

**Validation**

- Automated accessible-name and group-role checks.
- Browser test verifies changing zoom updates text and programmatic status.
- Manual screen-reader test at Fit and manual zoom. Confirm the announced percentage's meaning.

### A11Y-11 — Reduced-motion CSS does not govern JavaScript playback

<badge color="warning">Medium · P2</badge>

**Location:** reduced-motion media rule around lines 160–163; playback timer functions around lines 915–965.

**Current behavior / reproduction**

- CSS uses `@media(prefers-reduced-motion:reduce)` to disable CSS transitions and smooth scrolling.
- Animation playback continues through JavaScript `setTimeout` using each frame's duration.
- No runtime check of `matchMedia("(prefers-reduced-motion: reduce)")` is present in the reviewed playback functions.
- Playback is user-initiated through Play, which is a positive distinction from automatically starting animation.

**User impact**

Users who request reduced motion can still start a rapidly changing animation preview without a motion-specific notice or preference. The CSS rule alone does not govern the actual frame playback.

**Target behavior**

- Preserve explicit user initiation; never autoplay animation on load.
- When reduced motion is requested, provide a clear reduced-motion playback mode or prompt before continuous playback. Keep a single-frame/step-through option.
- Expose playing/paused state programmatically and provide Pause/Stop controls that remain keyboard reachable.
- Ensure the preview frame is distinguishable from the editing frame for assistive technology.

**Validation**

- Automated test emulates `prefers-reduced-motion: reduce` and verifies the expected playback policy.
- Browser test starts, pauses and stops preview by keyboard.
- Manual review with reduced motion enabled; confirm no automatic playback and clear state feedback.

### A11Y-12 — Input errors rely on transient toast text rather than field-associated errors

<badge color="warning">Medium · P2</badge>

**Location:** HEX change handler around lines 1995–2002; canvas form submit handler around lines 1955–1965; project import handler around lines 2034–2045.

**Current behavior / reproduction**

- Invalid HEX input triggers a toast and resets the control to the selected color.
- Invalid canvas dimensions trigger a toast; the fields do not receive an associated error message or explicit `aria-invalid` state.
- Project JSON import errors also surface through a toast.
- The canvas dimension inputs use native labels, min/max/step and required attributes, which is a useful baseline.

**User impact**

Users may miss a transient toast or may not know which field needs correction. Screen-reader users do not receive a stable, field-associated description of the error.

**Target behavior**

- Keep the entered value when practical so the user can correct it.
- Set `aria-invalid="true"` on the invalid field and associate a persistent message using `aria-describedby`.
- Announce form-level import errors once, without stealing focus unnecessarily.
- Clear the invalid state when the value becomes valid or the dialog closes.
- Preserve native browser validation where it works with the custom error text.

**Validation**

- Automated tests for invalid/valid HEX and canvas dimensions, `aria-invalid` state and associated message IDs.
- Browser test verifies focus moves to the first invalid control on submit.
- Manual screen-reader test for corrected and canceled errors.

### A11Y-13 — Shortcut information is inconsistent and hidden on mobile

<badge color="warning">Medium · P2</badge>

**Location:** shortcut legend around lines 293–300; responsive CSS around lines 95–96 and 159–162.

**Current behavior / reproduction**

- The legend uses Command glyphs for copy/cut/paste, select all, undo/redo and save even though the handler supports Ctrl and Meta.
- The shortcut list is hidden at the mobile breakpoint.
- It does not explain the canvas grid's arrow-key/Space/Enter interaction.
- The app has no always-available shortcut reference in the current UI.

**User impact**

Windows/Linux users see misleading modifier labels, and mobile/small-window users cannot discover the shortcut instructions. The canvas keyboard model is not explained.

**Target behavior**

- Use platform-aware Ctrl/Command labels or neutral labels such as “Ctrl/⌘”.
- Keep the full shortcut reference reachable at every viewport width.
- Include concise canvas-specific instructions and the context in which each key works.
- Keep shortcut reference content aligned with the AC-026 shortcut specification.

**Validation**

- Automated viewport test at desktop, 700px, 390px and 320px verifies a route to the full reference.
- Platform label test for Windows/Linux/macOS.
- Manual keyboard-only discovery test.

### A11Y-14 — Responsive reflow and touch interaction require browser validation

<badge color="warning">Medium · P2</badge>

**Location:** responsive CSS around lines 95–96 and 159–162; canvas grid uses `touch-action:none`.

**Current behavior / source evidence**

- CSS changes from a three-column workspace to two columns at narrower widths, then one column at 700px and adjusts again at 390px.
- At the 700px breakpoint, tool controls become four columns and the shortcut list is hidden.
- The canvas grid sets `touch-action:none` and receives pointer events for editing.
- The timeline and layer lists have their own scroll areas; some small-screen controls are compact.

These source rules describe intended layout but do not prove successful reflow at 320 CSS px or 400% zoom.

**User impact / uncertainty**

Small viewport or high zoom may cause clipped controls, horizontal page overflow, reduced touch targets or difficulty reaching the timeline/panels. This requires actual browser testing rather than inference from media queries.

**Target behavior**

- Preserve all editing, save, undo, palette, layer, timeline and dialog actions at 320 CSS px and 400% zoom without two-dimensional page scrolling except for content that is intrinsically two-dimensional (canvas/timeline).
- Keep touch targets usable and prevent the canvas gesture policy from blocking required page-level navigation outside the drawing surface.
- Do not hide required help or key instructions on mobile.
- Keep focus visible after scrolling and responsive panel rearrangement.

**Validation**

- Real-browser screenshots and keyboard tests at 320, 360, 390, 600, 700, 900 and 1440 CSS px.
- Test 200% and 400% browser zoom and landscape mobile orientation.
- Test touch/pen drawing, timeline scroll, page scroll outside canvas and dialogs.
- Measure actual hit target sizes rather than relying on CSS nominal dimensions.

## 4. Existing strengths to preserve

The current source already has several useful accessibility foundations:

- `<html lang="en">` and document language metadata.
- A main content landmark and a clear page heading.
- Native buttons, inputs, selects and associated labels for canvas width/height and several settings.
- Accessible names on the pixel grid, project name, color picker/HEX input, playback mode, undo/redo, new project, dialog close buttons and several main controls.
- Pixel grid arrow-key navigation with a roving tab stop and Space/Enter activation.
- Native `<dialog>` elements with `aria-labelledby` and a `showModal()` path.
- A polite toast status region (`role="status" aria-live="polite"`).
- A CSS reduced-motion rule that turns off transitions and smooth scrolling.
- Clear visual separation of canvas, tools, palette, layer panel and timeline.

Remediation should improve these foundations rather than replace working native control semantics with custom generic elements.

## 5. Remediation order

### Phase A — Keyboard safety and focus (P1)

1. Reorder global shortcut focus checks; preserve text/browser/OS commands.
2. Strengthen focus indicators and verify contrast over all component states.
3. Fix canvas grid row/cell semantics and ensure the large grid remains navigable.
4. Expose active tool, selected swatch, layer/frame and playback-preview states programmatically.
5. Give glyph-only actions explicit accessible names.

### Phase B — Status, dialog and form feedback (P2)

1. Expose save state through a stable polite status region.
2. Verify native modal focus behavior and implement a safe fallback if the non-modal fallback remains supported.
3. Add field-associated validation and persistent error descriptions.
4. Make reduced-motion behavior explicit for user-started animation preview.
5. Provide a clear zoom group, Fit/Actual-size wording and a programmatic zoom status.

### Phase C — Responsive and discoverability validation (P2/P3)

1. Make shortcut documentation available at narrow viewport widths.
2. Validate reflow, focus retention, touch targets and canvas gestures at real viewport sizes and browser zoom levels.
3. Conduct manual keyboard-only and screen-reader checks for the complete editor journey.

## 6. Automated validation checklist

| Area | Automated assertion |
|---|---|
| Shortcut routing | Text-editable, dialog and menu contexts do not trigger global editor shortcuts |
| Reserved keys | Ctrl/Cmd+S is not prevented by the editor; unknown/reserved commands are not intercepted |
| Grid semantics | Grid has valid row/cell structure, dimensions and row/column index/state |
| Grid navigation | Arrow keys move logical focus; Enter/Space behavior is scoped to a focused cell |
| Accessible names | Every dynamically generated tool, layer, visibility, lock, reorder, frame, playback and palette action has a descriptive name |
| Selected state | Tool, swatch, layer, frame and preview state updates accessible properties |
| Focus | All interactive controls have visible focus with measured contrast at least 3:1 against adjacent colors |
| Text contrast | Small text color pairs are tested against actual background state at 4.5:1; large text at 3:1 |
| Live status | Save and operation status messages expose meaningful state changes politely |
| Dialog | Modal entry/exit, Tab containment, Escape, cancel and focus restoration work in native and fallback paths |
| Validation | Invalid controls expose `aria-invalid` and an associated error description; errors clear when corrected |
| Motion | Reduced-motion preference changes playback behavior according to the approved policy |
| Zoom | Zoom group and current Fit/Actual-size/manual state are exposed to assistive technology |
| Responsive | No unintended page-level horizontal overflow at 320 CSS px and at 400% zoom |

## 7. Manual validation checklist

- Keyboard-only completion of a drawing workflow: choose tool, choose color, navigate grid, draw, undo/redo, select/copy/paste, change layer/frame, use playback, save and open a dialog.
- Screen-reader walkthrough with NVDA + Firefox/Chrome or NVDA + Chrome on Windows, VoiceOver + Safari on macOS, and TalkBack + Chrome on Android where devices are available.
- Confirm grid navigation gives understandable coordinate/color feedback without announcing every grid redraw.
- Confirm active layer visibility/lock, active frame and preview frame are announced.
- Confirm status announcements are not duplicated or overly chatty and failures remain discoverable.
- Confirm dialog focus is contained and returned.
- Confirm reduced-motion behavior and playback controls.
- Confirm focus remains visible over all backgrounds, responsive breakpoints and zoom states.
- Confirm palette removal and other context actions have non-pointer alternatives.
- Confirm no visual-only state is required to distinguish active, disabled, hidden, locked or preview controls.

## 8. Cross-spec dependencies and ownership

| Related work | Audit connection | Ownership boundary |
|---|---|---|
| AC-026 `KEYBOARD_SHORTCUTS_PLAN.md` / PR #20 | Defines modifier/context policy and keyboard matrix; A11Y-01 and A11Y-13 flag present-code conflicts/discoverability issues | Agent 5 documentation; no shortcut implementation lock |
| AC-049 `CANVAS_WORKSPACE_SPEC.md` / PR #24 | Pan/zoom, focus, responsive panels and canvas instructions; A11Y-10 and A11Y-14 require integrated validation | Agent 2 viewport module; `index.html` remains coordinator-controlled |
| AC-050 `LAYER_TIMELINE_SPEC.md` / PR #30 | Layer/frame/cel state names and two-dimensional timeline semantics; A11Y-04/A11Y-05 require accessible state/actions | Agent 6 safety module, Agent 3 timeline/export; no UI lock |
| AC-051 `PALETTE_EXPORT_SPEC.md` / PR #35 | Palette remove/selection, import/export diagnostics and dialogs; A11Y-06/A11Y-12 | Agent 8 parser/analysis modules, Agent 3 exporters; no UI lock |
| Production editor `index.html` | Required for control labels, focus, live regions and responsive integration | Coordinator assigns one serialized UI owner |
| `agent-bridge/e2e-test.mjs` | Browser interaction tests may eventually be useful | Agent 4 is sole current editor; create new focused test files instead |
| `.github/workflows/project-tests.yml` | Optional CI wiring for new accessibility checks | Shared workflow lock belongs to Agent 3 until released |

## 9. Audit disposition

AC-052 is ready for coordinator review when:

- Every finding has a severity, source location, reproduction steps, target behavior and validation plan.
- Static contrast results are labelled preliminary and tied to explicit CSS color pairs.
- Positive source behavior is recorded.
- Live browser, keyboard, screen-reader and device checks are clearly identified as not performed by this source-only audit.
- No WCAG conformance claim is made.
- The document is delivered without changing production UI or another agent's files.
