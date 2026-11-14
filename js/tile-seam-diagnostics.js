/*!
 * Bounded renderer-independent tile seam diagnostics. Input pixels are never mutated.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubTileSeamDiagnostics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LIMITS = Object.freeze({maxDimension:4096,maxSourcePixels:4194304,maxRepeatCount:256,maxReportItems:1000000});
  function dimension(value,label) {
    if(!Number.isSafeInteger(value)||value<1||value>LIMITS.maxDimension) throw new RangeError(label+" must be a whole number from 1 to "+LIMITS.maxDimension+".");
  }
  function repeat(value,label) {
    if(!Number.isSafeInteger(value)||value<1||value>LIMITS.maxRepeatCount) throw new RangeError(label+" must be a whole number from 1 to "+LIMITS.maxRepeatCount+".");
  }
  function validate(pixels,width,height) {
    dimension(width,"Width"); dimension(height,"Height");
    const length=width*height;
    if(!Number.isSafeInteger(length)||length>LIMITS.maxSourcePixels) throw new RangeError("Source tile exceeds the safe pixel limit of "+LIMITS.maxSourcePixels+".");
    const typed=typeof ArrayBuffer!=="undefined"&&ArrayBuffer.isView(pixels)&&Object.prototype.toString.call(pixels)!=="[object DataView]";
    if(!Array.isArray(pixels)&&!typed) throw new TypeError("Pixel buffer must be an Array or typed array.");
    if(pixels.length!==length) throw new RangeError("Pixel buffer length must equal width × height ("+length+").");
    for(let i=0;i<length;i+=1) if(pixels[i]===undefined) throw new TypeError("Pixel buffer cannot contain sparse or undefined entries; use null for transparency (index "+i+").");
  }
  const same=(a,b)=>Object.is(a,b);
  const transparent=(a,b)=>(a===null)!==(b===null);
  const point=(x,y,value)=>({x:x,y:y,value:value});
  const mod=(v,n)=>((v%n)+n)%n;

  function edges(pixels,width,height) {
    const lr=[],tb=[],trans=[];
    for(let y=0;y<height;y+=1) {
      const a=pixels[y*width],b=pixels[y*width+width-1];
      if(!same(a,b)) {
        const item={row:y,left:point(0,y,a),right:point(width-1,y,b),transparentMismatch:transparent(a,b)};
        lr.push(item); if(item.transparentMismatch) trans.push({axis:"left-right",...item});
      }
    }
    for(let x=0;x<width;x+=1) {
      const a=pixels[x],b=pixels[(height-1)*width+x];
      if(!same(a,b)) {
        const item={column:x,top:point(x,0,a),bottom:point(x,height-1,b),transparentMismatch:transparent(a,b)};
        tb.push(item); if(item.transparentMismatch) trans.push({axis:"top-bottom",...item});
      }
    }
    return {leftRight:{comparisons:height,mismatchCount:lr.length,mismatches:lr},
      topBottom:{comparisons:width,mismatchCount:tb.length,mismatches:tb},transparentMismatches:trans};
  }
  function corners(pixels,width,height) {
    const values={topLeft:point(0,0,pixels[0]),topRight:point(width-1,0,pixels[width-1]),
      bottomRight:point(width-1,height-1,pixels[(height-1)*width+width-1]),bottomLeft:point(0,height-1,pixels[(height-1)*width])};
    const pairs=[["topLeft","bottomRight"],["topRight","bottomLeft"]],mismatches=[];
    for(const pair of pairs) {
      const a=values[pair[0]],b=values[pair[1]];
      if(!same(a.value,b.value)) mismatches.push({first:pair[0],second:pair[1],a:a,b:b,transparentMismatch:transparent(a.value,b.value)});
    }
    return {comparisons:2,mismatchCount:mismatches.length,mismatches:mismatches,corners:values};
  }
  function shiftCompare(pixels,width,height,axis,shift) {
    const length=axis==="left-right"?height:width;
    if(length<3) return null;
    const mismatches=[];
    for(let i=1;i<length-1;i+=1) {
      const j=i+shift,a=axis==="left-right"?pixels[i*width]:pixels[i];
      const b=axis==="left-right"?pixels[j*width+width-1]:pixels[(height-1)*width+j];
      if(!same(a,b)) mismatches.push({
        first:axis==="left-right"?point(0,i,a):point(i,0,a),
        second:axis==="left-right"?point(width-1,j,b):point(j,height-1,b),transparentMismatch:transparent(a,b)
      });
    }
    return {axis:axis,shift:shift,compared:length-2,mismatchCount:mismatches.length,mismatches:mismatches};
  }
  function shifts(pixels,width,height) {
    const out=[];
    for(const axis of ["left-right","top-bottom"]) {
      const base=shiftCompare(pixels,width,height,axis,0);
      if(!base) continue;
      for(const shift of [-1,1]) {
        const candidate=shiftCompare(pixels,width,height,axis,shift);
        if(candidate.mismatchCount<base.mismatchCount) out.push({
          axis:axis,shift:shift,baselineMismatchCount:base.mismatchCount,candidateMismatchCount:candidate.mismatchCount,
          compared:candidate.compared,mismatches:candidate.mismatches
        });
      }
    }
    return out;
  }
  function sample(pixels,width,height,x,y,ox,oy) {
    return pixels[mod(y-oy,height)*width+mod(x-ox,width)];
  }
  function repeated(pixels,width,height,options) {
    const columns=options.repeatColumns,rows=options.repeatRows,ox=mod(options.offsetX,width),oy=mod(options.offsetY,height);
    const previewWidth=width*columns,previewHeight=height*rows;
    const count=(columns-1)*previewHeight+(rows-1)*previewWidth,fixed=4*(width+height)+2;
    if(!Number.isSafeInteger(count)||count+fixed>LIMITS.maxReportItems) throw new RangeError("Repeated-block diagnostics exceed the report item limit.");
    const horizontal=[],vertical=[],trans=[];
    for(let block=1;block<columns;block+=1) {
      const seamX=block*width;
      for(let y=0;y<previewHeight;y+=1) {
        const a=sample(pixels,width,height,seamX-1,y,ox,oy),b=sample(pixels,width,height,seamX,y,ox,oy);
        if(!same(a,b)) {
          const item={blockBoundary:block,row:y,left:point(seamX-1,y,a),right:point(seamX,y,b),transparentMismatch:transparent(a,b)};
          horizontal.push(item); if(item.transparentMismatch) trans.push({axis:"horizontal-block-join",...item});
        }
      }
    }
    for(let block=1;block<rows;block+=1) {
      const seamY=block*height;
      for(let x=0;x<previewWidth;x+=1) {
        const a=sample(pixels,width,height,x,seamY-1,ox,oy),b=sample(pixels,width,height,x,seamY,ox,oy);
        if(!same(a,b)) {
          const item={blockBoundary:block,column:x,top:point(x,seamY-1,a),bottom:point(x,seamY,b),transparentMismatch:transparent(a,b)};
          vertical.push(item); if(item.transparentMismatch) trans.push({axis:"vertical-block-join",...item});
        }
      }
    }
    return {columns:columns,rows:rows,previewWidth:previewWidth,previewHeight:previewHeight,offsetX:ox,offsetY:oy,
      horizontalJoinComparisons:(columns-1)*previewHeight,verticalJoinComparisons:(rows-1)*previewWidth,
      horizontalMismatchCount:horizontal.length,verticalMismatchCount:vertical.length,mismatchCount:horizontal.length+vertical.length,
      aligned:horizontal.length===0&&vertical.length===0,horizontalMismatches:horizontal,verticalMismatches:vertical,transparentMismatches:trans};
  }
  function suggestions(edge,corner,shift,blocks) {
    const out=[];
    if(edge.leftRight.mismatchCount) out.push({code:"OPPOSING_LEFT_RIGHT_EDGES",message:"Inspect left/right border pixels at the reported rows."});
    if(edge.topBottom.mismatchCount) out.push({code:"OPPOSING_TOP_BOTTOM_EDGES",message:"Inspect top/bottom border pixels at the reported columns."});
    if(edge.transparentMismatches.length||blocks.transparentMismatches.length) out.push({
      code:"TRANSPARENT_BORDER_MISMATCH",message:"A compared border has null transparency on one side and an opaque value on the other."
    });
    if(corner.mismatchCount) out.push({code:"CORNER_WRAP_MISMATCH",message:"Review the diagonal corner pairs at four-tile junctions."});
    for(const item of shift) out.push({code:"ONE_PIXEL_SHIFT_CANDIDATE",axis:item.axis,shift:item.shift,
      message:"A one-pixel "+(item.axis==="left-right"?"vertical":"horizontal")+" edge offset reduces interior-window mismatches from "+
        item.baselineMismatchCount+" to "+item.candidateMismatchCount+"; inspect coordinates before editing."});
    if(!blocks.aligned) out.push({code:"REPEATED_BLOCK_BOUNDARY_MISMATCH",message:"Inspect repeated-block joins; no pixel shift or repair was applied."});
    if(!out.length) out.push({code:"NO_SEAM_MISMATCHES",message:"No opposing-edge or repeated-block boundary mismatches were found for this layout."});
    return out;
  }
  function analyzeTileSeams(pixels,width,height,options) {
    validate(pixels,width,height);
    options=options===undefined?{}:options;
    if(!options||typeof options!=="object"||Array.isArray(options)) throw new TypeError("Diagnostic options must be an object.");
    const opts={repeatColumns:options.repeatColumns===undefined?2:options.repeatColumns,
      repeatRows:options.repeatRows===undefined?2:options.repeatRows,offsetX:options.offsetX===undefined?0:options.offsetX,
      offsetY:options.offsetY===undefined?0:options.offsetY,detectOnePixelShift:options.detectOnePixelShift===undefined?true:options.detectOnePixelShift};
    repeat(opts.repeatColumns,"Repeat columns"); repeat(opts.repeatRows,"Repeat rows");
    if(!Number.isSafeInteger(opts.offsetX)||!Number.isSafeInteger(opts.offsetY)) throw new TypeError("Offsets must be safe integers.");
    if(typeof opts.detectOnePixelShift!=="boolean") throw new TypeError("detectOnePixelShift must be a boolean.");
    const edge=edges(pixels,width,height),corner=corners(pixels,width,height);
    const shift=opts.detectOnePixelShift?shifts(pixels,width,height):[],blocks=repeated(pixels,width,height,opts);
    const transparentItems=edge.transparentMismatches.concat(blocks.transparentMismatches);
    const report={width:width,height:height,options:opts,edges:edge,corners:corner,onePixelShiftCandidates:shift,repeatedBlocks:blocks,
      transparentMismatchCount:transparentItems.length,transparentMismatches:transparentItems,
      seamless:edge.leftRight.mismatchCount===0&&edge.topBottom.mismatchCount===0&&corner.mismatchCount===0,suggestions:[]};
    report.suggestions=suggestions(edge,corner,shift,blocks);
    return report;
  }
  function formatTileSeamReport(report) {
    if(!report||typeof report!=="object"||!report.edges||!report.corners||!report.repeatedBlocks) throw new TypeError("A tile seam diagnostic report is required.");
    const lines=["Tile seam diagnostics — "+report.width+"×"+report.height,
      "Opposing left/right edge mismatches: "+report.edges.leftRight.mismatchCount+"/"+report.edges.leftRight.comparisons,
      "Opposing top/bottom edge mismatches: "+report.edges.topBottom.mismatchCount+"/"+report.edges.topBottom.comparisons,
      "Diagonal corner-wrap mismatches: "+report.corners.mismatchCount+"/"+report.corners.comparisons,
      "Transparent border mismatches: "+report.transparentMismatchCount,
      "Repeated blocks: "+report.repeatedBlocks.columns+" columns × "+report.repeatedBlocks.rows+" rows; "+report.repeatedBlocks.mismatchCount+" boundary mismatches",
      "Overall opposing-edge/corner seamless: "+(report.seamless?"yes":"no")];
    if(report.onePixelShiftCandidates.length) {
      lines.push("One-pixel edge-shift candidates:");
      for(const item of report.onePixelShiftCandidates) lines.push("- "+item.axis+" offset "+(item.shift>0?"+":"")+item.shift+
        ": "+item.baselineMismatchCount+" → "+item.candidateMismatchCount+" mismatches (advisory)");
    }
    if(report.suggestions.length) { lines.push("Suggestions:"); for(const item of report.suggestions) lines.push("- "+item.message); }
    lines.push("No source pixels were modified.");
    return lines.join("\n");
  }
  function serializeTileSeamReport(report,space) {
    if(!report||typeof report!=="object") throw new TypeError("A diagnostic report is required.");
    if(space!==undefined&&typeof space!=="number"&&typeof space!=="string") throw new TypeError("JSON spacing must be a number or string.");
    return JSON.stringify(report,null,space===undefined?0:space);
  }
  return Object.freeze({LIMITS:LIMITS,analyzeTileSeams:analyzeTileSeams,formatTileSeamReport:formatTileSeamReport,serializeTileSeamReport:serializeTileSeamReport});
});
