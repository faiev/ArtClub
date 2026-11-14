/* eslint-env node */
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const D=require("../js/tile-seam-diagnostics.js");
const R="#ff0000",G="#00ff00",B="#0000ff",Y="#ffff00";

test("reports exact opposing-edge mismatches and coordinates",()=>{
 const r=D.analyzeTileSeams([R,G,B,Y,R,G],3,2,{repeatColumns:1,repeatRows:1});
 assert.equal(r.edges.leftRight.mismatchCount,2); assert.equal(r.edges.topBottom.mismatchCount,3);
 assert.deepEqual(r.edges.leftRight.mismatches[0],{row:0,left:{x:0,y:0,value:R},right:{x:2,y:0,value:B},transparentMismatch:false});
 assert.equal(r.seamless,false);
});
test("classifies null versus opaque border mismatches",()=>{
 const r=D.analyzeTileSeams([null,R,G,null],2,2,{repeatColumns:1,repeatRows:1});
 assert.equal(r.transparentMismatchCount,4);
 assert.ok(r.transparentMismatches.some(x=>x.axis==="left-right"));
 assert.ok(r.transparentMismatches.some(x=>x.axis==="top-bottom"));
});
test("compares both diagonal corner pairs",()=>{
 const r=D.analyzeTileSeams([R,G,B,Y],2,2,{repeatColumns:1,repeatRows:1});
 assert.equal(r.corners.comparisons,2); assert.equal(r.corners.mismatchCount,2);
 assert.deepEqual(r.corners.mismatches.map(x=>[x.first,x.second]),[["topLeft","bottomRight"],["topRight","bottomLeft"]]);
});
test("detects a one-pixel vertical shift candidate without mutating pixels",()=>{
 const p=[R,G,R,G,G,B,G,B,B,Y,B,Y,Y,R,Y,R],before=p.slice();
 const r=D.analyzeTileSeams(p,4,4,{repeatColumns:1,repeatRows:1});
 assert.ok(r.onePixelShiftCandidates.some(x=>x.axis==="left-right"&&x.shift===-1)); assert.deepEqual(p,before);
});
test("detects a one-pixel horizontal shift candidate",()=>{
 const p=[R,G,B,Y,R,R,R,R,G,G,G,G,G,B,Y,R];
 const r=D.analyzeTileSeams(p,4,4,{repeatColumns:1,repeatRows:1});
 assert.ok(r.onePixelShiftCandidates.some(x=>x.axis==="top-bottom"&&x.shift===-1));
});
test("reports repeated-block joins in preview coordinates",()=>{
 const r=D.analyzeTileSeams([R,G,B,Y],2,2,{repeatColumns:3,repeatRows:2});
 assert.equal(r.repeatedBlocks.horizontalJoinComparisons,8); assert.equal(r.repeatedBlocks.verticalJoinComparisons,6);
 assert.equal(r.repeatedBlocks.mismatchCount,14); assert.equal(r.repeatedBlocks.aligned,false);
 assert.equal(r.repeatedBlocks.horizontalMismatches[0].left.x,1); assert.equal(r.repeatedBlocks.horizontalMismatches[0].right.x,2);
});
test("normalizes positive and negative toroidal offsets",()=>{
 const r=D.analyzeTileSeams([R,G,B,Y],2,2,{repeatColumns:2,repeatRows:2,offsetX:-1,offsetY:3});
 assert.equal(r.repeatedBlocks.offsetX,1); assert.equal(r.repeatedBlocks.offsetY,1);
 assert.equal(r.repeatedBlocks.previewWidth,4); assert.equal(r.repeatedBlocks.previewHeight,4);
});
test("serializes JSON and formats a human-readable report",()=>{
 const r=D.analyzeTileSeams([null,R,G,Y],2,2);
 assert.deepEqual(JSON.parse(D.serializeTileSeamReport(r,2)),r);
 const s=D.formatTileSeamReport(r);
 assert.match(s,/Tile seam diagnostics/); assert.match(s,/Transparent border mismatches/); assert.match(s,/No source pixels were modified/);
});
test("suggestions are advisory and no repaired buffer is returned",()=>{
 const r=D.analyzeTileSeams([R,G,B,Y],2,2);
 assert.ok(r.suggestions.length>0); assert.equal(Object.hasOwn(r,"repairedPixels"),false); assert.equal(Object.hasOwn(r,"pixels"),false);
});
test("accepts typed arrays and preserves exact values",()=>{
 const r=D.analyzeTileSeams(new Uint8Array([1,2,3,4]),2,2,{repeatColumns:1,repeatRows:1});
 assert.equal(r.width,2); assert.equal(r.height,2); assert.equal(r.edges.leftRight.comparisons,2);
});
test("rejects malformed buffers, dimensions, options and repeats",()=>{
 assert.throws(()=>D.analyzeTileSeams([],0,1),/Width/); assert.throws(()=>D.analyzeTileSeams([R],1,1.5),/Height/);
 assert.throws(()=>D.analyzeTileSeams([R],1,1,{repeatColumns:0}),/Repeat columns/);
 assert.throws(()=>D.analyzeTileSeams([R],1,1,{repeatRows:257}),/Repeat rows/);
 assert.throws(()=>D.analyzeTileSeams([R],1,1,{offsetX:0.5}),/safe integers/);
 assert.throws(()=>D.analyzeTileSeams([undefined],1,1),/undefined/);
 assert.throws(()=>D.analyzeTileSeams(new DataView(new ArrayBuffer(1)),1,1),/Array or typed array/);
 assert.throws(()=>D.analyzeTileSeams([R],1,1,{detectOnePixelShift:1}),/boolean/);
});
test("rejects repeated layouts above the report-size cap",()=>{
 const tile=new Array(16*16).fill(null);
 assert.throws(()=>D.analyzeTileSeams(tile,16,16,{repeatColumns:256,repeatRows:256}),/report item limit/);
});
