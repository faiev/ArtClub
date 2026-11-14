# Tile atlas layout planner

The tile-atlas-planner module creates deterministic atlas layout metadata for a list of tile IDs and a shared tile size. It is renderer- and exporter-independent. It does not read, duplicate, encode or mutate artwork pixels.

## API

planTileAtlas(tileIds, tileWidth, tileHeight, options) returns a versioned immutable layout plan. Tile IDs are copied and sorted by deterministic code-unit order before row-major placement. Duplicate or blank IDs are rejected.

Options:
- columns: explicit column count; defaults to the ceiling of the square root of tile count.
- marginX and marginY: outer atlas margins.
- spacingX and spacingY: gaps between adjacent cells.
- padding: transparent inset reserved around each tile inside its cell.

All distances are non-negative integer pixels. Tile dimensions are positive integer pixels.

## Geometry

A cell includes the tile dimensions plus twice the per-side padding. cellRect describes that padded slot. tileRect is the metadata rectangle for the actual tile image, inset by padding. Margins surround the whole grid; spacing is applied only between cells. The final row may be partially filled.

The plan includes bounds (width, height, pixel count), grid dimensions, normalized options, and per-tile ID/index/row/column/cell/tile rectangles. A later exporter can use the rectangles to composite tile pixels; this module deliberately does not do so.

## Bounds and determinism

The planner limits tile count to 16,384, tile dimensions to 4,096 per side, atlas dimensions to 32,768 per side, and atlas area to 67,108,864 pixels. All geometry is integer arithmetic. IDs use JavaScript code-unit ordering rather than locale-dependent collation so identical inputs produce identical metadata across environments.

## Tests

Run node --check js/tile-atlas-planner.js and node --test tests/tile-atlas-planner.test.js. Tests cover ordering, grid geometry, margins, spacing, padding, rectangular tiles, partial rows, deterministic results, validation and allocation bounds.
