"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resolveAutotileMap, LIMITS } = require("../js/autotile.js");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "tiles", "autotile");
function loadFixtures() {
  return fs.readdirSync(FIXTURE_DIR).filter(name => name.endsWith(".json")).sort().map(name => {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8"));
    assert.equal(fixture.schema, "artclub.autotile-fixture.v1", name);
    assert.equal(fixture.id, path.basename(name, ".json"), name);
    return fixture;
  });
}
function resolveFixture(fixture) {
  const mapBefore = JSON.stringify(fixture.map);
  const catalogBefore = JSON.stringify(fixture.catalog);
  const rulesBefore = JSON.stringify(fixture.ruleset);
  const result = resolveAutotileMap(fixture.map, fixture.catalog, fixture.ruleset);
  assert.equal(JSON.stringify(fixture.map), mapBefore, "source map must be unchanged");
  assert.equal(JSON.stringify(fixture.catalog), catalogBefore, "catalog must be unchanged");
  assert.equal(JSON.stringify(fixture.ruleset), rulesBefore, "ruleset must be unchanged");
  return result;
}
function basicInputs(overrides = {}) {
  const map = { width: 1, height: 1, cells: ["base"] };
  const catalog = [
    { id: "base", group: "g" },
    { id: "v-a", group: "g" },
    { id: "v-b", group: "g" },
    { id: "v-default", group: "g" }
  ];
  const ruleset = {
    schema: "artclub.autotile-rules.v1",
    maskMode: 4,
    directions: ["N", "E", "S", "W"],
    groups: [{ id: "g", variants: ["v-a", "v-b", "v-default"] }],
    rules: [{ id: "fallback", group: "g", mask: "????", variant: "v-default", priority: 0, fallback: true }]
  };
  return { map: overrides.map || map, catalog: overrides.catalog || catalog, ruleset: overrides.ruleset || ruleset };
}

test("loads four exact versioned fixtures covering corners, edges, inner, isolated and unresolved cells", () => {
  const fixtures = loadFixtures();
  assert.deepEqual(fixtures.map(f => f.id), ["eight-neighbor-patterns", "four-neighbor-patterns", "isolated-cell", "non-square-unresolved"]);
  assert.equal(fixtures.length, 4);
});

test("resolves exact four-neighbor masks and applies explicit fallback", () => {
  const fixture = loadFixtures().find(f => f.id === "four-neighbor-patterns");
  const result = resolveFixture(fixture);
  assert.deepEqual(result.variantCells, fixture.expect.variantCells);
  assert.deepEqual(result.cells.map(c => c && c.mask), fixture.expect.masks);
  assert.equal(result.stats.unresolved, fixture.expect.unresolvedCount);
  assert.equal(result.cells[0].ruleId, "ground-corner-nw");
  assert.equal(result.cells[4].ruleId, "ground-inner");
  assert.equal(result.cells[2].ruleId, "ground-fallback");
});

