/*
 * Deterministic, renderer-independent autotile variant resolution.
 * Data in; detached metadata/map out. No artwork pixels are read or written.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubAutotile = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DIRECTIONS = Object.freeze({
    4: Object.freeze(["N", "E", "S", "W"]),
    8: Object.freeze(["N", "NE", "E", "SE", "S", "SW", "W", "NW"])
  });
  const DELTAS = Object.freeze({
    N: Object.freeze([0, -1]), NE: Object.freeze([1, -1]), E: Object.freeze([1, 0]),
    SE: Object.freeze([1, 1]), S: Object.freeze([0, 1]), SW: Object.freeze([-1, 1]),
    W: Object.freeze([-1, 0]), NW: Object.freeze([-1, -1])
  });
  const LIMITS = Object.freeze({
    maxDimension: 4096, maxMapCells: 262144, maxCatalogEntries: 16384,
    maxGroups: 4096, maxVariantsPerGroup: 4096, maxRules: 1024
  });
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isRecord = value => value !== null && typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const codeUnitCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function assertKeys(record, allowed, label) {
    for (const key of Object.keys(record)) {
      if (!allowed.includes(key)) throw new TypeError(label + " contains unsupported field '" + key + "'.");
    }
  }
  function assertId(value, label) {
    if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
      throw new TypeError(label + " must be a non-empty string without surrounding whitespace.");
    }
  }
  function assertWhole(value, label, min, max) {
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new RangeError(label + " must be a whole number from " + min + " to " + max + ".");
    }
  }
  function validateMap(map) {
    if (!isRecord(map)) throw new TypeError("Tile map must be a plain object.");
    assertKeys(map, ["width", "height", "cells"], "Tile map");
    assertWhole(map.width, "Map width", 1, LIMITS.maxDimension);
    assertWhole(map.height, "Map height", 1, LIMITS.maxDimension);
    const count = map.width * map.height;
    if (!Number.isSafeInteger(count) || count > LIMITS.maxMapCells) {
      throw new RangeError("Tile map exceeds the cell limit of " + LIMITS.maxMapCells + ".");
    }
    if (!Array.isArray(map.cells) || map.cells.length !== count) {
      throw new RangeError("Map cells must be a row-major Array of exactly width × height entries.");
    }
    for (let index = 0; index < count; index += 1) {
      const tileId = map.cells[index];
      if (tileId !== null) assertId(tileId, "Map tile ID at index " + index);
    }
    return count;
  }

  function validateRuleset(ruleset, catalog) {
    if (!isRecord(ruleset)) throw new TypeError("Autotile ruleset must be a plain object.");
    assertKeys(ruleset, ["schema", "maskMode", "directions", "groups", "rules"], "Autotile ruleset");
    if (ruleset.schema !== "artclub.autotile-rules.v1") throw new TypeError("Unsupported autotile ruleset schema.");
    if (ruleset.maskMode !== 4 && ruleset.maskMode !== 8) throw new RangeError("maskMode must be 4 or 8.");
    const directions = DIRECTIONS[ruleset.maskMode];
    if (!Array.isArray(ruleset.directions) || ruleset.directions.length !== directions.length ||
        directions.some((direction, index) => ruleset.directions[index] !== direction)) {
      throw new TypeError("Directions must exactly match the documented " + ruleset.maskMode +
        "-neighbor ordering: " + directions.join(",") + ".");
    }
    if (!Array.isArray(ruleset.groups) || ruleset.groups.length === 0 || ruleset.groups.length > LIMITS.maxGroups) {
      throw new RangeError("Ruleset groups must be a non-empty Array within the group limit.");
    }
    const groupsById = new Map();
    const variantOwners = new Map();
    let totalVariants = 0;
    for (let index = 0; index < ruleset.groups.length; index += 1) {
      const group = ruleset.groups[index];
      if (!isRecord(group)) throw new TypeError("Group " + index + " must be a plain object.");
      assertKeys(group, ["id", "variants"], "Group " + index);
      assertId(group.id, "Group ID at index " + index);
      if (groupsById.has(group.id)) throw new RangeError("Duplicate group ID: " + group.id + ".");
      if (!Array.isArray(group.variants) || group.variants.length === 0 ||
          group.variants.length > LIMITS.maxVariantsPerGroup) {
        throw new RangeError("Group '" + group.id + "' must list at least one variant within the variant limit.");
      }
      const variants = new Set();
      totalVariants += group.variants.length;
      if (totalVariants > LIMITS.maxCatalogEntries) {
        throw new RangeError("Total declared variants exceed the catalog-entry limit.");
      }
      for (const variantId of group.variants) {
        assertId(variantId, "Variant ID in group '" + group.id + "'");
        if (variants.has(variantId)) {
          throw new RangeError("Duplicate variant ID '" + variantId + "' in group '" + group.id + "'.");
        }
        variants.add(variantId);
        if (variantOwners.has(variantId)) {
          throw new RangeError("Variant ID '" + variantId + "' is listed by more than one group.");
        }
        variantOwners.set(variantId, group.id);
        const catalogEntry = catalog.get(variantId);
        if (!catalogEntry) throw new RangeError("Missing catalog variant '" + variantId + "'.");
        if (catalogEntry.group !== group.id) {
          throw new RangeError("Variant '" + variantId + "' is not in catalog group '" + group.id + "'.");
        }
      }
      groupsById.set(group.id, { id: group.id, variants: variants });
    }

    if (!Array.isArray(ruleset.rules) || ruleset.rules.length > LIMITS.maxRules) {
      throw new RangeError("Rules must be an Array within the rule limit of " + LIMITS.maxRules + ".");
    }
    const ruleIds = new Set();
    const rulesByGroup = new Map();
    for (const groupId of groupsById.keys()) rulesByGroup.set(groupId, []);
    const fallbacks = new Map();
    const maskLength = directions.length;
    for (let index = 0; index < ruleset.rules.length; index += 1) {
      const rule = ruleset.rules[index];
      if (!isRecord(rule)) throw new TypeError("Rule " + index + " must be a plain object.");
      assertKeys(rule, ["id", "group", "mask", "variant", "priority", "fallback"], "Rule " + index);
      assertId(rule.id, "Rule ID at index " + index);
      assertId(rule.group, "Rule group for '" + rule.id + "'");
      assertId(rule.variant, "Rule variant for '" + rule.id + "'");
      if (ruleIds.has(rule.id)) throw new RangeError("Duplicate rule ID: " + rule.id + ".");
      ruleIds.add(rule.id);
      if (!groupsById.has(rule.group)) {
        throw new RangeError("Rule '" + rule.id + "' references unknown group '" + rule.group + "'.");
      }
      if (!groupsById.get(rule.group).variants.has(rule.variant)) {
        throw new RangeError("Rule '" + rule.id + "' references missing variant '" + rule.variant +
          "' for group '" + rule.group + "'.");
      }
      if (typeof rule.mask !== "string" || rule.mask.length !== maskLength || !/^[01?]+$/.test(rule.mask)) {
        throw new TypeError("Rule '" + rule.id + "' mask must contain exactly " + maskLength +
          " characters from 0, 1 and ? in the declared direction order.");
      }
      if (!Number.isSafeInteger(rule.priority)) {
        throw new TypeError("Rule '" + rule.id + "' priority must be a safe integer.");
      }
      const fallback = rule.fallback === true;
      if (rule.fallback !== undefined && typeof rule.fallback !== "boolean") {
        throw new TypeError("Rule '" + rule.id + "' fallback must be a boolean.");
      }
      if (fallback && rule.mask !== "?".repeat(maskLength)) {
        throw new TypeError("Fallback rule '" + rule.id + "' must use an all-wildcard mask.");
      }
      const compiled = Object.freeze({
        id: rule.id, group: rule.group, mask: rule.mask, variant: rule.variant,
        priority: rule.priority,
        specificity: maskLength - (rule.mask.match(/\?/g) || []).length,
        fallback: fallback
      });
      if (fallback) {
        if (fallbacks.has(rule.group)) {
          throw new RangeError("Group '" + rule.group + "' has more than one fallback rule.");
        }
        fallbacks.set(rule.group, compiled);
      } else {
        rulesByGroup.get(rule.group).push(compiled);
      }
    }
    for (const groupRules of rulesByGroup.values()) {
      for (let a = 0; a < groupRules.length; a += 1) {
        for (let b = a + 1; b < groupRules.length; b += 1) {
          const first = groupRules[a], second = groupRules[b];
          if (first.priority === second.priority && first.specificity === second.specificity &&
              first.variant !== second.variant && patternsOverlap(first.mask, second.mask)) {
            throw new RangeError("Conflicting equal-priority rules '" + first.id + "' and '" +
              second.id + "' can match the same neighbor mask.");
          }
        }
      }
    }
    return { groupsById, rulesByGroup, fallbacks, directions };
  }

  function patternsOverlap(a, b) {
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== "?" && b[i] !== "?" && a[i] !== b[i]) return false;
    }
    return true;
  }
  function matches(ruleMask, bits) {
    for (let i = 0; i < ruleMask.length; i += 1) {
      if (ruleMask[i] !== "?" && ruleMask[i] !== bits[i]) return false;
    }
    return true;
  }
  function buildLookup(groupRules, fallback, maskLength) {
    const lookup = new Array(1 << maskLength);
    for (let value = 0; value < lookup.length; value += 1) {
      const bits = value.toString(2).padStart(maskLength, "0");
      const candidates = groupRules.filter(rule => matches(rule.mask, bits));
      if (candidates.length) {
        candidates.sort((a, b) =>
          b.priority - a.priority || b.specificity - a.specificity || codeUnitCompare(a.id, b.id));
        lookup[value] = candidates[0];
      } else {
        lookup[value] = fallback || null;
      }
    }
    return lookup;
  }
  function neighborMask(map, catalogById, directions, x, y, centerGroup) {
    let bits = "";
    for (const direction of directions) {
      const [dx, dy] = DELTAS[direction];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
        bits += "0";
        continue;
      }
      const neighborId = map.cells[ny * map.width + nx];
      const neighbor = neighborId === null ? null : catalogById.get(neighborId);
      bits += neighbor && neighbor.group === centerGroup ? "1" : "0";
    }
    return bits;
  }
  function deepFreezeResult(result) {
    for (const item of result.cells) if (item) Object.freeze(item);
    for (const item of result.unresolved) Object.freeze(item);
    Object.freeze(result.cells); Object.freeze(result.variantCells); Object.freeze(result.unresolved);
    Object.freeze(result.stats); Object.freeze(result.directions);
    return Object.freeze(result);
  }

  function resolveAutotileMap(map, catalog, ruleset) {
    const cellCount = validateMap(map);
    if (!isRecord(ruleset)) throw new TypeError("Autotile ruleset must be a plain object.");
    if (!Array.isArray(ruleset.groups)) throw new TypeError("Ruleset groups must be an Array.");
    if (ruleset.groups.length === 0 || ruleset.groups.length > LIMITS.maxGroups) {
      throw new RangeError("Ruleset groups must be a non-empty Array within the group limit.");
    }
    const groupIds = new Set();
    for (const group of ruleset.groups) {
      if (isRecord(group) && typeof group.id === "string") groupIds.add(group.id);
    }
    if (!Array.isArray(catalog)) throw new TypeError("Tile catalog must be an Array of {id, group} records.");
    const catalogById = new Map();
    if (catalog.length > LIMITS.maxCatalogEntries) {
      throw new RangeError("Catalog exceeds the entry limit of " + LIMITS.maxCatalogEntries + ".");
    }
    for (let index = 0; index < catalog.length; index += 1) {
      const entry = catalog[index];
      if (!isRecord(entry)) throw new TypeError("Catalog entry " + index + " must be a plain object.");
      assertKeys(entry, ["id", "group"], "Catalog entry " + index);
      assertId(entry.id, "Catalog ID at index " + index);
      assertId(entry.group, "Catalog group for '" + entry.id + "'");
      if (catalogById.has(entry.id)) throw new RangeError("Duplicate catalog tile ID: " + entry.id + ".");
      if (!groupIds.has(entry.group)) {
        throw new RangeError("Catalog tile '" + entry.id + "' references unknown group '" + entry.group + "'.");
      }
      catalogById.set(entry.id, Object.freeze({ id: entry.id, group: entry.group }));
    }
    const compiled = validateRuleset(ruleset, catalogById);
    const lookupByGroup = new Map();
    for (const groupId of compiled.groupsById.keys()) {
      lookupByGroup.set(groupId, buildLookup(
        compiled.rulesByGroup.get(groupId), compiled.fallbacks.get(groupId) || null, compiled.directions.length
      ));
    }
    for (let index = 0; index < cellCount; index += 1) {
      const tileId = map.cells[index];
      if (tileId !== null && !catalogById.has(tileId)) {
        throw new RangeError("Map references missing catalog tile ID '" + tileId + "' at index " + index + ".");
      }
    }
    const results = new Array(cellCount).fill(null);
    const variantCells = new Array(cellCount).fill(null);
    const unresolved = [];
    let occupied = 0, resolved = 0;
    for (let index = 0; index < cellCount; index += 1) {
      const sourceTileId = map.cells[index];
      if (sourceTileId === null) continue;
      occupied += 1;
      const x = index % map.width, y = Math.floor(index / map.width);
      const group = catalogById.get(sourceTileId).group;
      const mask = neighborMask(map, catalogById, compiled.directions, x, y, group);
      const winner = lookupByGroup.get(group)[parseInt(mask, 2)];
      if (!winner) {
        const item = { x, y, index, sourceTileId, group, mask, status: "unresolved", reason: "NO_RULE_MATCHED" };
        results[index] = item;
        unresolved.push({ x, y, index, sourceTileId, group, mask, reason: "NO_RULE_MATCHED" });
      } else {
        results[index] = {
          x, y, index, sourceTileId, group, mask, status: "resolved",
          variantTileId: winner.variant, ruleId: winner.id
        };
        variantCells[index] = winner.variant;
        resolved += 1;
      }
    }
    return deepFreezeResult({
      schema: "artclub.autotile-result.v1",
      width: map.width, height: map.height, maskMode: ruleset.maskMode,
      directions: compiled.directions.slice(),
      cells: results, variantCells, unresolved,
      stats: { occupied, resolved, unresolved: unresolved.length }
    });
  }

  return Object.freeze({ DIRECTIONS, LIMITS, resolveAutotileMap });
});
