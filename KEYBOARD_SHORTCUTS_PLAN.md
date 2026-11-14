# Art Club — Keyboard Shortcuts and Command Discoverability Plan

**Task:** AC-026 — Keyboard shortcut and command-discoverability specification  
**Owner:** Agent 5 — UX / Product  
**Branch:** `agent/keyboard-shortcuts-plan`  
**Production source rechecked:** `main` `index.html` blob `4645281c1aad8580529e7feb99cd299a88543913` (merged UI-01 workstation shell)  
**Status:** Specification only; no application implementation is included.

---

## 1. Product goals and non-goals

The editor should provide a predictable keyboard layer without stealing browser, operating-system, text-editing or dialog behavior. A shortcut must have one clearly defined action in a clearly defined focus context. Every important action must remain available from visible controls; shortcuts are an accelerator, not the only route.

This task specifies the behavior and acceptance criteria for a later implementation. It does not implement the handler, command palette, help dialog, tooltips or any UI.

**Goals**

- Document the actual shortcuts and close the mismatch between behavior and the visible legend.
- Establish a compact set of consistent shortcuts for tools, undo/redo, selection, zoom, layer/frame navigation and playback.
- Give Windows, Linux and macOS users appropriate modifier labels and behavior.
- Protect browser/OS shortcuts and native editing behavior.
- Define focus, modal-dialog, menu, keyboard-only and screen-reader expectations.
- Give the later implementer a concrete test matrix.

**Non-goals**

- No command palette in AC-026.
- No shortcut customization/remapping in the first implementation.
- No new editing tools or model changes.
- No global interception of browser/OS shortcuts.
- No app-source or test-file changes in this assignment.

## 2. Current behavior verified in main

The following describes the source at the AC-026 branch base, not a proposed future behavior.

### 2.1 Pixel-grid keyboard behavior

In `index.html`, the grid listens for `keydown` when a `.pixel-cell` is the active element (lines 1865–1894):

- Arrow keys move the roving focus to the adjacent logical pixel, clamped at the canvas edges.
- Space or Enter applies the current tool at the focused pixel.
- With the eyedropper selected, Space/Enter samples the composite color and returns to the brush.
- The handler prevents the default action for handled navigation and activation keys.
- Other keys are left to the browser.

### 2.2 Document-level shortcuts

The document-level `keydown` handler is in `index.html` lines 2073–2092:

| Current key | Current action | Current condition |
|---|---|---|
| Ctrl/Cmd+Z | Undo | Global handler; runs before the text-input guard |
| Ctrl/Cmd+Shift+Z | Redo | Global handler; runs before the text-input guard |
| Ctrl/Cmd+S | Schedule local save and show toast | Global handler; runs before the text-input guard |
| Ctrl/Cmd+C | Copy selection | After text-input guard; only when a selection exists |
| Ctrl/Cmd+X | Cut selection | After text-input guard; only when a selection exists |
| Ctrl/Cmd+V | Paste selection clipboard | After text-input guard; only when clipboard data exists |
| Ctrl/Cmd+A | Select all | After text-input guard |
| Ctrl/Cmd+D | Deselect | After text-input guard; only when selection exists |
| Delete / Backspace | Clear selected pixels | After text-input guard; only when selection exists |
| B / E / G / I / M | Brush / eraser / fill / eyedropper / selection tool | After text-input guard |
| Escape | Deselect; otherwise switch to brush | After text-input guard |
| [ / ] / 0 | Zoom out / zoom in / reset to 100% | After text-input guard |

The handler computes the modifier as `e.ctrlKey || e.metaKey`. It detects only INPUT, SELECT and TEXTAREA as editing targets, and its text-input check occurs **after** Undo, Redo and Save. The current implementation can therefore intercept native text Undo and the browser's Save Page command while a text field is focused.

The handler does not check for an open modal dialog, an open menu, a contenteditable region, a role=textbox control, IME composition or AltGraph before processing editor shortcuts. Letter shortcuts can consequently run while focus is on a non-text button inside a dialog.

### 2.3 Existing discoverability and test coverage

