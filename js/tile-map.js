/*!
 * One Pixel Studio — deterministic, bounded tile-map model.
 * Browser-global + CommonJS. All edits return new maps.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubTileMap = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const FORMAT = "one-pixel-studio-tile-map";
  const VERSION = 1;
  const LIMITS = Object.freeze({
    maxMapDimension: 2048, maxMapCells: 1048576,
    maxTileDimension: 4096, maxTileDefinitions: 65536,
    maxIdLength: 128, maxNameLength: 200
  });
  function integer(v, label, max) {
    if (!Number.isSafeInteger(v) || v < 1 || v > max) throw new RangeError(label + " must be a whole number between 1 and " + max + ".");
  }
  function size(w, h) {
    integer(w, "Map width", LIMITS.maxMapDimension);
    integer(h, "Map height", LIMITS.maxMapDimension);
    const n = w * h;
    if (!Number.isSafeInteger(n) || n > LIMITS.maxMapCells) throw new RangeError("Map exceeds the safe cell limit.");
    return n;
  }
  function copyTiles(tiles) {
    return tiles.map(t => t.name === undefined ? { id: t.id, width: t.width, height: t.height } :
      { id: t.id, width: t.width, height: t.height, name: t.name });
  }
  function checkTiles(tiles, tw, th) {
    const errors = [];
    if (!Array.isArray(tiles)) return ["Tile definitions must be an array."];
    if (tiles.length > LIMITS.maxTileDefinitions) return ["Tile definitions exceed the safe limit."];
    const ids = new Set();
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (!t || typeof t !== "object" || Array.isArray(t)) { errors.push("Tile definition " + i + " must be an object."); continue; }
      if (typeof t.id !== "string" || !t.id.length || t.id.length > LIMITS.maxIdLength) errors.push("Tile IDs must be non-empty strings of at most 128 characters.");
      else if (ids.has(t.id)) errors.push("Duplicate tile ID: " + t.id);
      else ids.add(t.id);
      if (t.width !== tw || t.height !== th) errors.push("Tile dimensions must match the map tile dimensions.");
      if (t.name !== undefined && (typeof t.name !== "string" || t.name.length > LIMITS.maxNameLength)) errors.push("Tile name is invalid.");
    }
    return errors;
  }
  function validateTileMap(m) {
    const errors = [];
    if (!m || typeof m !== "object" || Array.isArray(m)) return { valid: false, errors: ["Tile map must be an object."] };
    if (m.format !== FORMAT) errors.push("Unrecognized tile-map format.");
    if (m.version !== VERSION) errors.push("Unsupported tile-map version.");
    let count = null;
    try { count = size(m.width, m.height); } catch (e) { errors.push(e.message); }
    try {
      integer(m.tileWidth, "Tile width", LIMITS.maxTileDimension);
      integer(m.tileHeight, "Tile height", LIMITS.maxTileDimension);
      errors.push(...checkTiles(m.tiles, m.tileWidth, m.tileHeight));
    } catch (e) { errors.push(e.message); }
    if (!Array.isArray(m.cells)) errors.push("Tile-map cells must be an array.");
    else if (count !== null && m.cells.length !== count) errors.push("Cells must contain exactly width × height entries.");
    else if (count !== null) {
      const ids = new Set(Array.isArray(m.tiles) ? m.tiles.filter(Boolean).map(t => t.id) : []);
      for (let i = 0; i < count; i++) {
        const cell = m.cells[i];
        if (cell === undefined) { errors.push("Cells must not contain sparse or undefined entries at index " + i); break; }
        if (cell !== null && (typeof cell !== "string" || !ids.has(cell))) { errors.push("Cell " + i + " references an unknown tile ID."); break; }
      }
    }
    return { valid: errors.length === 0, errors };
  }
  function assertValid(m) {
    const r = validateTileMap(m);
    if (!r.valid) throw new Error("Invalid tile map: " + r.errors.join(" "));
  }
  function clone(m) {
    assertValid(m);
    return { format: FORMAT, version: VERSION, width: m.width, height: m.height,
      tileWidth: m.tileWidth, tileHeight: m.tileHeight, tiles: copyTiles(m.tiles), cells: m.cells.slice() };
  }
  function createTileMap(o) {
    o = o === undefined ? {} : o;
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new TypeError("Tile-map options must be an object.");
    const width = o.width === undefined ? 16 : o.width;
    const height = o.height === undefined ? 16 : o.height;
    const tileWidth = o.tileWidth === undefined ? 16 : o.tileWidth;
    const tileHeight = o.tileHeight === undefined ? 16 : o.tileHeight;
    const count = size(width, height);
    integer(tileWidth, "Tile width", LIMITS.maxTileDimension);
    integer(tileHeight, "Tile height", LIMITS.maxTileDimension);
    const tiles = o.tiles === undefined ? [] : o.tiles;
    if (!Array.isArray(tiles)) throw new TypeError("Tile definitions must be an array.");
    const map = { format: FORMAT, version: VERSION, width, height, tileWidth, tileHeight,
      tiles: copyTiles(tiles), cells: o.cells === undefined ? new Array(count).fill(null) : o.cells.slice() };
    assertValid(map);
    return map;
  }
  function index(m, x, y, label) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= m.width || y >= m.height)
      throw new RangeError((label || "Cell") + " coordinates must be inside the map.");
    return y * m.width + x;
  }
  function assertTile(m, id) {
    if (typeof id !== "string" || !m.tiles.some(t => t.id === id)) throw new RangeError("Tile ID must reference a definition in this map.");
  }
  function resizeTileMap(m, width, height) {
    assertValid(m);
    const n = size(width, height), next = clone(m), cells = new Array(n).fill(null);
    for (let y = 0; y < Math.min(m.height, height); y++)
      for (let x = 0; x < Math.min(m.width, width); x++) cells[y * width + x] = m.cells[y * m.width + x];
    next.width = width; next.height = height; next.cells = cells;
    return next;
  }
  function placeTile(m, x, y, id) {
    assertValid(m); const i = index(m, x, y); assertTile(m, id);
    const next = clone(m); next.cells[i] = id; return next;
  }
  function eraseTile(m, x, y) {
    assertValid(m); const i = index(m, x, y);
    const next = clone(m); next.cells[i] = null; return next;
  }
  function moveTile(m, fx, fy, tx, ty, options) {
    assertValid(m);
    const from = index(m, fx, fy, "Source cell"), to = index(m, tx, ty, "Destination cell");
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Move options must be an object.");
    const mode = options.mode === undefined ? "reject" : options.mode;
    if (!["reject", "swap", "replace"].includes(mode)) throw new RangeError("Move mode must be reject, swap or replace.");
    if (from === to) return clone(m);
    const src = m.cells[from], dst = m.cells[to];
    if (src === null) throw new RangeError("Cannot move an empty source cell.");
    if (dst !== null && mode === "reject") throw new RangeError("Destination cell is occupied.");
    const next = clone(m); next.cells[to] = src; next.cells[from] = mode === "swap" ? dst : null; return next;
  }
  function duplicateTile(m, fx, fy, tx, ty, options) {
    assertValid(m);
    const from = index(m, fx, fy, "Source cell"), to = index(m, tx, ty, "Destination cell");
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options) ||
        (options.overwrite !== undefined && typeof options.overwrite !== "boolean")) throw new TypeError("Duplicate options require an optional boolean overwrite value.");
    const src = m.cells[from];
    if (src === null) throw new RangeError("Cannot duplicate an empty source cell.");
    if (m.cells[to] !== null && options.overwrite !== true && from !== to) throw new RangeError("Destination cell is occupied.");
    const next = clone(m); next.cells[to] = src; return next;
  }
  function rect(m, r, label) {
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new TypeError((label || "Rectangle") + " must be an object.");
    const { x, y, width, height } = r;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 ||
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
      throw new RangeError("Rectangle requires non-negative coordinates and positive integer dimensions.");
    if (x + width > m.width || y + height > m.height) throw new RangeError((label || "Rectangle") + " must fit inside the map.");
    return { x, y, width, height };
  }
  function copySelection(m, r) {
    assertValid(m); r = rect(m, r, "Selection");
    const cells = new Array(r.width * r.height);
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++)
      cells[y * r.width + x] = m.cells[(r.y + y) * m.width + r.x + x];
    return { width: r.width, height: r.height, cells };
  }
  function validateClipboard(c, m) {
    if (!c || typeof c !== "object" || Array.isArray(c)) throw new TypeError("Clipboard must be an object.");
    const n = size(c.width, c.height);
    if (!Array.isArray(c.cells) || c.cells.length !== n) throw new RangeError("Clipboard cells must match its dimensions.");
    const ids = new Set(m.tiles.map(t => t.id));
    for (const v of c.cells) if (v === undefined || (v !== null && (typeof v !== "string" || !ids.has(v))))
      throw new TypeError("Clipboard contains an undefined cell or unknown tile reference.");
  }
  function pasteSelection(m, c, x, y, options) {
    assertValid(m); validateClipboard(c, m);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x + c.width > m.width || y + c.height > m.height)
      throw new RangeError("Paste rectangle must fit inside the map.");
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options) ||
        (options.overwrite !== undefined && typeof options.overwrite !== "boolean")) throw new TypeError("Paste overwrite must be boolean.");
    if (options.overwrite !== true) for (let row = 0; row < c.height; row++) for (let col = 0; col < c.width; col++)
      if (m.cells[(y + row) * m.width + x + col] !== null) throw new RangeError("Paste destination is occupied.");
    const next = clone(m);
    for (let row = 0; row < c.height; row++) for (let col = 0; col < c.width; col++)
      next.cells[(y + row) * m.width + x + col] = c.cells[row * c.width + col];
    return next;
  }
  function serializeTileMap(m, space) {
    assertValid(m);
    if (space !== undefined && typeof space !== "number" && typeof space !== "string") throw new TypeError("JSON spacing must be a number or string.");
    const next = clone(m); next.tiles.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return JSON.stringify(next, null, space === undefined ? 0 : space);
  }
  function deserializeTileMap(input) {
    let value = input;
    if (typeof input === "string") { try { value = JSON.parse(input); } catch (_) { throw new Error("Tile-map file is not valid JSON."); } }
    assertValid(value); return clone(value);
  }
  return Object.freeze({ FORMAT, VERSION, LIMITS, createTileMap, validateTileMap, resizeTileMap,
    placeTile, eraseTile, moveTile, duplicateTile, copySelection, pasteSelection, serializeTileMap, deserializeTileMap });
});