#!/usr/bin/env node
"use strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Project = require("../js/project-model.js");
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const READ_BUFFER_BYTES = 64 * 1024;

function inspectorError(code, message, exitCode = 1) {
  const error = new Error(message);
  error.code = code;
  error.exitCode = exitCode;
  return error;
}
function usage() {
  return [
    "Usage: node tools/project-inspector.mjs [--json] <project-file>",
    "",
    "Inspect a One Pixel Studio project without modifying it.",
    "",
    "Options:",
    "  --json    Print a stable machine-readable JSON report.",
    "  --help    Show this help message.",
    "",
    "The inspector accepts v2 documents and legacy single-canvas documents.",
    "Input files larger than 64 MiB are rejected before JSON parsing."
  ].join("\n");
}
function parseArguments(argv) {
  const result = { json: false, help: false, filePath: null, error: null };
  let positionalOnly = false;
  for (const argument of argv) {
    if (!positionalOnly && argument === "--") { positionalOnly = true; continue; }
    if (!positionalOnly && argument === "--json") { result.json = true; continue; }
    if (!positionalOnly && argument === "--help") { result.help = true; continue; }
    if (!positionalOnly && argument.startsWith("-")) {
      result.error = inspectorError("INVALID_ARGUMENT", "Unknown option: " + argument + ". Use --help to see supported options.", 2);
      return result;
    }
    if (result.filePath !== null) {
      result.error = inspectorError("INVALID_ARGUMENT", "Only one project file may be inspected at a time.", 2);
      return result;
    }
    result.filePath = argument;
  }
  if (!result.help && result.filePath === null) {
    result.error = inspectorError("INVALID_ARGUMENT", "A project file path is required. Use --help for usage.", 2);
  }
  return result;
}
function readProjectFile(filePath) {
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "r");
  } catch (error) {
    throw inspectorError("FILE_READ_ERROR", "Unable to open project file " + JSON.stringify(filePath) + ": " + error.message);
  }
  try {
    const stats = fs.fstatSync(descriptor);
    if (!stats.isFile()) throw inspectorError("NOT_A_FILE", "The supplied path is not a regular file: " + filePath);
    if (stats.size > MAX_FILE_BYTES) {
      throw inspectorError("FILE_TOO_LARGE", "Project file is " + stats.size + " bytes; the inspection limit is " + MAX_FILE_BYTES + " bytes (64 MiB).");
    }
    const chunks = [];
    const buffer = Buffer.allocUnsafe(READ_BUFFER_BYTES);
    let totalBytes = 0;
    while (true) {
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
      if (totalBytes > MAX_FILE_BYTES) {
        throw inspectorError("FILE_TOO_LARGE", "Project file grew beyond the 64 MiB inspection limit while it was being read.");
      }
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    return { text: Buffer.concat(chunks, totalBytes).toString("utf8"), bytes: totalBytes };
  } catch (error) {
    if (error && error.code) throw error;
    throw inspectorError("FILE_READ_ERROR", "Unable to read project file " + JSON.stringify(filePath) + ": " + error.message);
  } finally {
    try { fs.closeSync(descriptor); } catch {}
  }
}
function isLegacyProject(data) {
  return Boolean(data && typeof data === "object" && !Array.isArray(data) &&
    data.format === undefined &&
    (data.app === "One Pixel Studio" || ("w" in data && "h" in data && "pixels" in data)));
}
function inspectProject(data, filePath, fileSizeBytes) {
  const migratedInMemory = isLegacyProject(data);
  let project;
  try {
    project = Project.deserializeProject(data);
  } catch (error) {
    throw inspectorError("INVALID_PROJECT", error.message || "Project validation failed.");
  }
  const validation = Project.validateProject(project);
  if (!validation.valid) throw inspectorError("INVALID_PROJECT", "Invalid project: " + validation.errors.join(" "));
  const width = project.canvas.width;
  const height = project.canvas.height;
  const expectedPerCel = width * height;
  let actualTotal = 0;
  let occupiedPixels = 0;
  const celSummaries = project.cels.map((cel) => {
    const actualPixels = cel.pixels.length;
    actualTotal += actualPixels;
    for (const color of cel.pixels) if (color !== null) occupiedPixels += 1;
    return {
      layerId: migratedInMemory ? null : cel.layerId,
      frameId: migratedInMemory ? null : cel.frameId,
      expectedPixels: expectedPerCel,
      actualPixels
    };
  });
  const layers = project.layers.map((layer) => ({
    id: migratedInMemory ? null : layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity
  }));
  const frames = project.frames.map((frame) => ({
    id: migratedInMemory ? null : frame.id,
    name: frame.name,
    durationMs: frame.durationMs
  }));
  const activeLayer = project.layers.find((layer) => layer.id === project.activeLayerId);
  const activeFrame = project.frames.find((frame) => frame.id === project.activeFrameId);
  return {
    ok: true,
    file: filePath,
    fileSizeBytes,
    sourceFormat: migratedInMemory ? "legacy-single-canvas" : project.format,
    sourceVersion: migratedInMemory ? (Number.isInteger(data.version) ? data.version : 1) : project.version,
    normalizedFormat: project.format,
    normalizedVersion: project.version,
    migratedInMemory,
    id: migratedInMemory ? null : project.id,
    name: project.name,
    canvas: { width, height },
    paletteSize: project.palette.length,
    layerCount: layers.length,
    frameCount: frames.length,
    activeLayer: { id: migratedInMemory ? null : activeLayer.id, name: activeLayer.name },
    activeFrame: { id: migratedInMemory ? null : activeFrame.id, name: activeFrame.name },
    celCount: project.cels.length,
    layers,
    frames,
    pixels: {
      expectedPerCel,
      expectedTotal: expectedPerCel * project.cels.length,
      actualTotal,
      occupied: occupiedPixels,
      transparent: actualTotal - occupiedPixels,
      cels: celSummaries
    },
    totalDurationMs: frames.reduce((sum, frame) => sum + frame.durationMs, 0)
  };
}
function renderHumanReport(report) {
  const visibleLayers = report.layers.filter((layer) => layer.visible).map((layer) => layer.name);
  const hiddenLayers = report.layers.filter((layer) => !layer.visible).map((layer) => layer.name);
  const lockedLayers = report.layers.filter((layer) => layer.locked).map((layer) => layer.name);
  const sourceLabel = report.migratedInMemory
    ? "Legacy single-canvas (v" + report.sourceVersion + "); migrated to v2 in memory only"
    : report.sourceFormat + " (v" + report.sourceVersion + ")";
  return [
    "Project Inspector",
    "Status: VALID",
    "File: " + report.file,
    "File size: " + report.fileSizeBytes + " bytes",
    "Source format: " + sourceLabel,
    "Normalized format: " + report.normalizedFormat + " (v" + report.normalizedVersion + ")",
    "Project: " + report.name,
    "Project ID: " + (report.id || "not stored in the source file"),
    "Canvas: " + report.canvas.width + " × " + report.canvas.height + " pixels",
    "Palette: " + report.paletteSize + " colors",
    "Layers: " + report.layerCount + " total; " + visibleLayers.length + " visible, " +
      hiddenLayers.length + " hidden, " + lockedLayers.length + " locked",
    "  Visible layers: " + (visibleLayers.join(", ") || "(none)"),
    "  Hidden layers: " + (hiddenLayers.join(", ") || "(none)"),
    "  Locked layers: " + (lockedLayers.join(", ") || "(none)"),
    "Frames: " + report.frameCount,
    "Active layer: " + report.activeLayer.name,
    "Active frame: " + report.activeFrame.name,
    "Cels: " + report.celCount,
    "Pixels: " + report.pixels.expectedPerCel + " expected per cel; " +
      report.pixels.expectedTotal + " expected total; " + report.pixels.actualTotal + " actual total",
    "Coverage across all cel data: " + report.pixels.occupied + " occupied, " + report.pixels.transparent + " transparent",
    "Frame durations: " + (report.frames.map((frame) => frame.name + " " + frame.durationMs + " ms").join(", ") || "(none)"),
    "Total animation duration: " + report.totalDurationMs + " ms"
  ].join("\n");
}
function emitFailure(filePath, jsonMode, error) {
  const failure = {
    ok: false,
    file: filePath,
    error: { code: error.code || "INSPECTION_FAILED", message: error.message || "Project inspection failed." }
  };
  if (jsonMode) {
    process.stdout.write(JSON.stringify(failure, null, 2) + "\n");
  } else {
    process.stderr.write([
      "Project Inspector",
      "Status: INVALID",
      "File: " + (filePath || "(not supplied)"),
      "Error [" + failure.error.code + "]: " + failure.error.message
    ].join("\n") + "\n");
  }
  process.exitCode = error.exitCode || 1;
}
function main(argv) {
  const args = parseArguments(argv);
  if (args.help) { process.stdout.write(usage() + "\n"); return; }
  if (args.error) { emitFailure(args.filePath, args.json, args.error); return; }
  try {
    const input = readProjectFile(args.filePath);
    let data;
    try {
      data = JSON.parse(input.text.replace(/^\uFEFF/, ""));
    } catch (error) {
      throw inspectorError("JSON_PARSE_ERROR", "Invalid JSON in " + JSON.stringify(args.filePath) + ": " + error.message);
    }
    const report = inspectProject(data, args.filePath, input.bytes);
    if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    else process.stdout.write(renderHumanReport(report) + "\n");
  } catch (error) {
    emitFailure(args.filePath, args.json, error);
  }
}
main(process.argv.slice(2));
