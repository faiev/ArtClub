# Deterministic autotile rule resolver

js/autotile.js is a pure, renderer-independent rules engine. It selects tile variant IDs from neighboring groups in a row-major tile map. It never reads or changes artwork pixels and never mutates the input map, catalog or ruleset.

## API

resolveAutotileMap(map, catalog, ruleset) returns a detached, deeply frozen result with:
- variantCells: row-major selected variant IDs; null denotes an empty source cell or unresolved cell.
- cells: null for empty cells, otherwise a per-cell resolved or unresolved record with source ID, group, exact neighbor mask, and selected rule/variant or reason.
- unresolved: explicit coordinate/index records with reason NO_RULE_MATCHED.
- stats: occupied, resolved and unresolved counts.

The source map is {width, height, cells}. cells is a flat row-major array of catalog tile IDs; null is empty. The catalog is an array of {id, group} entries. Catalog IDs must be unique and every source cell ID must exist in the catalog.

## Versioned ruleset schema

A ruleset uses schema artclub.autotile-rules.v1 and has:
- maskMode: exactly 4 or 8.
- directions: exact canonical order listed below; order cannot be changed.
- groups: array of {id, variants}. Each variant ID must be present in the catalog and belong to that group.
- rules: array of {id, group, mask, variant, priority, fallback?}. IDs are unique. priority is a safe integer. Rule variants must be declared in their group.

Rule masks use one character per direction: 1 means a neighboring cell is occupied by the same group as the center; 0 means empty, out of bounds, or a different group; ? matches either. A missing or invalid tile reference is an error, not an implicit zero.

### Four-neighbor masks

Order is **N, E, S, W**. A northwest corner with same-group cells to its east and south is **0110**. An isolated cell is **0000**. The all-wildcard fallback mask is **????**.

### Eight-neighbor masks

Order is **N, NE, E, SE, S, SW, W, NW**. A northwest corner with same-group neighbors east, southeast and south is **00111000**. An interior cell surrounded in all eight directions is **11111111**. The all-wildcard fallback mask is **????????**.

## Matching and deterministic precedence

For a given group and exact neighbor mask:
1. Keep all matching non-fallback rules.
2. Highest integer priority wins.
3. On equal priority, greater mask specificity (more fixed 0/1 characters, fewer ?) wins.
4. If multiple matching rules remain at the same priority and specificity, their variants must be identical. Overlapping equal-rank masks that yield different variants are rejected during validation rather than guessed at runtime.
5. If identical-variant ties remain, the lexicographically smallest rule ID by JavaScript code-unit order is reported as the winner.
6. Only when no regular rule matches is the group's single explicit fallback rule used. A fallback must set fallback: true and use an all-? mask. A group may omit fallback.

If neither a regular rule nor a fallback applies, the result cell has status unresolved and reason NO_RULE_MATCHED. The resolver never silently reuses the source variant or chooses an arbitrary catalog entry.

No rotation, mirroring or transform property is supported by this schema. Unknown rule properties such as rotation, flip or transform are rejected. A future transform extension would need its own versioned, explicit semantics.

## Validation and bounds

- Map width/height: integers from 1 to 4,096.
- Map cells: at most 262,144; buffer length must equal width × height.
- Catalog entries: at most 16,384; catalog IDs must be unique.
- Groups: at most 4,096; variant IDs unique within a group and owned by exactly one group.
- Variants per group: at most 4,096; total declared variants cannot exceed 16,384.
- Rules: at most 1,024; rule IDs unique; masks/directions/variants/groups validated before resolving cells.
- Conflicting equal-priority/equal-specificity overlapping rules with different variants are rejected.

All outputs are metadata and tile IDs only. Input map/catalog/ruleset are read-only. Empty map cells remain null; unresolved cells are explicitly represented in cells and unresolved, while their entry in variantCells is null.

## Fixtures and tests

Autotile-specific JSON fixtures are nested under tests/fixtures/tiles/autotile/ so the earlier general tile fixture runner can keep loading its own top-level fixture schema without interference. Tests cover 4-neighbor and 8-neighbor masks, corners, edges, inner and isolated cells, non-square boundaries, mixed groups, fallback, unresolved results, deterministic precedence, conflicts, duplicate/missing IDs, malformed masks, transform metadata rejection, immutability and bounds.

Run:
- node --check js/autotile.js
- node --check tests/autotile.test.js
- node --test tests/autotile.test.js

## Future UI/export boundary

The resolver returns an alternate tile-ID map only. A future UI may display it as a preview and let an artist explicitly accept it through the editor's safe edit/undo boundary. It must not mutate source map/catalog/pixels while previewing. Exporters consume canonical tile artwork and explicit accepted map/atlas data; the resolver does not render, encode images, or integrate into the editor UI.