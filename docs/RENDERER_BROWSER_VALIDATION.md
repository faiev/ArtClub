# Canvas renderer browser visual and accessibility validation

## Purpose and boundary

This is an isolated renderer inspection fixture, not an editor integration. It loads the Canvas renderer with a minimal labelled canvas, keyboard navigation boundary controls and a decorative DOM overlay. It does not claim complete keyboard editing or screen-reader parity with the existing per-pixel DOM grid.

## Automated Chromium matrix

From the repository root, install the existing bridge dependencies and Chromium:

```sh
cd agent-bridge
npm install --ignore-scripts
npx playwright install chromium
node ../tests/canvas-renderer-accessibility.mjs
```

The runner creates independent Chromium contexts at DPR 1, 1.25, 1.5 and 2. For each it checks:

- Visible and overlay backing-store dimensions equal rounded CSS dimensions × DPR, while logical ImageData remains at project dimensions.
- High-contrast white grid and magenta selection remain visibly composited, while the artwork ImageData is byte-for-byte unchanged.
- Pointer mapping uses CSS/client coordinates and remains stable across DPR changes.
- The canvas has a descriptive accessible name, an explicit role and a visible keyboard focus indicator. Tab/Shift+Tab moves from the previous control to canvas and onward to the next control without a focus trap; the decorative overlay is not a tab stop.
- A DOM affordance with `pointer-events:none` does not intercept pointer input to the canvas.
- CSS resize followed by render recreates backing dimensions without discarding the logical pixel buffer.
- Twenty-four repeated mount/render/destroy/remove cycles clear ImageData and offscreen surfaces, reject rendering after destroy and leave no extra visible canvas nodes.

### Fractional CSS sizing note

The fixture uses fractional CSS dimensions and passes the measured `getBoundingClientRect().width/height` into the renderer's `displayWidth/displayHeight` options. This is deliberate: the default `clientWidth/clientHeight` CSSOM properties are integer-valued and can round fractional layout dimensions before backing-store allocation. Any future integration that needs exact fractional backing dimensions should supply the measured DOMRect dimensions (and refresh those option values after resize).

## Manual inspection checklist

- [ ] Run at browser zoom 80%, 100%, 125%, 150% and 200%; record CSS bounds, `window.devicePixelRatio`, visible backing dimensions and whether grid/selection edges stay crisp.
- [ ] Use keyboard only: Tab to previous control, canvas, next control; Shift+Tab in reverse. Confirm visible focus and ability to leave the canvas.
- [ ] Confirm the canvas has a programmatic name. If the editor later adds editing commands, add command-specific help and accessible pixel/cell context; this fixture does not claim full screen-reader editing parity.
- [ ] Put a DOM selection/cursor decoration over the canvas and confirm `pointer-events:none`, `aria-hidden` when decorative, and no interception of pointer/touch input.
- [ ] Toggle grid and selection using the high-contrast colors in the fixture. Confirm guides are visually distinct without changing artwork ImageData.
- [ ] Resize the browser window and side panels. Refresh fractional display width/height from `getBoundingClientRect()`, re-render, and confirm logical pixels remain unchanged.
- [ ] Zoom in/out using the viewport transform. Confirm pointer mapping remains based on CSS/client coordinates, not backing-store pixels.
- [ ] Repeat mount/unmount. Confirm visible canvas nodes and renderer backing resources do not accumulate; destroy renderer resources before removing the canvas.

## Evidence from the local Chromium run

- Browser: Chromium 144.0.7559.96 (headless, Linux x86_64).
- Context DPR matrix: 1, 1.25, 1.5 and 2.
- Per DPR: 10 visual/backing assertions passed; keyboard focus boundaries, accessible name/role, pointer-transparent overlay, fractional resize/backing-store recreation passed; 24/24 teardown cycles passed.
- Page errors: 0 across the four contexts.
- A DPR 1.5 full-page screenshot was captured during the run as a visual reference. The screenshot is a separate handoff artifact, not a repository asset. The runner can save one screenshot per DPR by setting `ARTCLUB_RENDERER_SCREENSHOT_DIR`.
- This run did not automate browser chrome zoom, operating-system display scaling, screen-reader speech, or actual memory reclamation after garbage collection. Use the manual checklist for those cases; backing-store reset checks are not a heap-profile measurement.

## Integration boundary

No changes to `index.html`, the active DOM renderer, project model, Agent API, MCP, bridge or GitHub Actions workflow. The workflow file remains owned by Agent 3 until released. Canvas remains an isolated prototype until a coordinator-authorized integration phase supplies keyboard navigation, focused-cell semantics, editing commands and screen-reader interaction tests.
