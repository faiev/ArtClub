# Tiny Robot export examples

A small, original 8×8 pixel-art walk cycle demonstrating export artefacts:

- `walk-cycle.project.json` — editable One Pixel Studio v2 source project.
- `walk-cycle.png` — 19×19 RGBA sprite-sheet atlas.
- `walk-cycle.metadata.json` — versioned atlas rectangles, source frame IDs/names and original durations.
- `walk-cycle.gif` — 8×8, four-frame animation with binary transparency and centisecond timing.
- `walk-cycle.gif.metadata.json` — source/effective GIF frame timing and loop/transparency notes.
- `index.html` — static preview gallery.

The PNG atlas uses a two-column/two-row grid, a 1px outer margin and 1px inter-frame spacing. Each frame rectangle is 8×8.

The GIF keeps source timings alongside encoded timings: 145ms becomes 150ms and 155ms becomes 160ms. The GIF binary is a synthetic format illustration generated independently of the app's GIF89a encoder. It demonstrates visual and timing trade-offs, not byte-for-byte encoder output. Use the Chromium GIF browser test to verify the app encoder itself.

All pixels are synthetic and original; no copyrighted art is included.