- The static shortcut legend is in `index.html` lines 293–300. It displays Command symbols (`⌘`) even though the handler supports both Ctrl and Meta.
- The legend omits layer/frame navigation and playback, neither of which currently has a keyboard shortcut.
- The shortcut list is hidden by the mobile CSS breakpoint (`index.html` responsive rules around lines 96 and 161).
- Existing CSS has visible focus treatment for buttons, inputs, selects and pixel cells, but the shortcut reference itself is only a static legend.
- Inspection of `tests/editor-interactions.test.js` found no keyboard shortcut tests. The README does not provide a keyboard shortcut reference.

## 3. Interaction model

Use one centralized shortcut router rather than adding independent document listeners for each feature. Route a key according to the active context:

1. **Canvas/grid:** pixel-cell navigation and pixel activation.
2. **Timeline:** frame navigation and playback controls.
3. **Layer list:** layer navigation and layer selection.
4. **Editor background:** global editor shortcuts such as tools, zoom, undo and selection commands.
5. **Text/editable controls, dialogs and menus:** native control behavior or the focused component's own keyboard model takes precedence.

A command is handled only when its context and prerequisites are satisfied. Call `preventDefault()` only after a command has been positively matched and is actually going to run. Unknown or reserved combinations must pass through untouched.

### 3.1 Key event normalization

- Use `event.key` for character shortcuts so the binding follows the user's keyboard layout. Normalize letter case for matching.
- Use `event.code` only for a consciously physical-position binding; do not mix physical and character semantics in the same shortcut map.
- Ignore shortcut processing while `event.isComposing` is true or while the event represents an active IME composition (including legacy keyCode 229 where needed).
- Ignore events with AltGraph active. AltGr can appear as Ctrl+Alt on some layouts and must not accidentally trigger editor shortcuts.
- Ignore auto-repeat for destructive or one-shot commands. Arrow navigation may repeat naturally.
- Do not process a shortcut when its target is disabled, inert, disconnected or outside the active editor surface.

### 3.2 Focus and context priority

Apply these rules before matching global shortcuts:

1. **Editable text:** Do not intercept keys when the event target is an input, textarea, select, an editable option, `contenteditable`, an element with `role="textbox"`, or a descendant of one. Check `isContentEditable` as well as tag names. Native text selection, undo/redo, clipboard, deletion and browser editing must work.
2. **Modal dialog:** While a modal dialog is open, suspend global editor shortcuts. The dialog owns its own controls and key behavior. Escape should close/cancel the topmost dialog using the dialog's native or explicitly implemented behavior; it must not also switch tools or clear the canvas selection.
3. **Menu/popover/listbox:** Route arrows, Home/End, Enter, Space and Escape to the active menu/listbox. Do not let a global editor shortcut steal them.
4. **Focused interactive control:** Preserve native Enter/Space activation for buttons and links. Do not treat a key used to activate a focused control as a canvas command.
5. **Editor region:** Only then route to the focused canvas, timeline, layer list or editor background.

A shortcut targeted at the editor must not fire because focus happens to be somewhere else on the page. Global editor shortcuts should be scoped to the editor shell and suspended while another application surface is active.

## 4. Proposed shortcut map

`Mod` means **Command (⌘)** on macOS and **Ctrl** on Windows/Linux. This is a display and matching convention, not a literal key.

### 4.1 Editor-wide commands

| Action | Windows / Linux | macOS | Context and behavior |
|---|---|---|---|
| Undo | Ctrl+Z | ⌘Z | Editor background or canvas context; never while editing text |
| Redo | Ctrl+Shift+Z | ⌘Shift+Z | Same context as Undo; keep one cross-platform primary binding |
| Brush | B | B | Editor background/canvas; no effect in editable controls or dialogs |
| Eraser | E | E | Editor background/canvas |
| Fill | G | G | Editor background/canvas |
| Eyedropper | I | I | Editor background/canvas |
| Selection tool | M | M | Editor background/canvas |
| Zoom out | [ | [ | Editor background/canvas only |
| Zoom in | ] | ] | Editor background/canvas only |
| Reset zoom to 100% | 0 | 0 | Editor background/canvas only |

