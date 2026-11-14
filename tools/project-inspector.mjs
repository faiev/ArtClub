#!/usr/bin/env node
"use strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Project = require("../js/project-model.js");
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const READ_BUFFER_BYTES = 64 * 1024;
const MAX_BATCH_FILES = 500;
const MAX_BATCH_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_BATCH_DIRECTORY_ENTRIES = 10000;
const MAX_BATCH_DIRECTORY_DEPTH = 32;

function inspectorError(code, message, exitCode = 1) {
  const error = new Error(message);
  error.code = code;
  error.exitCode = exitCode;
  return error;
}
function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function usage() {
  return [
    "Usage:",
    "  node tools/project-inspector.mjs [--json] <project-file>",
    "  node tools/project-inspector.mjs --batch [--recursive] [--json] <file-or-directory>...",
    "  node tools/project-inspector.mjs --compare [--json] <left-project> <right-project>",
    "",
    "Inspect One Pixel Studio projects without modifying them.",
    "",
    "Options:",
    "  --json        Print a stable machine-readable JSON report.",
    "  --batch       Inspect multiple files and/or directory inputs.",
    "  --recursive   Recurse into child directories (requires --batch).",
    "  --compare     Compare two projects without modifying either file.",
    "  --help        Show this help message.",
    "",
    "Single-file and batch inspection accept v2 documents and legacy single-canvas documents.",
    "Input files larger than 64 MiB are rejected before JSON parsing.",
    "Batch limits: 500 files and 32 MiB total input bytes.",
    "Symbolic links are not followed."
  ].join("\n");
}
function parseArguments(argv) {
  const result = {
    json: false,
    help: false,
    batch: false,
    recursive: false,
    compare: false,
    comparePaths: [],
    filePath: null,
    inputPaths: [],
    error: null
  };
  let positionalOnly = false;
  for (const argument of argv) {
    if (!positionalOnly && argument === "--") { positionalOnly = true; continue; }
    if (!positionalOnly && argument === "--json") { result.json = true; continue; }
    if (!positionalOnly && argument === "--help") { result.help = true; continue; }
    if (!positionalOnly && argument === "--batch") {
      if (result.filePath !== null || result.compare) {
        result.error = inspectorError("INVALID_ARGUMENT", "--batch cannot be combined with a single-file or compare input.", 2);
        return result;
      }
      result.batch = true;
      continue;
    }
    if (!positionalOnly && argument === "--compare") {
      if (result.batch || result.filePath !== null) {
        result.error = inspectorError("INVALID_ARGUMENT", "--compare cannot be combined with single-file or batch input.", 2);
        return result;
      }
      result.compare = true;
      continue;
    }
    if (!positionalOnly && argument === "--recursive") { result.recursive = true; continue; }
    if (!positionalOnly && argument.startsWith("-")) {
      result.error = inspectorError("INVALID_ARGUMENT", "Unknown option: " + argument + ". Use --help to see supported options.", 2);
      return result;
    }
    if (result.batch) {
      result.inputPaths.push(argument);
    } else if (result.compare) {
      result.comparePaths.push(argument);
    } else if (result.filePath === null) {
      result.filePath = argument;
    } else {
      result.error = inspectorError("INVALID_ARGUMENT", "Only one project file may be inspected at a time. Use --batch for multiple inputs.", 2);
      return result;
    }
  }
  if (result.help) return result;
  if (result.recursive && !result.batch) {
    result.error = inspectorError("INVALID_ARGUMENT", "--recursive requires --batch.", 2);
    return result;
  }
  if (result.compare && result.comparePaths.length !== 2) {
    result.error = inspectorError("INVALID_ARGUMENT", "--compare requires exactly two project file paths.", 2);
    return result;
  }
  if (result.compare && result.recursive) {
    result.error = inspectorError("INVALID_ARGUMENT", "--recursive cannot be used with --compare.", 2);
    return result;
  }
  if (result.batch && result.inputPaths.length === 0) {
    result.error = inspectorError("INVALID_ARGUMENT", "At least one file or directory path is required with --batch.", 2);
    return result;
  }
  if (!result.batch && result.filePath === null) {
    result.error = inspectorError("INVALID_ARGUMENT", "A project file path is required. Use --help for usage.", 2);
  }
  return result;
}
function readProjectFile(filePath, byteBudget = MAX_FILE_BYTES) {
  let descriptor;
  const readLimit = Math.min(MAX_FILE_BYTES, byteBudget);
  const batchLimit = readLimit < MAX_FILE_BYTES;
  try {
    const pathStats = fs.lstatSync(filePath);
    if (pathStats.isSymbolicLink()) {
      throw inspectorError("SYMLINK_NOT_FOLLOWED", "Symbolic links are not followed by the project inspector: " + filePath);
    }
    if (!pathStats.isFile()) throw inspectorError("NOT_A_FILE", "The supplied path is not a regular file: " + filePath);
    if (pathStats.size > readLimit) {
      throw inspectorError(
        batchLimit ? "BATCH_TOTAL_SIZE_LIMIT" : "FILE_TOO_LARGE",
        batchLimit
          ? "Reading this file would exceed the remaining batch byte budget."
          : "Project file is " + pathStats.size + " bytes; the inspection limit is " + MAX_FILE_BYTES + " bytes (64 MiB)."
      );
    }
    const noFollow = fs.constants.O_NOFOLLOW || 0;
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
  } catch (error) {
    if (error && Number.isInteger(error.exitCode)) throw error;
    throw inspectorError("FILE_READ_ERROR", "Unable to open project file " + JSON.stringify(filePath) + ": " + error.message);
  }
  try {
    const stats = fs.fstatSync(descriptor);
    if (!stats.isFile()) throw inspectorError("NOT_A_FILE", "The supplied path is not a regular file: " + filePath);
    if (stats.size > readLimit) {
      throw inspectorError(
        batchLimit ? "BATCH_TOTAL_SIZE_LIMIT" : "FILE_TOO_LARGE",
        batchLimit
          ? "Reading this file would exceed the remaining batch byte budget."
          : "Project file is " + stats.size + " bytes; the inspection limit is " + MAX_FILE_BYTES + " bytes (64 MiB)."
      );
    }
    const chunks = [];
    const buffer = Buffer.allocUnsafe(READ_BUFFER_BYTES);
    let totalBytes = 0;
    while (true) {
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
      if (totalBytes > readLimit) {
        const limitError = inspectorError(
          batchLimit ? "BATCH_TOTAL_SIZE_LIMIT" : "FILE_TOO_LARGE",
          batchLimit
            ? "Project file grew beyond the remaining batch byte budget while it was being read."
            : "Project file grew beyond the 64 MiB inspection limit while it was being read."
        );
        limitError.bytesRead = totalBytes;
        throw limitError;
      }
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    return { text: Buffer.concat(chunks, totalBytes).toString("utf8"), bytes: totalBytes };
  } catch (error) {
    if (error && Number.isInteger(error.exitCode)) throw error;
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
function inspectOneFile(filePath, byteBudget = MAX_FILE_BYTES) {
  let bytesRead = 0;
  try {
    const input = readProjectFile(filePath, byteBudget);
    bytesRead = input.bytes;
    let data;
    try {
      data = JSON.parse(input.text.replace(/^\uFEFF/, ""));
    } catch (error) {
      throw inspectorError("JSON_PARSE_ERROR", "Invalid JSON in " + JSON.stringify(filePath) + ": " + error.message);
    }
    return { report: inspectProject(data, filePath, input.bytes), bytesRead: input.bytes };
  } catch (error) {
    return {
      report: {
        ok: false,
        file: filePath,
        error: { code: error.code || "INSPECTION_FAILED", message: error.message || "Project inspection failed." }
      },
      bytesRead: Number.isFinite(error.bytesRead) ? error.bytesRead : bytesRead
    };
  }
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
function batchFailure(filePath, code, message) {
  return {
    ok: false,
    file: filePath,
    error: { code, message }
  };
}
function collectBatchFiles(inputPaths, recursive) {
  const files = [];
  const discoveryErrors = [];
  const warnings = [];
  const seenFiles = new Set();
  const seenDirectories = new Set();
  let visitedEntries = 0;
  let discoveredFileCount = 0;
  let fatalLimit = false;

  function addFile(filePath) {
    const normalized = path.resolve(filePath);
    if (seenFiles.has(normalized)) {
      warnings.push({ code: "DUPLICATE_PATH", path: normalized, message: "Duplicate input path was ignored." });
      return;
    }
    seenFiles.add(normalized);
    discoveredFileCount += 1;
    if (discoveredFileCount > MAX_BATCH_FILES) {
      discoveryErrors.push({
        path: normalized,
        code: "BATCH_FILE_LIMIT",
        message: "Batch input exceeds the " + MAX_BATCH_FILES + "-file limit; no partial batch was inspected."
      });
      fatalLimit = true;
      return;
    }
    files.push(normalized);
  }

  function addDiscoveryError(filePath, code, message) {
    discoveryErrors.push({ path: filePath, code, message });
  }

  function visit(inputPath, depth) {
    if (fatalLimit) return;
    const normalized = path.resolve(inputPath);
    let stats;
    try {
      stats = fs.lstatSync(normalized);
    } catch (error) {
      addDiscoveryError(normalized, "PATH_ACCESS_ERROR", "Unable to inspect input path: " + error.message);
      return;
    }
    if (stats.isSymbolicLink()) {
      addDiscoveryError(normalized, "SYMLINK_NOT_FOLLOWED", "Symbolic links are not followed by the project inspector.");
      return;
    }
    if (stats.isFile()) {
      addFile(normalized);
      return;
    }
    if (!stats.isDirectory()) {
      addDiscoveryError(normalized, "NOT_A_FILE_OR_DIRECTORY", "Input path is neither a regular file nor a directory.");
      return;
    }
    if (depth > MAX_BATCH_DIRECTORY_DEPTH) {
      addDiscoveryError(normalized, "DIRECTORY_DEPTH_LIMIT", "Directory traversal exceeded the " + MAX_BATCH_DIRECTORY_DEPTH + "-level depth limit.");
      return;
    }
    if (seenDirectories.has(normalized)) return;
    seenDirectories.add(normalized);

    let directory;
    const entries = [];
    try {
      directory = fs.opendirSync(normalized);
      while (true) {
        const entry = directory.readSync();
        if (entry === null) break;
        visitedEntries += 1;
        if (visitedEntries > MAX_BATCH_DIRECTORY_ENTRIES) {
          addDiscoveryError(normalized, "DIRECTORY_ENTRY_LIMIT",
            "Directory traversal exceeded the " + MAX_BATCH_DIRECTORY_ENTRIES + "-entry safety limit; no partial batch was inspected.");
          fatalLimit = true;
          break;
        }
        entries.push(entry);
      }
    } catch (error) {
      addDiscoveryError(normalized, "DIRECTORY_READ_ERROR", "Unable to read directory: " + error.message);
      return;
    } finally {
      if (directory) {
        try { directory.closeSync(); } catch {}
      }
    }
    entries.sort((left, right) => lexicalCompare(left.name, right.name));
    for (const entry of entries) {
      if (fatalLimit) break;
      const entryPath = path.join(normalized, entry.name);
      if (entry.isSymbolicLink()) {
        addDiscoveryError(entryPath, "SYMLINK_NOT_FOLLOWED", "Symbolic links are not followed by the project inspector.");
      } else if (entry.isFile()) {
        addFile(entryPath);
      } else if (entry.isDirectory() && recursive) {
        visit(entryPath, depth + 1);
      }
    }
  }

  const roots = inputPaths.map((inputPath) => path.resolve(inputPath)).sort(lexicalCompare);
  for (const root of roots) {
    if (fatalLimit) break;
    visit(root, 0);
  }
  files.sort(lexicalCompare);
  discoveryErrors.sort((left, right) => lexicalCompare(left.path || "", right.path || "") || lexicalCompare(left.code, right.code));
  warnings.sort((left, right) => lexicalCompare(left.path, right.path));
  return { files, discoveryErrors, warnings, fatalLimit, visitedEntries, discoveredFileCount };
}
function inspectBatch(inputPaths, recursive) {
  const collected = collectBatchFiles(inputPaths, recursive);
  const results = [];
  let bytesRead = 0;
  if (!collected.fatalLimit) {
    for (const filePath of collected.files) {
      let fileSize;
      try {
        const stats = fs.lstatSync(filePath);
        if (stats.isSymbolicLink()) {
          results.push(batchFailure(filePath, "SYMLINK_NOT_FOLLOWED", "Symbolic links are not followed by the project inspector."));
          continue;
        }
        if (!stats.isFile()) {
          results.push(batchFailure(filePath, "NOT_A_FILE", "The input is no longer a regular file."));
          continue;
        }
        fileSize = stats.size;
      } catch (error) {
        results.push(batchFailure(filePath, "FILE_READ_ERROR", "Unable to inspect file: " + error.message));
        continue;
      }
      if (fileSize <= MAX_FILE_BYTES && bytesRead + fileSize > MAX_BATCH_TOTAL_BYTES) {
        results.push(batchFailure(filePath, "BATCH_TOTAL_SIZE_LIMIT",
          "Reading this file would exceed the batch total input limit of " + MAX_BATCH_TOTAL_BYTES + " bytes (32 MiB)."));
        continue;
      }
      const remainingBytes = Math.max(0, MAX_BATCH_TOTAL_BYTES - bytesRead);
      const inspected = inspectOneFile(filePath, Math.min(MAX_FILE_BYTES, remainingBytes));
      bytesRead += inspected.bytesRead;
      results.push(inspected.report);
    }
  }
  const successCount = results.filter((result) => result.ok).length;
  const failureCount = results.length - successCount + collected.discoveryErrors.length;
  return {
    ok: failureCount === 0 && !collected.fatalLimit,
    mode: "batch",
    recursive,
    inputCount: inputPaths.length,
    fileCount: collected.discoveredFileCount,
    successCount,
    failureCount,
    bytesRead,
    limits: {
      maxFiles: MAX_BATCH_FILES,
      maxFileBytes: MAX_FILE_BYTES,
      maxTotalBytes: MAX_BATCH_TOTAL_BYTES,
      maxDirectoryEntries: MAX_BATCH_DIRECTORY_ENTRIES,
      maxDirectoryDepth: MAX_BATCH_DIRECTORY_DEPTH
    },
    warnings: collected.warnings,
    discoveryErrors: collected.discoveryErrors,
    results
  };
}
function renderHumanBatchReport(report) {
  const lines = [
    "Project Inspector — Batch",
    "Status: " + (report.ok ? "VALID" : "COMPLETED WITH ERRORS"),
    "Files: " + report.fileCount + " discovered; " + report.successCount + " valid; " + report.failureCount + " errors",
    "Bytes read: " + report.bytesRead,
    "Limits: " + report.limits.maxFiles + " files; " + report.limits.maxTotalBytes + " total bytes; " +
      report.limits.maxFileBytes + " bytes per file",
    ""
  ];
  for (const result of report.results) {
    if (result.ok) {
      lines.push("VALID " + result.file + " — " + result.name + " — " +
        result.canvas.width + " × " + result.canvas.height + " — " +
        result.layerCount + " layers, " + result.frameCount + " frames");
    } else {
      lines.push("INVALID " + result.file + " — Error [" + result.error.code + "]: " + result.error.message);
    }
  }
  for (const error of report.discoveryErrors) {
    lines.push("ERROR " + (error.path || "(batch)") + " — Error [" + error.code + "]: " + error.message);
  }
  for (const warning of report.warnings) {
    lines.push("WARNING " + warning.path + " — " + warning.message);
  }
  return lines.join("\n");
}

function loadCompareInput(filePath) {
  const input = readProjectFile(filePath);
  let data;
  try {
    data = JSON.parse(input.text.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw inspectorError("JSON_PARSE_ERROR", "Invalid JSON in " + JSON.stringify(filePath) + ": " + error.message);
  }
  const migratedInMemory = isLegacyProject(data);
  let project;
  try {
    project = Project.deserializeProject(data);
  } catch (error) {
    throw inspectorError("INVALID_PROJECT", error.message || "Project validation failed.");
  }
  const validation = Project.validateProject(project);
  if (!validation.valid) {
    throw inspectorError("INVALID_PROJECT", "Invalid project: " + validation.errors.join(" "));
  }
  return {
    file: filePath,
    fileSizeBytes: input.bytes,
    sourceFormat: migratedInMemory ? "legacy-single-canvas" : project.format,
    sourceVersion: migratedInMemory ? (Number.isInteger(data.version) ? data.version : 1) : project.version,
    migratedInMemory,
    project
  };
}
function stableSerialize(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  return "{" + Object.keys(value).sort(lexicalCompare).map((key) =>
    JSON.stringify(key) + ":" + stableSerialize(value[key])
  ).join(",") + "}";
}
function diffValuesEqual(left, right) {
  return stableSerialize(left) === stableSerialize(right);
}
function previewDiffValue(value) {
  if (value === undefined) return { state: "absent" };
  const serialized = stableSerialize(value);
  if (serialized.length <= 240) return value;
  return {
    type: Array.isArray(value) ? "array" : typeof value,
    preview: serialized.slice(0, 237) + "...",
    truncated: true
  };
}
function compareFields(before, after, fields) {
  const changes = [];
  for (const field of fields) {
    if (!diffValuesEqual(before[field], after[field])) {
      changes.push({
        field,
        before: previewDiffValue(before[field]),
        after: previewDiffValue(after[field])
      });
    }
  }
  return changes;
}
function compareCanvas(left, right) {
  const fields = compareFields(left.project.canvas, right.project.canvas, ["width", "height", "background"]);
  return {
    changed: fields.length > 0,
    fields,
    before: {
      width: left.project.canvas.width,
      height: left.project.canvas.height,
      background: left.project.canvas.background === undefined ? null : left.project.canvas.background
    },
    after: {
      width: right.project.canvas.width,
      height: right.project.canvas.height,
      background: right.project.canvas.background === undefined ? null : right.project.canvas.background
    }
  };
}
function comparePalette(left, right) {
  const before = left.project.palette;
  const after = right.project.palette;
  const entries = [];
  const count = Math.max(before.length, after.length);
  for (let index = 0; index < count; index += 1) {
    const hasBefore = index < before.length;
    const hasAfter = index < after.length;
    if (hasBefore && hasAfter && before[index] === after[index]) continue;
    entries.push({
      index,
      kind: !hasBefore ? "added" : !hasAfter ? "removed" : "changed",
      before: hasBefore ? before[index] : { state: "absent" },
      after: hasAfter ? after[index] : { state: "absent" }
    });
  }
  return {
    changed: entries.length > 0,
    beforeCount: before.length,
    afterCount: after.length,
    entries
  };
}
function summarizeEntity(entity, index, kind, migratedInMemory) {
  const result = {
    index,
    id: migratedInMemory ? null : entity.id,
    name: entity.name
  };
  if (kind === "layer") {
    result.visible = entity.visible;
    result.locked = entity.locked;
    result.opacity = entity.opacity;
  } else {
    result.durationMs = entity.durationMs;
  }
  return result;
}
function compareEntityCollection(beforeItems, afterItems, left, right, kind) {
  const idField = "id";
  const fields = kind === "layer"
    ? ["name", "visible", "locked", "opacity"]
    : ["name", "durationMs"];
  const bothLegacy = left.migratedInMemory && right.migratedInMemory;
  const bothVersioned = !left.migratedInMemory && !right.migratedInMemory;
  const matchBy = bothLegacy ? "position" : bothVersioned ? "source-id" : "none-across-source-formats";
  const beforeMatched = new Set();
  const afterMatched = new Set();
  const pairs = [];

  if (matchBy === "position") {
    const length = Math.min(beforeItems.length, afterItems.length);
    for (let index = 0; index < length; index += 1) {
      beforeMatched.add(index);
      afterMatched.add(index);
      pairs.push([index, index]);
    }
  } else if (matchBy === "source-id") {
    const afterById = new Map(afterItems.map((item, index) => [item[idField], index]));
    beforeItems.forEach((item, beforeIndex) => {
      const afterIndex = afterById.get(item[idField]);
      if (afterIndex !== undefined) {
        beforeMatched.add(beforeIndex);
        afterMatched.add(afterIndex);
        pairs.push([beforeIndex, afterIndex]);
      }
    });
  }

  const added = [];
  const removed = [];
  const modified = [];
  afterItems.forEach((item, index) => {
    if (!afterMatched.has(index)) {
      added.push(summarizeEntity(item, index, kind, right.migratedInMemory));
    }
  });
  beforeItems.forEach((item, index) => {
    if (!beforeMatched.has(index)) {
      removed.push(summarizeEntity(item, index, kind, left.migratedInMemory));
    }
  });
  for (const [beforeIndex, afterIndex] of pairs) {
    const before = beforeItems[beforeIndex];
    const after = afterItems[afterIndex];
    const changes = compareFields(before, after, fields);
    if (changes.length) {
      modified.push({
        id: bothLegacy ? null : before.id,
        beforeIndex,
        afterIndex,
        changes
      });
    }
  }
  return { matchBy, added, removed, modified };
}
function summarizeCel(cel, index, migratedInMemory) {
  let transparentPixels = 0;
  for (const pixel of cel.pixels) if (pixel === null) transparentPixels += 1;
  return {
    index,
    layerId: migratedInMemory ? null : cel.layerId,
    frameId: migratedInMemory ? null : cel.frameId,
    pixelCount: cel.pixels.length,
    transparentPixels
  };
}
function celRemovalReason(cel, targetProject, targetIsLegacy, direction) {
  if (targetIsLegacy) return "source-identifiers-not-comparable";
  if (!targetProject.layers.some((layer) => layer.id === cel.layerId)) {
    return direction === "removed" ? "layer-removed" : "layer-added";
  }
  if (!targetProject.frames.some((frame) => frame.id === cel.frameId)) {
    return direction === "removed" ? "frame-removed" : "frame-added";
  }
  return direction === "removed" ? "cel-missing" : "cel-added";
}
function comparePixelArrays(beforePixels, afterPixels) {
  const length = Math.max(beforePixels.length, afterPixels.length);
  const samples = [];
  let changedCount = 0;
  for (let index = 0; index < length; index += 1) {
    const hasBefore = index < beforePixels.length;
    const hasAfter = index < afterPixels.length;
    const beforeValue = hasBefore ? beforePixels[index] : undefined;
    const afterValue = hasAfter ? afterPixels[index] : undefined;
    if (hasBefore === hasAfter && (!hasBefore || beforeValue === afterValue)) continue;
    changedCount += 1;
    if (samples.length < 100) {
      samples.push({
        index,
        before: hasBefore ? { state: "pixel", value: beforeValue } : { state: "out-of-range" },
        after: hasAfter ? { state: "pixel", value: afterValue } : { state: "out-of-range" }
      });
    }
  }
  return {
    changedCount,
    samples,
    truncated: changedCount > samples.length,
    beforeLength: beforePixels.length,
    afterLength: afterPixels.length
  };
}
function compareCelCollections(left, right) {
  const beforeCels = left.project.cels;
  const afterCels = right.project.cels;
  const bothLegacy = left.migratedInMemory && right.migratedInMemory;
  const bothVersioned = !left.migratedInMemory && !right.migratedInMemory;
  const matchBy = bothLegacy ? "position" : bothVersioned ? "layerId+frameId" : "none-across-source-formats";
  const beforeMatched = new Set();
  const afterMatched = new Set();
  const pairs = [];

  if (matchBy === "position") {
    const length = Math.min(beforeCels.length, afterCels.length);
    for (let index = 0; index < length; index += 1) {
      beforeMatched.add(index);
      afterMatched.add(index);
      pairs.push([index, index]);
    }
  } else if (matchBy === "layerId+frameId") {
    const afterByKey = new Map(afterCels.map((cel, index) => [cel.layerId + "\u0000" + cel.frameId, index]));
    beforeCels.forEach((cel, beforeIndex) => {
      const afterIndex = afterByKey.get(cel.layerId + "\u0000" + cel.frameId);
      if (afterIndex !== undefined) {
        beforeMatched.add(beforeIndex);
        afterMatched.add(afterIndex);
        pairs.push([beforeIndex, afterIndex]);
      }
    });
  }

  const added = [];
  const removed = [];
  const modified = [];
  afterCels.forEach((cel, index) => {
    if (!afterMatched.has(index)) {
      added.push({
        ...summarizeCel(cel, index, right.migratedInMemory),
        reason: celRemovalReason(cel, left.project, left.migratedInMemory, "added")
      });
    }
  });
  beforeCels.forEach((cel, index) => {
    if (!beforeMatched.has(index)) {
      removed.push({
        ...summarizeCel(cel, index, left.migratedInMemory),
        reason: celRemovalReason(cel, right.project, right.migratedInMemory, "removed")
      });
    }
  });

  let pixelIndexChanges = 0;
  for (const [beforeIndex, afterIndex] of pairs) {
    const before = beforeCels[beforeIndex];
    const after = afterCels[afterIndex];
    const pixels = comparePixelArrays(before.pixels, after.pixels);
    pixelIndexChanges += pixels.changedCount;
    if (pixels.changedCount) {
      modified.push({
        layerId: bothLegacy ? null : before.layerId,
        frameId: bothLegacy ? null : before.frameId,
        beforeIndex,
        afterIndex,
        pixelChanges: pixels
      });
    }
  }
  return { matchBy, added, removed, modified, pixelIndexChanges };
}
function compareProjectDocuments(left, right) {
  const canvas = compareCanvas(left, right);
  const palette = comparePalette(left, right);
  const bothVersioned = !left.migratedInMemory && !right.migratedInMemory;
  const projectFields = ["name", "selectedColorIndex"];
  if (bothVersioned) projectFields.push("id", "activeLayerId", "activeFrameId");
  const projectChanges = compareFields(left.project, right.project, projectFields);
  const leftMetadata = left.migratedInMemory ? {} : (left.project.metadata || {});
  const rightMetadata = right.migratedInMemory ? {} : (right.project.metadata || {});
  const metadataFields = Array.from(new Set([
    ...Object.keys(leftMetadata),
    ...Object.keys(rightMetadata)
  ])).sort(lexicalCompare);
  const metadataChanges = [];
  for (const field of metadataFields) {
    if (!diffValuesEqual(leftMetadata[field], rightMetadata[field])) {
      metadataChanges.push({
        field,
        before: previewDiffValue(leftMetadata[field]),
        after: previewDiffValue(rightMetadata[field])
      });
    }
  }
  const layers = compareEntityCollection(left.project.layers, right.project.layers, left, right, "layer");
  const frames = compareEntityCollection(left.project.frames, right.project.frames, left, right, "frame");
  const cels = compareCelCollections(left, right);
  const layerChanges = layers.added.length + layers.removed.length + layers.modified.length;
  const frameChanges = frames.added.length + frames.removed.length + frames.modified.length;
  const celChanges = cels.added.length + cels.removed.length + cels.modified.length;
  const totalChanges = canvas.fields.length + palette.entries.length + projectChanges.length +
    metadataChanges.length + layerChanges + frameChanges + celChanges + cels.pixelIndexChanges;
  return {
    ok: true,
    mode: "compare",
    identical: totalChanges === 0,
    left: {
      file: left.file,
      fileSizeBytes: left.fileSizeBytes,
      sourceFormat: left.sourceFormat,
      sourceVersion: left.sourceVersion,
      migratedInMemory: left.migratedInMemory,
      projectId: left.migratedInMemory ? null : left.project.id,
      name: left.project.name,
      canvas: { width: left.project.canvas.width, height: left.project.canvas.height }
    },
    right: {
      file: right.file,
      fileSizeBytes: right.fileSizeBytes,
      sourceFormat: right.sourceFormat,
      sourceVersion: right.sourceVersion,
      migratedInMemory: right.migratedInMemory,
      projectId: right.migratedInMemory ? null : right.project.id,
      name: right.project.name,
      canvas: { width: right.project.canvas.width, height: right.project.canvas.height }
    },
    matchPolicy: {
      versioned: "v2 entities and cels are matched only by exact source IDs.",
      legacy: "two legacy inputs are matched by normalized array position; generated IDs are ignored.",
      mixed: "legacy and v2 entities are not cross-matched because legacy source IDs do not exist."
    },
    changes: {
      canvas,
      palette,
      project: projectChanges,
      metadata: metadataChanges,
      layers,
      frames,
      cels,
      summary: {
        canvasFieldsChanged: canvas.fields.length,
        paletteEntriesChanged: palette.entries.length,
        projectFieldsChanged: projectChanges.length,
        metadataFieldsChanged: metadataChanges.length,
        layerRecordsChanged: layerChanges,
        frameRecordsChanged: frameChanges,
        celRecordsChanged: celChanges,
        pixelIndexesChanged: cels.pixelIndexChanges
      }
    },
    totalChanges
  };
}
function inspectComparison(leftPath, rightPath) {
  try {
    const left = loadCompareInput(leftPath);
    const right = loadCompareInput(rightPath);
    if (left.fileSizeBytes + right.fileSizeBytes > 128 * 1024 * 1024) {
      throw inspectorError("COMPARE_TOTAL_SIZE_LIMIT", "The two input files exceed the 128 MiB combined comparison limit.");
    }
    return compareProjectDocuments(left, right);
  } catch (error) {
    return {
      ok: false,
      mode: "compare",
      identical: false,
      left: { file: leftPath },
      right: { file: rightPath },
      error: {
        code: error.code || "COMPARE_FAILED",
        message: error.message || "Project comparison failed."
      }
    };
  }
}
function renderHumanComparison(report) {
  if (!report.ok) {
    return [
      "Project Inspector — Compare",
      "Status: INVALID",
      "Left: " + report.left.file,
      "Right: " + report.right.file,
      "Error [" + report.error.code + "]: " + report.error.message
    ].join("\n");
  }
  const changes = report.changes;
  const lines = [
    "Project Inspector — Compare",
    "Left: " + report.left.file + " — " + report.left.name,
    "Right: " + report.right.file + " — " + report.right.name,
    "Status: " + (report.identical ? "IDENTICAL" : "DIFFERENCES FOUND"),
    "Total changes: " + report.totalChanges,
    "Canvas fields changed: " + changes.canvas.fields.length,
    "Palette entries changed: " + changes.palette.entries.length,
    "Project fields changed: " + changes.project.length,
    "Metadata fields changed: " + changes.metadata.length,
    "Layers: " + changes.layers.added.length + " added, " + changes.layers.removed.length +
      " removed, " + changes.layers.modified.length + " modified (match by " + changes.layers.matchBy + ")",
    "Frames: " + changes.frames.added.length + " added, " + changes.frames.removed.length +
      " removed, " + changes.frames.modified.length + " modified (match by " + changes.frames.matchBy + ")",
    "Cels: " + changes.cels.added.length + " added, " + changes.cels.removed.length +
      " removed, " + changes.cels.modified.length + " modified (match by " + changes.cels.matchBy + ")",
    "Pixel indexes changed: " + changes.cels.pixelIndexChanges
  ];
  for (const item of changes.layers.modified) {
    lines.push("  Layer modified: " + (item.id || "position " + item.beforeIndex) +
      " — " + item.changes.map((change) => change.field).join(", "));
  }
  for (const item of changes.frames.modified) {
    lines.push("  Frame modified: " + (item.id || "position " + item.beforeIndex) +
      " — " + item.changes.map((change) => change.field).join(", "));
  }
  for (const item of changes.cels.removed) {
    lines.push("  Cel removed: " + (item.layerId || "legacy layer") + "/" +
      (item.frameId || "legacy frame") + " (" + item.reason + ")");
  }
  for (const item of changes.cels.added) {
    lines.push("  Cel added: " + (item.layerId || "legacy layer") + "/" +
      (item.frameId || "legacy frame") + " (" + item.reason + ")");
  }
  for (const item of changes.cels.modified) {
    lines.push("  Cel pixel changes: " + (item.layerId || "legacy position") + "/" +
      (item.frameId || "legacy position") + " — " + item.pixelChanges.changedCount +
      " indexes; sample " + item.pixelChanges.samples.length +
      (item.pixelChanges.truncated ? " (truncated)" : ""));
  }
  return lines.join("\n");
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
  if (args.compare) {
    const report = inspectComparison(args.comparePaths[0], args.comparePaths[1]);
    if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    else process.stdout.write(renderHumanComparison(report) + "\n");
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (args.batch) {
    const report = inspectBatch(args.inputPaths, args.recursive);
    if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    else process.stdout.write(renderHumanBatchReport(report) + "\n");
    if (!report.ok) process.exitCode = 1;
    return;
  }
  const inspected = inspectOneFile(args.filePath);
  if (inspected.report.ok) {
    if (args.json) process.stdout.write(JSON.stringify(inspected.report, null, 2) + "\n");
    else process.stdout.write(renderHumanReport(inspected.report) + "\n");
  } else {
    const error = inspectorError(inspected.report.error.code, inspected.report.error.message);
    emitFailure(args.filePath, args.json, error);
  }
}
main(process.argv.slice(2));
