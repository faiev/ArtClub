/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Distance = require("../js/palette-distance.js");

function closeTo(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= (tolerance || 0.0001), actual + " differs from " + expected);
}

test("CIEDE2000 matches all 34 published Sharma-Wu-Dalal reference pairs", () => {
  const file = path.join(__dirname, "fixtures", "ciede2000-reference-pairs.tsv");
  const rows = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  assert.equal(rows.length, 34);
  rows.forEach((row, index) => {
    const [l1,a1,b1,l2,a2,b2,expected] = row.trim().split(/\s+/).map(Number);
    const actual = Distance.ciede2000([l1,a1,b1],[l2,a2,b2]);
    closeTo(actual,expected,0.0001);
    assert.ok(actual >= 0, "pair " + (index+1) + " must not produce negative distance");
  });
});

test("CIEDE2000 is symmetric and identical Lab values have zero distance", () => {
  const first=[50,2.6772,-79.7751];
  const second=[50,0,-82.7485];
  closeTo(Distance.ciede2000(first,second),Distance.ciede2000(second,first),1e-12);
  assert.equal(Distance.ciede2000(first,first),0);
});

test("neutral and near-neutral colors remain finite at hue wrap boundaries", () => {
  assert.equal(Distance.ciede2000([50,0,0],[50,0,0]),0);
  const nearNeutral=Distance.ciede2000([50,0.0001,-0.0001],[50,-0.0001,0.0001]);
  assert.ok(Number.isFinite(nearNeutral));
  assert.ok(nearNeutral >= 0);
});

test("HEX to Lab uses D65 sRGB conversion and returns known red coordinates", () => {
  const lab=Distance.hexToLab("#FF0000");
  closeTo(lab.l,53.24079414130722,1e-8);
  closeTo(lab.a,80.09245959641109,1e-8);
  closeTo(lab.b,67.20319651585301,1e-8);
});

test("HEX CIEDE2000 convenience distance compares identical colors as zero", () => {
  assert.equal(Distance.deltaE00Hex("#123456","#123456"),0);
  assert.ok(Distance.deltaE00Hex("#FF0000","#00FF00") > 0);
});

test("CIEDE2000 parametric weighting factors are opt-in and bounded", () => {
  const first=[50,2.6772,-79.7751], second=[50,0,-82.7485];
  const weighted=Distance.ciede2000(first,second,{kL:2,kC:1,kH:1});
  assert.notEqual(weighted,Distance.ciede2000(first,second));
  assert.throws(()=>Distance.ciede2000(first,second,{kL:0}),/greater than 0/);
  assert.throws(()=>Distance.ciede2000(first,second,{kH:11}),/at most 10/);
});

test("RGB Euclidean remains the default nearest-color metric", () => {
  const result=Distance.findNearestColor("#010000",["#000000","#FFFFFF"]);
  assert.equal(result.metric,"rgb-euclidean");
  assert.equal(result.index,0);
  closeTo(result.distance,1);
});

test("CIEDE2000 nearest-color matching is explicit opt-in", () => {
  const result=Distance.findNearestColor("#FF0000",["#EF0000","#00FF00"],{metric:"ciede2000"});
  assert.equal(result.metric,"ciede2000");
  assert.equal(result.index,0);
  assert.ok(result.distance>0);
});

test("nearest-color matching uses first palette index for equal-distance ties", () => {
  const result=Distance.findNearestColor("#010000",["#000000","#020000"]);
  assert.equal(result.index,0);
  assert.equal(result.tieCount,1);
  const perceptual=Distance.findNearestColor("#000000",["#FFFFFF","#FFFFFF"],{metric:"ciede2000"});
  assert.equal(perceptual.index,0);
  assert.equal(perceptual.tieCount,1);
});

test("transparent target returns null instead of matching black or another palette color", () => {
  assert.equal(Distance.findNearestColor(null,["#000000","#FFFFFF"]),null);
});

test("mapToPalette preserves null transparency and returns a deterministic map report", () => {
  const result=Distance.mapToPalette(["#000000",null,"#EEEEEE"],["#000000","#FFFFFF"],{metric:"ciede2000"});
  assert.deepEqual(result.pixels,["#000000",null,"#FFFFFF"]);
  assert.equal(result.report.metric,"ciede2000");
  assert.equal(result.report.totalPixelCount,3);
  assert.equal(result.report.transparentPixelCount,1);
  assert.equal(result.report.mappedPixelCount,2);
  assert.equal(result.report.exactMatchCount,1);
  assert.equal(result.report.changedPixelCount,1);
});

test("mapToPalette defaults to RGB and preserves input array unchanged", () => {
  const pixels=["#000000",null,"#010000"];
  const before=JSON.stringify(pixels);
  const result=Distance.mapToPalette(pixels,["#000000","#FFFFFF"]);
  assert.equal(result.report.metric,"rgb-euclidean");
  assert.equal(JSON.stringify(pixels),before);
});

test("invalid metrics, Lab values, palette sizes and sparse pixel arrays are rejected", () => {
  assert.throws(()=>Distance.ciede2000([101,0,0],[50,0,0]),/L\* must be between 0 and 100/);
  assert.throws(()=>Distance.ciede2000([50,0],[50,0,0]),/must be \[L\*, a\*, b\*\]/);
  assert.throws(()=>Distance.ciede2000([50,0,0],[50,0,0],{kC:NaN}),/finite number/);
  assert.throws(()=>Distance.findNearestColor("#000000",["#FFFFFF"],{metric:"cie76"}),/Metric must be/);
  assert.throws(()=>Distance.findNearestColor("#000000",[]),/Palette must contain/);
  const sparse=["#000000",null]; delete sparse[1];
  assert.throws(()=>Distance.mapToPalette(sparse,["#000000"]),/sparse or missing/);
});

test("mapToPalette supports an empty pixel array without division by zero", () => {
  const result=Distance.mapToPalette([],["#000000"]);
  assert.deepEqual(result.pixels,[]);
  assert.equal(result.report.meanDistance,null);
  assert.equal(result.report.maxDistance,null);
});

test("browser global exposes CIEDE2000 and opt-in nearest-color APIs", () => {
  const source=fs.readFileSync(path.join(__dirname,"..","js","palette-distance.js"),"utf8");
  const vm=require("node:vm");
  const context={globalThis:{}};
  vm.runInNewContext(source,context);
  assert.equal(typeof context.globalThis.ArtClubPaletteDistance.ciede2000,"function");
  assert.equal(typeof context.globalThis.ArtClubPaletteDistance.findNearestColor,"function");
});

test("seeded Lab pairs remain deterministic and non-negative", () => {
  let state=0xC1E2000;
  function random(){ state=(Math.imul(state,1664525)+1013904223)>>>0; return state/0x100000000; }
  for(let index=0;index<100;index++){
    const a=[random()*100,random()*256-128,random()*256-128];
    const b=[random()*100,random()*256-128,random()*256-128];
    const first=Distance.ciede2000(a,b);
    const second=Distance.ciede2000(a,b);
    assert.equal(first,second);
    assert.ok(first>=0);
  }
});