**Save policy:** Do not globally bind Ctrl+S / ⌘S. Browsers use this combination for Save Page, and the current handler intercepts it before checking text-field focus. Keep automatic local saving and the visible save/export controls. Any future explicit Save command must use a non-reserved, user-discoverable route rather than silently overriding the browser shortcut.

### 4.2 Selection commands

| Action | Windows / Linux | macOS | Context and behavior |
|---|---|---|---|
| Select all pixels | Ctrl+A | ⌘A | Editor canvas/background; native text Select All wins in editable controls |
| Deselect | Ctrl+D | ⌘D | Only when a selection is active |
| Copy selection | Ctrl+C | ⌘C | Only when the canvas/editor owns focus and an app selection exists; otherwise preserve native clipboard behavior |
| Cut selection | Ctrl+X | ⌘X | Same focus rule as Copy; one undoable document operation |
| Paste selection | Ctrl+V | ⌘V | Only when app selection clipboard data exists and canvas/editor owns focus; otherwise preserve native paste |
| Clear selected pixels | Delete / Backspace | Delete / Backspace | Canvas/editor context with an active selection only; never intercept in text fields |

Do not claim ownership of Ctrl/Cmd+C/X/V merely because the app has a selection. The focused text field or contenteditable element always owns native text clipboard commands.

### 4.3 Canvas pixel navigation

| Action | Keys | Context and behavior |
|---|---|---|
| Move focused pixel | Arrow keys | Focus is inside the pixel grid; clamp to canvas edges and move the roving tab stop |
| Apply current tool at focused pixel | Space or Enter | Focus is on a pixel cell; one undoable action and one save schedule |
| Escape canvas mode | Escape | First cancel an active transient canvas operation or selection only after menus/dialogs have had priority; do not switch to Brush as an incidental side effect |

Arrow keys and Space/Enter keep their current grid behavior. They must not simultaneously navigate frames or toggle playback while a pixel cell has focus.

### 4.4 Layer list navigation

The layer list should become a keyboard-operable list with one roving tab stop.

| Action | Keys | Context and behavior |
|---|---|---|
| Focus previous/next layer | Arrow Up / Arrow Down | Layer list has focus; move focus only |
| Select focused layer | Enter | Layer row has focus; selects that layer |
| First / last layer | Home / End | Layer list has focus |
| Toggle focused layer visibility | Space | Only when focus is on that layer's visibility control; preserve native button activation |
| Lock/unlock | No global shortcut proposed | Use the explicit lock control; avoid an obscure state-changing chord |

Navigation and activation are separate. Moving focus must not change the active layer until Enter or the row's defined activation action. Visibility and lock controls remain individually focusable and have accessible names that include the layer name and state.

### 4.5 Timeline and playback navigation

The timeline should become a keyboard-operable region with a roving frame focus. These bindings apply only while the timeline region (not a transport button or a pixel cell) owns focus.

| Action | Keys | Context and behavior |
|---|---|---|
| Previous / next frame | Arrow Left / Arrow Right | Timeline frame strip/grid has focus; selects and focuses the adjacent frame |
| First / last frame | Home / End | Timeline has focus |
| Play / pause | Space | Timeline region has focus; toggles playback without scrolling the page |
| Stop and return to editing frame | Shift+Space | Timeline region has focus; stops playback and restores the selected editing frame |

Do not globally assign Space to playback: it already activates the focused pixel cell, buttons and browser page scrolling in other contexts. Do not bind Alt+Left/Right for frame navigation because browsers use those combinations for Back/Forward. Frame selection and playback preview must remain visually distinct.

## 5. Platform modifier policy

### Windows and Linux

- Use Ctrl as the primary modifier for editor commands.
- Show labels such as `Ctrl+Z`, `Ctrl+Shift+Z` and `Ctrl+A`.
- Do not use Alt as the normal editor modifier. Alt combinations commonly belong to browser navigation, window managers or input-method behavior.
- Do not intercept the Super/Windows key or operating-system chords.

