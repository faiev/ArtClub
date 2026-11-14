/* eslint-env node */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const P=require("../js/tile-atlas-planner.js");

test("sorts tile IDs deterministically and places them row-major",()=>{
 const input=["tile-c","tile-a","tile-b"],plan=P.planTileAtlas(input,16,12,{columns:2});
 assert.deepEqual(plan.tiles.map(x=>x.id),["tile-a","tile-b","tile-c"]);
 assert.deepEqual(plan.tiles.map(x=>[x.row,x.column]),[[0,0],[0,1],[1,0]]);
 assert.deepEqual(input,["tile-c","tile-a","tile-b"]);
});
test("chooses a deterministic near-square default grid",()=>{
 const plan=P.planTileAtlas(["e","d","c","b","a"],8,8);
 assert.equal(plan.columns,3); assert.equal(plan.rows,2);
});
test("accounts for outer margins, spacing and per-cell padding",()=>{
 const plan=P.planTileAtlas(["a","b","c"],10,6,{columns:2,marginX:3,marginY:4,spacingX:5,spacingY:7,padding:2});
 assert.deepEqual(plan.bounds,{width:39,height:35,pixels:1365});
 assert.deepEqual(plan.tiles[0].cellRect,{x:3,y:4,width:14,height:10});
 assert.deepEqual(plan.tiles[0].tileRect,{x:5,y:6,width:10,height:6});
 assert.deepEqual(plan.tiles[1].tileRect,{x:24,y:6,width:10,height:6});
 assert.deepEqual(plan.tiles[2].tileRect,{x:5,y:23,width:10,height:6});
});
test("supports rectangular tiles and a partial final row",()=>{
 const plan=P.planTileAtlas(["a","b","c","d","e"],12,7,{columns:2});
 assert.equal(plan.bounds.width,24); assert.equal(plan.bounds.height,21);
 assert.deepEqual(plan.tiles[4].tileRect,{x:0,y:14,width:12,height:7});
});
test("distinguishes artwork metadata rectangles from padded cells",()=>{
 const plan=P.planTileAtlas(["only"],5,4,{padding:3});
 assert.deepEqual(plan.tiles[0].cellRect,{x:0,y:0,width:11,height:10});
 assert.deepEqual(plan.tiles[0].tileRect,{x:3,y:3,width:5,height:4});
});
test("is deterministic across calls and input ordering",()=>{
 const a=P.planTileAtlas(["gamma","alpha","beta"],9,5,{columns:2,padding:1});
 const b=P.planTileAtlas(["beta","gamma","alpha"],9,5,{columns:2,padding:1});
 assert.deepEqual(a,b); assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test("rejects empty, duplicate, blank and non-string IDs",()=>{
 assert.throws(()=>P.planTileAtlas([],8,8),/At least one/);
 assert.throws(()=>P.planTileAtlas(["a","a"],8,8),/Duplicate/);
 assert.throws(()=>P.planTileAtlas(["  "],8,8),/non-empty string/);
 assert.throws(()=>P.planTileAtlas(["a",null],8,8),/non-empty string/);
});
test("validates dimensions, columns and inset values",()=>{
 assert.throws(()=>P.planTileAtlas(["a"],0,8),/Tile width/);
 assert.throws(()=>P.planTileAtlas(["a"],8,4097),/Tile height/);
 assert.throws(()=>P.planTileAtlas(["a","b"],8,8,{columns:3}),/Columns/);
 assert.throws(()=>P.planTileAtlas(["a"],8,8,{spacingX:-1}),/spacingX/);
 assert.throws(()=>P.planTileAtlas(["a"],8,8,{padding:1.5}),/padding/);
 assert.throws(()=>P.planTileAtlas(["a"],8,8,null),/options/);
});
test("rejects atlas dimensions and total pixels above configured limits",()=>{
 assert.throws(()=>P.planTileAtlas(["a"],4096,4096,{marginX:20000}),/dimensions/);
 assert.throws(()=>P.planTileAtlas(["a","b"],4096,4096,{columns:2,spacingX:32768}),/dimensions/);
 assert.throws(()=>P.planTileAtlas(["a","b","c","d","e","f"],4096,4096,{columns:2}),/pixel budget/);
});
test("returns a detached immutable metadata plan, not artwork pixels",()=>{
 const ids=["z","a"],plan=P.planTileAtlas(ids,4,4);
 assert.equal(Object.isFrozen(plan),true); assert.equal(Object.isFrozen(plan.tiles),true);
 assert.equal(Object.isFrozen(plan.tiles[0].tileRect),true);
 assert.equal(Object.hasOwn(plan,"pixels"),false); assert.deepEqual(ids,["z","a"]);
});
