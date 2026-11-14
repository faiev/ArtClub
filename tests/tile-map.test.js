/* eslint-env node */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../js/tile-map.js");
const T = [
  { id: "grass", width: 16, height: 16, name: "Grass" },
  { id: "stone", width: 16, height: 16 },
  { id: "water", width: 16, height: 16 }
];
const map = (w=2,h=2) => M.createTileMap({width:w,height:h,tiles:T});
test("creates a bounded empty row-major map", () => {
  const m=map(3,2); assert.deepEqual(m.cells,Array(6).fill(null)); assert.equal(M.validateTileMap(m).valid,true);
});
test("places and erases without mutating source", () => {
  const m=map(2,1), p=M.placeTile(m,1,0,"grass");
  assert.deepEqual(p.cells,[null,"grass"]); assert.deepEqual(M.eraseTile(p,1,0).cells,[null,null]); assert.deepEqual(m.cells,[null,null]);
});
test("resizes preserving the top-left overlap and null-filling added cells", () => {
  const m=M.placeTile(map(2,2),0,0,"grass");
  assert.deepEqual(M.resizeTileMap(m,3,2).cells,["grass",null,null,null,null,null]);
  assert.deepEqual(M.resizeTileMap(M.resizeTileMap(m,3,2),1,2).cells,["grass",null]);
});
test("move rejects occupied destinations unless swap or replace is explicit", () => {
  const m=M.placeTile(M.placeTile(map(2,1),0,0,"grass"),1,0,"water");
  assert.throws(()=>M.moveTile(m,0,0,1,0),/occupied/);
  assert.deepEqual(M.moveTile(m,0,0,1,0,{mode:"swap"}).cells,["water","grass"]);
  assert.deepEqual(M.moveTile(m,0,0,1,0,{mode:"replace"}).cells,[null,"grass"]);
});
test("move rejects empty sources and validates mode", () => {
  const m=map(2,1); assert.throws(()=>M.moveTile(m,0,0,1,0),/empty/);
  assert.throws(()=>M.moveTile(m,0,0,1,0,{mode:"warp"}),/mode/);
});
test("duplicates only into empty cells unless overwrite true", () => {
  const m=M.placeTile(M.placeTile(map(2,1),0,0,"stone"),1,0,"grass");
  assert.throws(()=>M.duplicateTile(m,0,0,1,0),/occupied/);
  assert.deepEqual(M.duplicateTile(m,0,0,1,0,{overwrite:true}).cells,["stone","stone"]);
});
test("copies rectangular selections row-major including null cells", () => {
  const m=M.placeTile(M.placeTile(M.placeTile(map(3,2),0,0,"grass"),1,0,"water"),0,1,"stone");
  assert.deepEqual(M.copySelection(m,{x:0,y:0,width:2,height:2}),{width:2,height:2,cells:["grass","water","stone",null]});
});
test("pastes selections and preserves empty slots", () => {
  const m=M.placeTile(M.placeTile(M.placeTile(map(4,2),0,0,"grass"),1,0,"water"),0,1,"stone");
  const clip=M.copySelection(m,{x:0,y:0,width:2,height:2});
  assert.deepEqual(M.pasteSelection(m,clip,2,0).cells,["grass","water","grass","water","stone",null,"stone",null]);
});
test("paste overwrite is explicit and clip references are validated", () => {
  const m=M.placeTile(map(2,1),0,0,"grass"), clip={width:1,height:1,cells:["water"]};
  assert.throws(()=>M.pasteSelection(m,clip,0,0),/occupied/);
  assert.equal(M.pasteSelection(m,clip,0,0,{overwrite:true}).cells[0],"water");
  assert.throws(()=>M.pasteSelection(m,{width:1,height:1,cells:["missing"]},1,0),/unknown/);
});
test("serializes canonical tile-definition order and round-trips", () => {
  const m=M.createTileMap({width:2,height:1,tiles:[T[2],T[0],T[1]],cells:["stone","grass"]});
  const json=M.serializeTileMap(m); assert.equal(json,M.serializeTileMap(m));
  assert.deepEqual(JSON.parse(json).tiles.map(t=>t.id),["grass","stone","water"]);
  assert.deepEqual(M.deserializeTileMap(json).cells,m.cells);
});
test("validator rejects format/version, unknown IDs and duplicate definitions", () => {
  const m=map(1,1);
  assert.equal(M.validateTileMap({...m,version:9}).valid,false);
  assert.equal(M.validateTileMap({...m,cells:["missing"]}).valid,false);
  assert.throws(()=>M.createTileMap({width:1,height:1,tiles:[T[0],T[0]]}),/Duplicate/);
  assert.throws(()=>M.deserializeTileMap("bad json"),/valid JSON/);
});
test("validator rejects sparse and undefined cells", () => {
  const m=map(2,2), sparse=[null,null,null,null]; delete sparse[2];
  assert.equal(M.validateTileMap({...m,cells:sparse}).valid,false);
  assert.equal(M.validateTileMap({...m,cells:[null,null,undefined,null]}).valid,false);
});
test("coordinates and selection rectangles are checked", () => {
  const m=map(2,2);
  assert.throws(()=>M.placeTile(m,-1,0,"grass"),/inside/);
  assert.throws(()=>M.copySelection(m,{x:1,y:1,width:2,height:2}),/inside/);
  assert.throws(()=>M.pasteSelection(m,{width:1,height:1,cells:[null]},2,0),/fit/);
});
test("all editing operations preserve source map and clipboard data", () => {
  const m=M.placeTile(map(3,2),0,0,"grass"), before=m.cells.slice(), clip=M.copySelection(m,{x:0,y:0,width:1,height:1});
  const clipBefore=clip.cells.slice();
  const outputs=[M.resizeTileMap(m,4,2),M.placeTile(m,1,0,"water"),M.eraseTile(m,0,0),
    M.moveTile(m,0,0,2,0),M.duplicateTile(m,0,0,2,0),M.pasteSelection(map(3,2),clip,1,1)];
  for(const out of outputs){assert.notEqual(out,m);assert.notEqual(out.cells,m.cells);assert.notEqual(out.tiles,m.tiles);}
  assert.deepEqual(m.cells,before); assert.deepEqual(clip.cells,clipBefore);
});
test("allocation limits reject oversized maps, tiles and resizes", () => {
  assert.throws(()=>map(2049,1),/Map width/);
  assert.throws(()=>map(1025,1025),/cell limit/);
  assert.throws(()=>M.createTileMap({width:1,height:1,tileWidth:4097}),/Tile width/);
  assert.throws(()=>M.resizeTileMap(map(1,1),1025,1025),/cell limit/);
});