### macOS

- Use Command (⌘) as the primary modifier for editor commands.
- Show labels such as `⌘Z`, `⌘⇧Z` and `⌘A`.
- Do not intercept Command+Q, Command+W, Command+T, Command+N, Command+L, Command+R, Command+P, Command+F or Command+Space.
- Do not intercept system shortcuts such as Spotlight, Mission Control, app switching or window management.

### Platform detection and labels

- Prefer `navigator.userAgentData.platform` when available, with a conservative `navigator.platform` fallback.
- If the platform cannot be identified reliably, show a neutral `Ctrl/⌘` label rather than a false platform-specific key.
- Keep the semantic shortcut map separate from its display labels. Do not hard-code Command glyphs into a universal shortcut legend.
- Test both Ctrl and Meta event paths even when the CI runner executes on only one operating system.

## 6. Browser and operating-system conflict policy

The following combinations are reserved and must remain untouched by the editor. This is a conservative list of common browser/OS bindings, not an exhaustive guarantee for every browser or desktop environment.

| Combination family | Common examples | Policy |
|---|---|---|
| Browser tabs/windows | Ctrl/Cmd+T, W, N, Shift+T, Shift+W, Tab, Shift+Tab | Never bind or prevent default |
| Address/location bar | Ctrl/Cmd+L; F6 | Never bind |
| Reload/navigation | Ctrl/Cmd+R, Ctrl/Cmd+Shift+R, F5, Alt+Left/Right | Never bind |
| Browser find/print | Ctrl/Cmd+F, Ctrl/Cmd+P | Never bind |
| Browser page zoom | Ctrl/Cmd+Plus, Minus, 0 | Never bind; app zoom uses [ / ] / 0 only in the editor context, and 0 must not be handled with the browser modifier |
| Browser save page | Ctrl/Cmd+S | Do not intercept; remove the current global app binding |
| Developer/browser chrome | F12, Ctrl/Cmd+Shift+I, Ctrl/Cmd+Shift+J | Never bind |
| OS/app switching and window management | Alt+Tab, Meta/Super combinations, macOS Command+Tab, Command+Q, Command+Space | Never bind |
| Input methods | AltGraph, IME composition and composition-confirmation keys | Never treat as editor shortcuts |

Additional rules:

- Treat any combination not explicitly listed in the accepted shortcut map as unhandled.
- Do not call `preventDefault()` on a reserved or unknown shortcut.
- Do not stop propagation merely to hide a conflict.
- Do not use Ctrl+Alt or Meta+Alt as an alternate modifier. AltGr and OS-level behavior make those combinations unsafe.
- A conflict must be documented and resolved before a new shortcut ships; do not silently steal the existing browser or OS action.

## 7. Dialog, menu and editable-control behavior

- Text inputs, textareas, selects, contenteditable elements and role=textbox widgets retain all standard text-editing keys, including undo, redo, Select All, clipboard and Delete/Backspace.
- Project-name and other inline editable fields must never change tools, zoom, selection or document history from letter shortcuts.
- While a modal dialog is open, only the dialog's controls and dialog-specific key map are active. Background canvas shortcuts are suspended.
- Escape closes the topmost open menu/popover/dialog or cancels the active transient operation in a defined priority order. It must not also deselect or change tools after closing a dialog.
- Tab and Shift+Tab follow the natural focus order. Native dialog focus containment is preferred. Closing a dialog returns focus to the control that opened it.
- Menus and listboxes implement their own Arrow/Home/End/Enter/Escape behavior. Global editor shortcuts must not intercept those keys while a menu owns focus.
- Enter and Space activate a focused button/link according to native semantics. They do not trigger canvas paint or playback unless the specified canvas/timeline region owns focus.
- Do not hijack keyboard commands during IME composition or while AltGraph is active.

## 8. Command discoverability

The first implementation should add a visible, responsive **Keyboard shortcuts** reference, not a command palette.

Recommended behavior:

