# Tile-map data model

\`js/tile-map.js\` is a deterministic, bounded, renderer-independent model for placing tile IDs in a row-major map. It is available as \`window.ArtClubTileMap\` and through CommonJS.

## Data contract

A map stores a format/version, map width and height, tile pixel dimensions, tile definitions, and a flat \`cells\` array. A cell is either \`null\` or a tile-definition ID. Indexing is \`y * width + x\`. Definitions have unique non-empty IDs, matching tile dimensions, and optional bounded names. Sparse and \`undefined\` cells are rejected.

## Operations

- \`createTileMap(options)\`, \`validateTileMap(map)\`, \`resizeTileMap(map, width, height)\`
- \`placeTile\`, \`eraseTile\`, \`moveTile\` (reject/swap/replace), \`duplicateTile\` (explicit overwrite)
- \`copySelection\` and \`pasteSelection\` use rectangular row-major clipboard payloads
- \`serializeTileMap\` sorts definitions by ID for deterministic JSON; \`deserializeTileMap\` validates before cloning

All edits return fresh maps and never mutate their source. Pasting over occupied cells and replacing move/duplicate destinations require explicit options. Crop-like selection bounds are strict; the model never silently clips.

## Limits

Map sides are capped at 2,048 cells and map storage at 1,048,576 cells. Tile sides are capped at 4,096 pixels, definitions at 65,536, IDs at 128 characters and names at 200 characters. Limits are exported in the frozen \`LIMITS\` object.

## Tests

Run \`node --test tests/tile-map.test.js\`. Tests cover row-major layout, resize, place/erase/move/duplicate, clipboard selection/paste, deterministic round-trip serialization, malformed references and dimensions, immutability and allocation limits.
