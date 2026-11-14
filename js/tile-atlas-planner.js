/*
 * One Pixel Studio — deterministic, renderer-independent tile atlas layout planning.
 * Produces metadata only; it does not encode or copy artwork pixels.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubTileAtlasPlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LIMITS = Object.freeze({
    maxTileCount: 16384,
    maxTileDimension: 4096,
    maxAtlasDimension: 32768,
    maxAtlasPixels: 67108864,
    maxLayoutInset: 32768
  });
  function wholeNumber(value, label, minimum, maximum) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(label + " must be a whole number from " + minimum + " to " + maximum + ".");
    }
  }
  function validateIds(tileIds) {
    if (!Array.isArray(tileIds)) throw new TypeError("Tile IDs must be an Array.");
    if (tileIds.length < 1) throw new RangeError("At least one tile ID is required.");
    if (tileIds.length > LIMITS.maxTileCount) throw new RangeError("Tile count exceeds the limit of " + LIMITS.maxTileCount + ".");
    const seen = new Set(), ids = [];
    for (let i = 0; i < tileIds.length; i += 1) {
      const id = tileIds[i];
      if (typeof id !== "string" || id.trim().length === 0) {
        throw new TypeError("Tile ID at index " + i + " must be a non-empty string.");
      }
      if (seen.has(id)) throw new RangeError("Duplicate tile ID: " + id + ".");
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }
  function compareIds(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function freezePlan(plan) {
    for (const entry of plan.tiles) {
      Object.freeze(entry.tileRect);
      Object.freeze(entry.cellRect);
      Object.freeze(entry);
    }
    Object.freeze(plan.tiles);
    Object.freeze(plan.options);
    Object.freeze(plan.bounds);
    return Object.freeze(plan);
  }
  function planTileAtlas(tileIds, tileWidth, tileHeight, options) {
    wholeNumber(tileWidth, "Tile width", 1, LIMITS.maxTileDimension);
    wholeNumber(tileHeight, "Tile height", 1, LIMITS.maxTileDimension);
    const ids = validateIds(tileIds);
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Atlas options must be an object.");
    const normalized = {
      columns: options.columns === undefined ? Math.ceil(Math.sqrt(ids.length)) : options.columns,
      marginX: options.marginX === undefined ? 0 : options.marginX,
      marginY: options.marginY === undefined ? 0 : options.marginY,
      spacingX: options.spacingX === undefined ? 0 : options.spacingX,
      spacingY: options.spacingY === undefined ? 0 : options.spacingY,
      padding: options.padding === undefined ? 0 : options.padding
    };
    wholeNumber(normalized.columns, "Columns", 1, ids.length);
    for (const key of ["marginX", "marginY", "spacingX", "spacingY", "padding"]) {
      wholeNumber(normalized[key], key, 0, LIMITS.maxLayoutInset);
    }

    // Stable code-unit ID ordering is independent of locale and caller array order.
    ids.sort(compareIds);
    const rows = Math.ceil(ids.length / normalized.columns);
    const cellWidth = tileWidth + 2 * normalized.padding;
    const cellHeight = tileHeight + 2 * normalized.padding;
    const contentWidth = normalized.columns * cellWidth + (normalized.columns - 1) * normalized.spacingX;
    const contentHeight = rows * cellHeight + (rows - 1) * normalized.spacingY;
    const atlasWidth = contentWidth + 2 * normalized.marginX;
    const atlasHeight = contentHeight + 2 * normalized.marginY;
    const atlasPixels = atlasWidth * atlasHeight;
    if (!Number.isSafeInteger(atlasWidth) || !Number.isSafeInteger(atlasHeight) ||
        atlasWidth > LIMITS.maxAtlasDimension || atlasHeight > LIMITS.maxAtlasDimension) {
      throw new RangeError("Planned atlas dimensions exceed the maximum of " + LIMITS.maxAtlasDimension + " pixels per side.");
    }
    if (!Number.isSafeInteger(atlasPixels) || atlasPixels > LIMITS.maxAtlasPixels) {
      throw new RangeError("Planned atlas exceeds the pixel budget of " + LIMITS.maxAtlasPixels + ".");
    }
    const tiles = ids.map((id, index) => {
      const column = index % normalized.columns;
      const row = Math.floor(index / normalized.columns);
      const cellX = normalized.marginX + column * (cellWidth + normalized.spacingX);
      const cellY = normalized.marginY + row * (cellHeight + normalized.spacingY);
      return {
        id: id, index: index, row: row, column: column,
        cellRect: {x:cellX,y:cellY,width:cellWidth,height:cellHeight},
        tileRect: {x:cellX+normalized.padding,y:cellY+normalized.padding,width:tileWidth,height:tileHeight}
      };
    });
    return freezePlan({
      version: 1, tileWidth: tileWidth, tileHeight: tileHeight, tileCount: ids.length,
      columns: normalized.columns, rows: rows,
      bounds: {width:atlasWidth,height:atlasHeight,pixels:atlasPixels},
      options: normalized, tiles: tiles
    });
  }
  return Object.freeze({LIMITS:LIMITS,planTileAtlas:planTileAtlas});
});