1. Keep a concise summary near the editor tools on wide screens, but make the full reference available through an obvious **Keyboard shortcuts** / **Help** entry at every viewport width.
2. Open the full reference in an accessible dialog or help panel. It must be keyboard reachable, have a clear title, close action and predictable focus restoration.
3. Group commands by **Tools**, **Editing and selection**, **Canvas navigation**, **Layers**, and **Timeline / playback**.
4. Display platform-correct modifier labels and show the relevant context (for example, “when the timeline has focus”).
5. Mark shortcuts that are conditional (such as Copy only when a selection exists). Do not list a command whose behavior is not implemented.
6. Provide a visible control for every listed action. Do not make a shortcut the only way to access a tool or command.
7. Keep the help reference usable on phone-width screens; do not hide the only shortcut documentation at the mobile breakpoint.
8. Add concise tooltips to primary tool controls where they help discovery, but do not rely on hover-only information.
9. Keep the reference content in one canonical command map so tooltips, help text and tests cannot drift into separate conflicting lists.
10. Do not implement a command palette as part of AC-026. A later assignment may decide whether search/command execution is warranted.

## 9. Keyboard-only and accessibility requirements

- Every tool, layer, frame, playback control and dialog action remains reachable and operable without a pointer.
- Maintain a visible focus indicator with sufficient contrast on pixel cells, list rows, buttons, timeline frames and dialog controls.
- Use roving tabindex for the pixel grid, layer list and timeline so each composite region has one tab stop; arrow keys move within the focused region.
- Give the canvas/grid an accessible name and description. A focused pixel should expose its logical coordinates and current color/transparent state without requiring visual inspection.
- Give each layer row an accessible name including layer name, active state, visibility and lock state. Give each frame an accessible name including frame name/number and selected state.
- Expose playback state (playing/paused/stopped) to assistive technology. Do not rely on color alone to distinguish the active frame from a playback preview frame.
- Use an appropriately throttled polite live region for meaningful frame/layer changes; do not announce every pixel during rapid arrow-key repetition.
- Preserve native button, link, input and dialog semantics. Do not replace semantic controls with clickable generic divs solely to simplify shortcut handling.
- Provide instructions for the context-specific keys next to the relevant region or through the keyboard reference.
- Respect reduced-motion preferences; keyboard focus and active-state feedback must not depend on animation.

## 10. Acceptance-test matrix

The later implementation should include unit/interaction coverage for the key router and real-browser coverage for focus, navigation and actual controls. Synthetic event tests are useful for modifier/focus branches but do not replace browser interaction testing.

