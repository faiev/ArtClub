"use strict";
const fs = require("node:fs");
const path = require("node:path");
const DIR = path.join(__dirname, "fixtures", "tiles");
const LIMITS = Object.freeze({ maxDimension: 4096, maxPixels: 4194304 });
function whole(n, label, max) { if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new RangeError(label + " is outside its integer bounds."); }
function validateTile(tile) {
  if (!tile || typeof tile !== "object") throw new TypeError("Tile is required.");
  whole(tile.width, "Width", LIMITS.maxDimension); whole(tile.height, "Height", LIMITS.maxDimension);
  const count = tile.width * tile.height;
  if (!Number.isSafeInteger(count) || count > LIMITS.maxPixels || !Array.isArray(tile.pixels) || tile.pixels.length !== count) throw new RangeError("Tile pixel buffer must match its bounded dimensions.");
  for (const value of tile.pixels) if (value !== null && (typeof value !== "string" || !value.length)) throw new TypeError("Tile pixels must be exact tokens or null transparency.");
  return count;
}
function borderSummary(tile) {
  const {width:w,height:h,pixels:p}=tile; let lr=0,tb=0,corner=0,transparent=0;
  for(let y=0;y<h;y++){const a=p[y*w],b=p[y*w+w-1];if(!Object.is(a,b)){lr++;if((a===null)!==(b===null))transparent++;}}
  for(let x=0;x<w;x++){const a=p[x],b=p[(h-1)*w+x];if(!Object.is(a,b)){tb++;if((a===null)!==(b===null))transparent++;}}
  for(const [a,b] of [[p[0],p[h*w-1]],[p[w-1],p[(h-1)*w]]])if(!Object.is(a,b))corner++;
  return {leftRightMismatchCount:lr,topBottomMismatchCount:tb,cornerMismatchCount:corner,transparentOpposingEdgeMismatchCount:transparent,seamless:lr===0&&tb===0&&corner===0};
}
function mod(n,m){return ((n%m)+m)%m;}
function wrap(tile,dx,dy){
  if(!Number.isSafeInteger(dx)||!Number.isSafeInteger(dy))throw new TypeError("Offsets must be safe integers.");
  const out=new Array(tile.pixels.length);
  for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++)out[y*tile.width+x]=tile.pixels[mod(y-dy,tile.height)*tile.width+mod(x-dx,tile.width)];
  return out;
}
function stamp(map,s){
  whole(map.width,"Map width",LIMITS.maxDimension);whole(map.height,"Map height",LIMITS.maxDimension);whole(s.width,"Stamp width",LIMITS.maxDimension);whole(s.height,"Stamp height",LIMITS.maxDimension);
  const n=map.width*map.height,m=s.width*s.height;
  if(!Number.isSafeInteger(n)||n>LIMITS.maxPixels||!Number.isSafeInteger(m)||m>LIMITS.maxPixels||!Array.isArray(map.cells)||map.cells.length!==n||!Array.isArray(s.cells)||s.cells.length!==m)throw new RangeError("Map or stamp buffer is invalid or oversized.");
  if(!Number.isSafeInteger(s.x)||!Number.isSafeInteger(s.y)||s.x<0||s.y<0||s.x+s.width>map.width||s.y+s.height>map.height)throw new RangeError("Stamp is outside map bounds.");
  const out=map.cells.slice();for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)out[(s.y+y)*map.width+s.x+x]=s.cells[y*s.width+x];return out;
}
function allocate(a){
  whole(a.width,"Allocation width",LIMITS.maxDimension);whole(a.height,"Allocation height",LIMITS.maxDimension);const n=a.width*a.height;
  if(!Number.isSafeInteger(n)||n>LIMITS.maxPixels||n!==a.maxPixels||!Array.isArray(a.pattern)||!a.pattern.length||a.pattern.some(v=>!Number.isInteger(v)||v<0||v>255))throw new RangeError("Maximum allocation descriptor is invalid or oversized.");
  const out=new Uint8Array(n);for(let i=0;i<n;i++)out[i]=a.pattern[i%a.pattern.length];return out;
}
function loadFixtures(directory){
  const root=directory||DIR;return fs.readdirSync(root).filter(n=>n.endsWith(".json")).sort().map(name=>{
    const f=JSON.parse(fs.readFileSync(path.join(root,name),"utf8"));if(f.schema!=="artclub.tile-fixture.v1"||f.id!==path.basename(name,".json"))throw new Error("Invalid fixture identity/schema: "+name);return f;
  });
}
function runFixture(f){
  const result={id:f.id,kind:f.kind};
  if(f.kind==="tile"){
    const count=validateTile(f.tile),b=borderSummary(f.tile);if(f.expect.pixelCount!==undefined&&f.expect.pixelCount!==count)throw new Error(f.id+" pixel count mismatch");
    for(const k of ["leftRightMismatchCount","topBottomMismatchCount","cornerMismatchCount","transparentOpposingEdgeMismatchCount","seamless"])if(f.expect[k]!==undefined&&f.expect[k]!==b[k])throw new Error(f.id+" expected "+k+" mismatch");
    return Object.assign(result,{width:f.tile.width,height:f.tile.height,pixelCount:count},b);
  }
  if(f.kind==="edge-wrap"){
    validateTile(f.tile);const operations=f.operations.map(o=>{const pixels=wrap(f.tile,o.offsetX,o.offsetY);if(JSON.stringify(pixels)!==JSON.stringify(o.expected))throw new Error(f.id+" wrap output mismatch");return {offsetX:o.offsetX,offsetY:o.offsetY,pixels};});return Object.assign(result,{operationCount:operations.length,operations});
  }
  if(f.kind==="map-stamping"){
    const source=f.map.cells.slice(),cells=stamp(f.map,f.stamp);if(JSON.stringify(cells)!==JSON.stringify(f.expect.cells)||JSON.stringify(source)!==JSON.stringify(f.map.cells))throw new Error(f.id+" map stamping mismatch or source mutation");return Object.assign(result,{width:f.map.width,height:f.map.height,stampedCells:cells,sourceMapUnchanged:true});
  }
  if(f.kind==="maximum-allocation"){
    const bytes=allocate(f.allocation),first=Array.from(bytes.slice(0,f.expect.firstValues.length)),last=Array.from(bytes.slice(-f.expect.lastValues.length));
    if(bytes.length!==f.expect.pixelCount||JSON.stringify(first)!==JSON.stringify(f.expect.firstValues)||JSON.stringify(last)!==JSON.stringify(f.expect.lastValues))throw new Error(f.id+" boundary mismatch");return Object.assign(result,{pixelCount:bytes.length,allocatedBytes:bytes.byteLength,firstValues:first,lastValues:last});
  }
  throw new Error("Unsupported fixture kind: "+f.kind);
}
function runTileExamples(directory){const examples=loadFixtures(directory).map(runFixture);return {schema:"artclub.tile-examples.v1",fixtureCount:examples.length,examples};}
if(require.main===module)process.stdout.write(JSON.stringify(runTileExamples(),null,2)+"\n");
module.exports={LIMITS,loadFixtures,runFixture,runTileExamples,validateTile,borderSummary,wrap,stamp,allocate};