test("resolves exact eight-neighbor masks with explicit diagonal ordering", () => {
  const fixture = loadFixtures().find(f => f.id === "eight-neighbor-patterns");
  const result = resolveFixture(fixture);
  assert.deepEqual(result.variantCells, fixture.expect.variantCells);
  assert.deepEqual(result.cells.map(c => c && c.mask), fixture.expect.masks);
  assert.equal(result.cells[0].ruleId, "stone-nw-corner");
  assert.equal(result.cells[1].ruleId, "stone-north-edge");
  assert.equal(result.cells[4].ruleId, "stone-inner");
  assert.deepEqual(result.directions, ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
});

test("treats out-of-bounds and different-group neighbors as zero on a non-square map", () => {
  const fixture = loadFixtures().find(f => f.id === "non-square-unresolved");
  const result = resolveFixture(fixture);
  assert.equal(result.width, 4);
  assert.equal(result.height, 2);
  assert.deepEqual(result.variantCells, fixture.expect.variantCells);
  assert.deepEqual(result.unresolved, fixture.expect.unresolved);
  assert.equal(result.cells[4].status, "unresolved");
  assert.equal(result.cells[6].status, "unresolved");
  assert.equal(result.cells[2], null, "empty source cells remain empty");
});

test("resolves an isolated cell using its exact all-zero neighbor mask", () => {
  const fixture = loadFixtures().find(f => f.id === "isolated-cell");
  const result = resolveFixture(fixture);
  assert.deepEqual(result.variantCells, fixture.expect.variantCells);
  assert.equal(result.cells[0].mask, "0000");
  assert.equal(result.cells[0].ruleId, "flora-isolated");
});

test("returns an explicit unresolved entry when no rule or fallback matches", () => {
  const input = basicInputs();
  input.ruleset.rules = [];
  const result = resolveAutotileMap(input.map, input.catalog, input.ruleset);
  assert.deepEqual(result.variantCells, [null]);
  assert.deepEqual(result.unresolved, [{
    x: 0, y: 0, index: 0, sourceTileId: "base", group: "g", mask: "0000", reason: "NO_RULE_MATCHED"
  }]);
  assert.equal(result.cells[0].status, "unresolved");
});

test("uses priority first, then specificity, then lexical rule ID", () => {
  const input = basicInputs();
  input.ruleset.rules = [
    { id: "z-broad", group: "g", mask: "????", variant: "v-b", priority: 5 },
    { id: "b-specific", group: "g", mask: "0???", variant: "v-a", priority: 5 },
    { id: "a-specific", group: "g", mask: "?0??", variant: "v-a", priority: 5 }
  ];
  const result = resolveAutotileMap(input.map, input.catalog, input.ruleset);
  assert.equal(result.cells[0].variantTileId, "v-a");
  assert.equal(result.cells[0].ruleId, "a-specific");
  input.ruleset.rules.push({ id: "priority-wins", group: "g", mask: "????", variant: "v-b", priority: 6 });
  const higher = resolveAutotileMap(input.map, input.catalog, input.ruleset);
  assert.equal(higher.cells[0].variantTileId, "v-b");
  assert.equal(higher.cells[0].ruleId, "priority-wins");
});

test("rejects overlapping equal-priority/equal-specificity rules with different variants", () => {
  const input = basicInputs();
  input.ruleset.rules = [
    { id: "north-open", group: "g", mask: "0???", variant: "v-a", priority: 10 },
    { id: "east-open", group: "g", mask: "?0??", variant: "v-b", priority: 10 }
  ];
  assert.throws(() => resolveAutotileMap(input.map, input.catalog, input.ruleset), /Conflicting equal-priority rules/);
});

test("allows equal-rank overlapping rules only when they yield the same variant", () => {
  const input = basicInputs();
  input.ruleset.rules = [
    { id: "z-rule", group: "g", mask: "0???", variant: "v-a", priority: 10 },
    { id: "a-rule", group: "g", mask: "?0??", variant: "v-a", priority: 10 }
  ];
  const result = resolveAutotileMap(input.map, input.catalog, input.ruleset);
  assert.equal(result.cells[0].ruleId, "a-rule");
});

test("rejects duplicate rule, group, variant and catalog IDs", () => {
  const input = basicInputs();
  input.ruleset.rules.push({ id: "fallback", group: "g", mask: "0000", variant: "v-a", priority: 5 });
  assert.throws(() => resolveAutotileMap(input.map, input.catalog, input.ruleset), /Duplicate rule ID/);
  const groupDup = basicInputs(); groupDup.ruleset.groups.push({ id: "g", variants: ["v-a"] });
  assert.throws(() => resolveAutotileMap(groupDup.map, groupDup.catalog, groupDup.ruleset), /Duplicate group ID/);
  const variantDup = basicInputs(); variantDup.ruleset.groups[0].variants.push("v-a");
  assert.throws(() => resolveAutotileMap(variantDup.map, variantDup.catalog, variantDup.ruleset), /Duplicate variant ID/);
  const catalogDup = basicInputs(); catalogDup.catalog.push({ id: "base", group: "g" });
  assert.throws(() => resolveAutotileMap(catalogDup.map, catalogDup.catalog, catalogDup.ruleset), /Duplicate catalog tile ID/);
  const fallbackDup = basicInputs();
  fallbackDup.ruleset.rules.push({ id: "fallback-2", group: "g", mask: "????", variant: "v-a", priority: 2, fallback: true });
  assert.throws(() => resolveAutotileMap(fallbackDup.map, fallbackDup.catalog, fallbackDup.ruleset), /more than one fallback/);
});

test("rejects missing source tiles, variants and groups before resolution", () => {
  const missingSource = basicInputs({ map: { width: 1, height: 1, cells: ["not-in-catalog"] } });
  assert.throws(() => resolveAutotileMap(missingSource.map, missingSource.catalog, missingSource.ruleset), /missing catalog tile/);
  const missingVariant = basicInputs(); missingVariant.ruleset.groups[0].variants = ["ghost"];
  assert.throws(() => resolveAutotileMap(missingVariant.map, missingVariant.catalog, missingVariant.ruleset), /Missing catalog variant/);
  const missingRuleVariant = basicInputs();
  missingRuleVariant.ruleset.rules = [{ id: "bad", group: "g", mask: "0000", variant: "ghost", priority: 1 }];
  assert.throws(() => resolveAutotileMap(missingRuleVariant.map, missingRuleVariant.catalog, missingRuleVariant.ruleset), /missing variant/);
  const unknownGroup = basicInputs(); unknownGroup.catalog.push({ id: "other", group: "not-declared" });
  assert.throws(() => resolveAutotileMap(unknownGroup.map, unknownGroup.catalog, unknownGroup.ruleset), /unknown group/);
});

test("rejects malformed masks, direction order, fallback and transform metadata", () => {
  const badMask = basicInputs();
  badMask.ruleset.rules = [{ id: "bad", group: "g", mask: "0x??", variant: "v-a", priority: 1 }];
  assert.throws(() => resolveAutotileMap(badMask.map, badMask.catalog, badMask.ruleset), /mask must contain/);
  const badDirections = basicInputs(); badDirections.ruleset.directions = ["E", "N", "S", "W"];
  assert.throws(() => resolveAutotileMap(badDirections.map, badDirections.catalog, badDirections.ruleset), /Directions must exactly/);
  const badFallback = basicInputs();
  badFallback.ruleset.rules = [{ id: "bad-fallback", group: "g", mask: "0000", variant: "v-a", priority: 1, fallback: true }];
  assert.throws(() => resolveAutotileMap(badFallback.map, badFallback.catalog, badFallback.ruleset), /all-wildcard mask/);
  const transform = basicInputs();
  transform.ruleset.rules = [{ id: "rotate", group: "g", mask: "0000", variant: "v-a", priority: 1, rotation: 90 }];
  assert.throws(() => resolveAutotileMap(transform.map, transform.catalog, transform.ruleset), /unsupported field 'rotation'/);
});

test("rejects malformed and oversized maps and unsupported schema versions", () => {
  const input = basicInputs({ map: { width: 2, height: 1, cells: ["base"] } });
  assert.throws(() => resolveAutotileMap(input.map, input.catalog, input.ruleset), /exactly width/);
  const malformed = basicInputs({ map: { width: 1, height: 1, cells: [undefined] } });
  assert.throws(() => resolveAutotileMap(malformed.map, malformed.catalog, malformed.ruleset), /Map tile ID/);
  const oversized = basicInputs({ map: { width: 4096, height: 4096, cells: [] } });
  assert.throws(() => resolveAutotileMap(oversized.map, oversized.catalog, oversized.ruleset), /cell limit/);
  const version = basicInputs(); version.ruleset.schema = "artclub.autotile-rules.v2";
  assert.throws(() => resolveAutotileMap(version.map, version.catalog, version.ruleset), /Unsupported autotile ruleset schema/);
});

test("returns detached frozen result data without changing caller inputs", () => {
  const input = basicInputs();
  const mapCopy = structuredClone(input.map), catalogCopy = structuredClone(input.catalog), rulesCopy = structuredClone(input.ruleset);
  const result = resolveAutotileMap(input.map, input.catalog, input.ruleset);
  assert.notEqual(result.cells, input.map.cells);
  assert.notEqual(result.variantCells, input.map.cells);
  assert.deepEqual(input.map, mapCopy); assert.deepEqual(input.catalog, catalogCopy); assert.deepEqual(input.ruleset, rulesCopy);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.cells), true);
  assert.equal(Object.isFrozen(result.cells[0]), true);
  assert.equal(Object.isFrozen(result.variantCells), true);
});

test("exposes explicit bounded-work limits", () => {
  assert.equal(LIMITS.maxMapCells, 262144);
  assert.equal(LIMITS.maxRules, 1024);
});