| Test | Context / input | Expected result |
|---|---|---|
| Tool shortcuts | Editor background; B, E, G, I, M | Correct tool selected |
| Tool shortcuts on Windows/Linux | Ctrl path and plain letter keys | Same tool actions; modifier is not required |
| Tool shortcuts on macOS | Meta path and plain letter keys | Same tool actions; platform label is Command |
| Tool key in project-name field | Focus input; press B/E/G/I/M | Text field remains editable; tool does not change |
| Tool key in contenteditable | Focus editable region; press tool key | Native editing; tool does not change |
| Undo / redo, Windows/Linux | Editor context; Ctrl+Z, Ctrl+Shift+Z | One undo/redo operation each |
| Undo / redo, macOS | Editor context; Meta+Z, Meta+Shift+Z | One undo/redo operation each |
| Text undo/redo | Input/textarea/contenteditable; platform Undo/Redo | Native text undo/redo; project history unchanged |
| Save conflict | Editor or text field; Ctrl/Cmd+S | App does not prevent browser Save Page; no editor shortcut fires |
| Select all | Canvas/editor focus; Ctrl/Cmd+A | Select all pixels |
| Native Select All | Text input/contenteditable; Ctrl/Cmd+A | Select text only; pixel selection unchanged |
| Copy/cut/paste selection | Canvas context with active app selection | App selection clipboard action runs once |
| Native clipboard | Text input or no app selection | Browser/native copy/cut/paste remains available |
| Delete selection | Canvas context with active selection | Selected pixels clear as one undoable action |
| Native deletion | Text input/contenteditable | Text deletion behaves normally; artwork unchanged |
| Canvas arrows | Pixel cell focused; each arrow | Focus moves to adjacent logical pixel and clamps at edges |
| Canvas activation | Pixel cell focused; Space/Enter | Current tool acts once at focused pixel; no page scroll |
| Timeline navigation | Timeline focused; Left/Right/Home/End | Frame focus/selection moves as specified |
| Layer navigation | Layer list focused; Up/Down/Home/End | Layer focus moves; selection changes only on Enter |
| Playback | Timeline region focused; Space then Shift+Space | Play/pause toggles; stop returns to the selected editing frame |
| Context separation | Pixel cell focused; Space vs timeline focused; Space | Canvas action in grid; playback action in timeline; never both |
| Dialog focus | Modal open; press B, Z, [ or ] | Background tool/history/zoom action does not run |
| Dialog Escape | Modal open; press Escape | Topmost dialog closes/cancels once; selection/tool remains unchanged; focus restored |
| Menu navigation | Menu open; arrows/Home/End/Enter/Escape | Menu behavior wins; no canvas/frame navigation occurs |
| Focused button | Button focused; Space/Enter | Native button activation once; no canvas paint or playback side effect |
| Browser reserved keys | Press reserved tab/location/reload/find/print/zoom keys | Editor does not prevent default or run an app command |
| Unknown shortcut | Any unregistered combination | No app action and no preventDefault |
| IME composition | Composition active; press shortcut-like keys | No editor command runs |
| AltGraph | AltGraph active with a letter key | No editor command runs |
| Repeat behavior | Hold Delete or a destructive command key | No repeated destructive transactions |
| Responsive discoverability | 375px, 600px, 700px and desktop widths | Full reference remains reachable without horizontal page overflow |
| Keyboard-only workflow | Tab from page into tools, canvas, layers, timeline and dialogs | All controls reachable; focus visible; no keyboard trap |
| Assistive technology | Inspect grid/layer/frame/playback state | Names and state are exposed; active/preview states are not color-only |
| Focus restoration | Open and close shortcut help/dialog | Focus returns to the invoking control |

### Test layers

**Unit/interaction**

- Test the shortcut map as data: action, key, modifier, context, prerequisites and reserved status.
- Test key normalization for Ctrl vs Meta, case, repeat, IME composition and AltGraph.
- Test the event router with INPUT, TEXTAREA, SELECT, contenteditable, role=textbox, button, dialog, menu, canvas, timeline and layer-list targets.
- Assert that unmatched/reserved events do not call preventDefault and do not mutate editor state.
- Assert that Undo/Redo and destructive actions produce exactly one history transaction.

**Real browser**

- Exercise the actual pixel grid, layer list, timeline, dialogs and reference UI using Playwright keyboard input.
- Cover the Windows/Linux Ctrl path and the macOS Meta path using explicit test events or platform runs; do not infer one from the other.
- Verify browser-native text editing in fields while the app is open.
- Verify responsive reference access at the listed viewport widths.
- Verify focus restoration and accessible labels/states. Manual screen-reader review is still required; DOM assertions alone do not establish usability with assistive technology.

**Manual browser/OS smoke tests**

Browser chrome shortcuts cannot be fully simulated from page JavaScript. On supported desktop browsers, manually confirm that tab switching, address-bar focus, reload, browser find/print, Save Page, browser zoom, OS app switching and IME input remain available.

## 11. Phased implementation order

1. **Phase A — Focus safety and conflict handling (P0).** Centralize key routing; fix text-input undo/redo/save interception; ignore dialogs, menus, contenteditable, IME and AltGraph; remove the global Ctrl/Cmd+S binding; add reserved-key tests.
2. **Phase B — Existing shortcut correctness (P1).** Preserve and document tool, selection, clipboard, zoom and pixel-grid behavior. Add platform-correct modifier matching and labels.
3. **Phase C — Contextual navigation (P1).** Add keyboard-operable layer and timeline regions with roving focus, frame/layer navigation, and timeline-scoped playback/stop behavior.
4. **Phase D — Discoverability and accessibility (P1/P2).** Add the responsive shortcut reference, context labels, focus guidance, accessible names/states and keyboard-only/browser tests.

