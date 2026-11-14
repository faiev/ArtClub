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
    "",
    "Inspect One Pixel Studio projects without modifying them.",
    "",
    "Options:",
    "  --json        Print a stable machine-readable JSON report.",
    "  --batch       Inspect multiple files and/or directory inputs.",
    "  --recursive   Recurse into child directories (requires --batch).",
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
      if (result.filePath !== null) {
        result.error = inspectorError("INVALID_ARGUMENT", "Use --batch before listing batch input paths.", 2);
        return result;
      }
      result.batch = true;
      continue;
    }
    if (!positionalOnly && argument === "--recursive") { result.recursive = true; continue; }
    if (!positionalOnly && argument.startsWith("-")) {
      result.error = inspectorError("INVALID_ARGUMENT", "Unknown option: " + argument + ". Use --help to see supported options.", 2);
      return result;
    }
    if (result.batch) {
      result.inputPaths.push(argument);
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