Do not begin Phase C until Phase A prevents global shortcuts from stealing keys from the wrong focus context.

## 12. Affected files and ownership

This is a planning document; none of these implementation files are changed by AC-026.

| File / area | Expected later use | Ownership / constraint |
|---|---|---|
| `KEYBOARD_SHORTCUTS_PLAN.md` | This specification | Agent 5 / AC-026 only |
| `index.html` | Current global/grid key handlers, toolbar shortcut legend, future help entry and focusable timeline/layer regions | Shared UI is coordinator-controlled. Do not edit without an explicit file lock and serialized integration slot. |
| Proposed `js/keyboard-shortcuts.js` | Optional centralized key map/router if extraction fits the plain-script loading pattern | New module only; coordinator must assign a single implementation owner. Avoid extracting if it adds needless build/module complexity. |
| Proposed `tests/keyboard-shortcuts.test.js` | Unit/interaction tests for routing, modifiers, focus and conflict behavior | New isolated test file; do not rewrite other agents' test files. |
| Proposed browser test file | Actual keyboard-only canvas/timeline/layer/dialog coverage | Prefer a new focused Playwright file. Agent 4 currently has sole ownership of `agent-bridge/e2e-test.mjs`; do not edit it. |
| `.github/workflows/project-tests.yml` | Optional CI step for the new browser test | Agent 3 owns the workflow during PR #11 reconciliation. A later owner needs an explicit release before editing it. |
| README / help documentation | Link users to the canonical shortcut reference | No README edit in AC-026; coordinator assigns documentation integration separately if needed. |

## 13. Definition of done

AC-026 is ready for review when:

- Existing shortcuts and source locations are accurately documented.
- Every proposed shortcut has an action, platform modifier, focus context and precondition.
- Browser and OS reserved combinations are explicitly excluded.
- Text inputs, contenteditable, dialogs, menus, focused buttons, IME and AltGraph behavior are specified.
- The matrix covers commands, both modifier paths, focus contexts and conflict cases.
- Keyboard-only and accessibility expectations are concrete.
- Implementation files, current ownership and integration locks are identified.
- No application code, test code, CSS, UI or command palette has been implemented as part of this specification.


## Post UI-01 source recheck — 2026-11-15

The current production shell has changed since the original AC-026 source inventory. This recheck uses the current main `index.html` blob `4645281c1aad8580529e7feb99cd299a88543913` and updates implementation priorities without claiming a keyboard implementation has shipped.

- The live tool rail is now inside the workstation shell, with the existing tool buttons and click handlers preserved. Tool activation continues through `setTool(name)`; it currently toggles the `.active` class and does not expose `aria-pressed` on the selected tool.
- The live zoom control remains three buttons: `#zoomOut`, `#zoomReset` and `#zoomIn`. The current percentage/reset control still invokes the fit-relative zoom factor, not a true Actual Size action.
- The live layer list remains a separate inspector region, and the frame strip remains in the bottom timeline. There is no keyboard-operable layer×frame cel matrix on the production page yet.
- The document-level handler still handles Ctrl/Cmd+Z and Ctrl/Cmd+S before checking whether an INPUT, SELECT or TEXTAREA owns focus. In the current handler, these chords call `preventDefault()` and invoke project undo/save before the `if(editing)return` guard. The native text-editing and browser Save Page conflicts in this spec remain live P1 findings.
- The key guard still does not identify contenteditable, role=textbox, IME composition or AltGraph before app commands. Preserve those cases and browser/OS reserved chords when implementation is assigned.
- The current production HTML still has no dedicated in-app shortcut-reference panel. The AC-053 reference remains a non-production static pattern until a coordinator UI slice is assigned.

**Implementation priority remains:** protect native editing/browser shortcuts first; then expose tool, palette, layer and frame state; only then add context-gated accelerators. This recheck is source-based; no live keyboard-only or screen-reader conformance test is claimed.
