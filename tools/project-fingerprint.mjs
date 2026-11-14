#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { TextDecoder } from "node:util";

const require = createRequire(import.meta.url);
const Project = require("../js/project-model.js");

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_BATCH_FILES = 500;
const MAX_BATCH_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_BATCH_DIRECTORY_ENTRIES = 10000;
const MAX_BATCH_DIRECTORY_DEPTH = 32;
const SEMANTIC_CANONICAL_VERSION = 1;

function fingerprintError(code, message, exitCode = 1) {
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
    "  node tools/project-fingerprint.mjs [--json] <project-file>",
    "  node tools/project-fingerprint.mjs --batch [--recursive] [--json] <file-or-directory>...",
    "",
    "Create exact source-byte and semantic project fingerprints without modifying inputs.",
    "",
    "Options:",
    "  --json        Print a stable machine-readable JSON report.",
    "  --batch       Fingerprint multiple files and/or directory inputs.",
    "  --recursive   Recurse into child directories (requires --batch).",
    "  --help        Show this help message.",
    "",
    "Supported inputs: current v2 projects and legacy single-canvas v1 projects.",
    "Canonical semantic fingerprint version: " + SEMANTIC_CANONICAL_VERSION + ".",
    "Single-file limit: 64 MiB. Batch limits: 500 files and 32 MiB total input bytes.",
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
    if (!positionalOnly && argument === "--") {
      positionalOnly = true;
      continue;
    }
    if (!positionalOnly && argument === "--json") {
      result.json = true;
      continue;
    }
    if (!positionalOnly && argument === "--help") {
      result.help = true;
      continue;
    }
    if (!positionalOnly && argument === "--batch") {
      if (result.filePath !== null) {
        result.error = fingerprintError("INVALID_ARGUMENT", "--batch cannot be combined with a single-file input.", 2);
        return result;
      }
      result.batch = true;
      continue;
    }
    if (!positionalOnly && argument === "--recursive") {
      result.recursive = true;
      continue;
    }
    if (!positionalOnly && argument.startsWith("-")) {
      result.error = fingerprintError(
        "INVALID_ARGUMENT",
        "Unknown option: " + argument + ". Use --help to see supported options.",
        2
      );
      return result;
    }

    if (result.batch) {
      result.inputPaths.push(argument);
    } else if (result.filePath === null) {
      result.filePath = argument;
    } else {
      result.error = fingerprintError(
        "INVALID_ARGUMENT",
        "Only one project file may be fingerprinted at a time. Use --batch for multiple inputs.",
        2
      );
      return result;
    }
  }

  if (result.help) return result;
  if (result.recursive && !result.batch) {
    result.error = fingerprintError("INVALID_ARGUMENT", "--recursive requires --batch.", 2);
    return result;
  }
  if (result.batch && result.inputPaths.length === 0) {
    result.error = fingerprintError("INVALID_ARGUMENT", "At least one file or directory path is required with --batch.", 2);
    return result;
  }
  if (!result.batch && result.filePath === null) {
    result.error = fingerprintError("INVALID_ARGUMENT", "A project file path is required. Use --help for usage.", 2);
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
      throw fingerprintError("SYMLINK_NOT_FOLLOWED", "Symbolic links are not followed by the project fingerprint tool: " + filePath);
    }
    if (!pathStats.isFile()) {
      throw fingerprintError("NOT_A_FILE", "The supplied path is not a regular file: " + filePath);
    }
    if (pathStats.size > readLimit) {
      throw fingerprintError(
        batchLimit ? "BATCH_TOTAL_SIZE_LIMIT" : "FILE_TOO_LARGE",
        batchLimit
          ? "Reading this file would exceed the remaining batch byte budget."
          : "Project file is " + pathStats.size + " bytes; the fingerprint limit is " + MAX_FILE_BYTES + " bytes (64 MiB)."
      );
    }

    const noFollow = fs.constants.O_NOFOLLOW || 0;
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
  } catch (error) {
    if (error && Number.isInteger(error.exitCode)) throw error;
    if (error && error.code === "ELOOP") {
      throw fingerprintError("SYMLINK_NOT_FOLLOWED", "Symbolic links are not followed by the project fingerprint tool: " + filePath);
    }
    throw fingerprintError(
      "FILE_READ_ERROR",
      "Unable to open project file " + JSON.stringify(filePath) + ": " + error.message
    );
  }

  try {
    const stats = fs.fstatSync(descriptor);
    if (!stats.isFile()) {
      throw fingerprintError("NOT_A_FILE", "The supplied path is not a regular file: " + filePath);
    }
    if (stats.size > readLimit) {
      throw fingerprintError(
        batchLimit ? "BATCH_TOTAL_SIZE_LIMIT" : "FILE_TOO_LARGE",
        batchLimit
          ? "Reading this file would exceed the remaining batch byte budget."
          : "Project file is " + stats.size + " bytes; the fingerprint limit is " + MAX_FILE_BYTES + " bytes (64 MiB)."
      );
    }

    const chunks = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let totalBytes = 0;
    while (true) {
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
      if (totalBytes > readLimit) {
        const error = fingerprintError(
          batchLimit ? "BATCH_TOTAL_SIZE_LIMIT" : "FILE_TOO_LARGE",
          batchLimit
            ? "Project file grew beyond the remaining batch byte budget while being read."
            : "Project file grew beyond the 64 MiB fingerprint limit while being read."
        );
        error.bytesRead = totalBytes;
        throw error;
      }
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }

    const sourceBuffer = Buffer.concat(chunks, totalBytes);
    return {
      buffer: sourceBuffer,
      bytes: totalBytes
    };
  } catch (error) {
    if (error && Number.isInteger(error.exitCode)) throw error;
    throw fingerprintError(
      "FILE_READ_ERROR",
      "Unable to read project file " + JSON.stringify(filePath) + ": " + error.message
    );
  } finally {
    try { fs.closeSync(descriptor); } catch {}
  }
}

function isLegacyProject(data) {
  return Boolean(
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data.format === undefined &&
    (data.app === "One Pixel Studio" || ("w" in data && "h" in data && "pixels" in data))
  );
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort(lexicalCompare);
  return "{" + keys.map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
}

function normalizeColor(color) {
  if (color === null || color === undefined) return null;
  return typeof color === "string" ? color.toLowerCase() : color;
}

function buildCanonicalProjection(project) {
  const layerIndexes = new Map(project.layers.map((layer, index) => [layer.id, index]));
  const frameIndexes = new Map(project.frames.map((frame, index) => [frame.id, index]));

  const cels = project.cels.map((cel) => ({
    layerIndex: layerIndexes.get(cel.layerId),
    frameIndex: frameIndexes.get(cel.frameId),
    pixels: cel.pixels.map(normalizeColor)
  }));

  cels.sort((left, right) =>
    left.layerIndex - right.layerIndex || left.frameIndex - right.frameIndex
  );

  return {
    canonicalVersion: SEMANTIC_CANONICAL_VERSION,
    canvas: {
      width: project.canvas.width,
      height: project.canvas.height,
      background: normalizeColor(project.canvas.background)
    },
    palette: project.palette.map(normalizeColor),
    layers: project.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity
    })),
    frames: project.frames.map((frame) => ({
      name: frame.name,
      durationMs: frame.durationMs
    })),
    cels
  };
}

function validateAndNormalizeSource(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw fingerprintError("PROJECT_NOT_OBJECT", "The JSON root must be a project object.");
  }

  const legacy = isLegacyProject(data);
  if (legacy) {
    if (data.version !== undefined && data.version !== 1) {
      throw fingerprintError(
        "UNSUPPORTED_VERSION",
        "Legacy project version " + JSON.stringify(data.version) + " is unsupported; expected version 1."
      );
    }
  } else {
    if (data.format !== Project.FORMAT) {
      throw fingerprintError(
        "UNSUPPORTED_FORMAT",
        "Project format " + JSON.stringify(data.format === undefined ? null : data.format) +
          " is unsupported; expected " + Project.FORMAT + "."
      );
    }
    if (data.version !== Project.VERSION) {
      throw fingerprintError(
        "UNSUPPORTED_VERSION",
        "Project version " + JSON.stringify(data.version === undefined ? null : data.version) +
          " is unsupported; expected version " + Project.VERSION + "."
      );
    }
  }

  let project;
  try {
    project = Project.deserializeProject(data);
  } catch (error) {
    throw fingerprintError("INVALID_PROJECT", error.message || "Project model rejected the document.");
  }

  const validation = Project.validateProject(project);
  if (!validation.valid) {
    throw fingerprintError("INVALID_PROJECT", validation.errors.join(" "));
  }

  return {
    project,
    legacy,
    sourceFormat: legacy ? "legacy-single-canvas" : data.format,
    sourceVersion: legacy ? (Number.isInteger(data.version) ? data.version : 1) : data.version,
    sourceIdentity: {
      id: !legacy && typeof data.id === "string" ? data.id : null,
      name: legacy
        ? (typeof data.projectName === "string" ? data.projectName : null)
        : (typeof data.name === "string" ? data.name : null),
      hasSourceId: !legacy && typeof data.id === "string"
    }
  };
}

function fingerprintProjectData(data, filePath, input) {
  const normalized = validateAndNormalizeSource(data);
  const projection = buildCanonicalProjection(normalized.project);
  const canonicalText = canonicalJson(projection);
  const sourceHash = createHash("sha256").update(input.buffer).digest("hex");
  const semanticHash = createHash("sha256").update(canonicalText, "utf8").digest("hex");

  return {
    ok: true,
    mode: "fingerprint",
    input: {
      path: filePath,
      byteCount: input.bytes,
      sourceFormat: normalized.sourceFormat,
      sourceVersion: normalized.sourceVersion
    },
    projectIdentity: {
      id: normalized.sourceIdentity.id,
      name: normalized.sourceIdentity.name,
      sourceIdAvailable: normalized.sourceIdentity.hasSourceId,
      note: normalized.legacy
        ? "Legacy projects have no source project ID; migration-generated IDs are not reported as source identity."
        : "Project identity fields are reported separately and are excluded from the semantic content fingerprint."
    },
    fingerprints: {
      sourceBytes: {
        algorithm: "sha256",
        hash: sourceHash
      },
      semanticContent: {
        algorithm: "sha256",
        canonicalVersion: SEMANTIC_CANONICAL_VERSION,
        hash: semanticHash
      }
    },
    semanticPolicy: {
      included: [
        "canvas width, height and background",
        "palette entries in exact order (HEX case normalized)",
        "layer order, names, visibility, lock flags and opacity",
        "frame order, names and duration",
        "cel presence and its layer/frame position",
        "every pixel value, including transparent nulls (HEX case normalized)"
      ],
      excluded: [
        "project ID and project name",
        "layer and frame IDs (cels use positional references in the projection)",
        "metadata, including timestamps",
        "selected palette index",
        "active layer and active frame selection",
        "unknown top-level extension fields not interpreted by project model v2"
      ],
      comparisonRule: "Only semantic fingerprints with the same canonicalVersion may be compared. Equal semantic hashes mean exact equality under this projection, not approximate visual similarity."
    },
    readOnly: {
      inputModified: false,
      outputWritten: false
    }
  };
}

function inspectOneFile(filePath, byteBudget = MAX_FILE_BYTES) {
  let input;
  try {
    input = readProjectFile(filePath, byteBudget);
  } catch (error) {
    return {
      ok: false,
      file: filePath,
      error: {
        code: error.code || "FILE_READ_ERROR",
        message: error.message || "Project fingerprint failed."
      },
      bytesRead: Number.isFinite(error.bytesRead) ? error.bytesRead : 0
    };
  }

  let decodedText;
  try {
    decodedText = new TextDecoder("utf-8", { fatal: true }).decode(input.buffer);
  } catch (error) {
    return {
      ok: false,
      file: filePath,
      bytesRead: input.bytes,
      error: { code: "INVALID_UTF8", message: "Project file is not valid UTF-8: " + error.message }
    };
  }

  let data;
  try {
    data = JSON.parse(decodedText.replace(/^\uFEFF/, ""));
  } catch (error) {
    return {
      ok: false,
      file: filePath,
      bytesRead: input.bytes,
      error: { code: "JSON_PARSE_ERROR", message: "Invalid JSON: " + error.message }
    };
  }

  try {
    const report = fingerprintProjectData(data, filePath, input);
    return { report, bytesRead: input.bytes };
  } catch (error) {
    return {
      ok: false,
      file: filePath,
      bytesRead: input.bytes,
      error: {
        code: error.code || "FINGERPRINT_FAILED",
        message: error.message || "Project fingerprint failed."
      }
    };
  }
}

function collectBatchFiles(inputPaths, recursive) {
  const files = [];
  const discoveryErrors = [];
  const warnings = [];
  const seenFiles = new Set();
  const seenDirectories = new Set();
  let visitedEntries = 0;
  let fatalLimit = false;

  function addFile(filePath) {
    const normalized = path.resolve(filePath);
    if (seenFiles.has(normalized)) {
      warnings.push({
        code: "DUPLICATE_PATH",
        path: normalized,
        message: "Duplicate input path was ignored."
      });
      return;
    }
    seenFiles.add(normalized);
    if (files.length >= MAX_BATCH_FILES) {
      discoveryErrors.push({
        path: normalized,
        code: "BATCH_FILE_LIMIT",
        message: "Batch input exceeds the " + MAX_BATCH_FILES + "-file limit; no partial batch was fingerprinted."
      });
      fatalLimit = true;
      return;
    }
    files.push(normalized);
  }

  function addError(filePath, code, message) {
    discoveryErrors.push({ path: filePath, code, message });
  }

  function visit(inputPath, depth) {
    if (fatalLimit) return;
    const normalized = path.resolve(inputPath);
    let stats;
    try {
      stats = fs.lstatSync(normalized);
    } catch (error) {
      addError(normalized, "PATH_ACCESS_ERROR", "Unable to inspect input path: " + error.message);
      return;
    }

    if (stats.isSymbolicLink()) {
      addError(normalized, "SYMLINK_NOT_FOLLOWED", "Symbolic links are not followed by the project fingerprint tool.");
      return;
    }
    if (stats.isFile()) {
      addFile(normalized);
      return;
    }
    if (!stats.isDirectory()) {
      addError(normalized, "UNSUPPORTED_PATH_TYPE", "Input path is neither a regular file nor a directory.");
      return;
    }
    if (seenDirectories.has(normalized)) return;
    seenDirectories.add(normalized);

    if (depth > MAX_BATCH_DIRECTORY_DEPTH) {
      addError(normalized, "BATCH_DIRECTORY_DEPTH_LIMIT", "Directory traversal exceeded " + MAX_BATCH_DIRECTORY_DEPTH + " levels.");
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(normalized).sort(lexicalCompare);
    } catch (error) {
      addError(normalized, "DIRECTORY_READ_ERROR", "Unable to read directory: " + error.message);
      return;
    }

    for (const entry of entries) {
      if (fatalLimit) break;
      visitedEntries += 1;
      const child = path.join(normalized, entry);
      if (visitedEntries > MAX_BATCH_DIRECTORY_ENTRIES) {
        addError(child, "BATCH_DIRECTORY_ENTRY_LIMIT", "Directory traversal exceeded " + MAX_BATCH_DIRECTORY_ENTRIES + " entries.");
        fatalLimit = true;
        break;
      }

      let childStats;
      try {
        childStats = fs.lstatSync(child);
      } catch (error) {
        addError(child, "PATH_ACCESS_ERROR", "Unable to inspect directory entry: " + error.message);
        continue;
      }

      if (childStats.isSymbolicLink()) {
        addError(child, "SYMLINK_NOT_FOLLOWED", "Symbolic links are not followed by the project fingerprint tool.");
      } else if (childStats.isFile()) {
        addFile(child);
      } else if (childStats.isDirectory() && recursive) {
        visit(child, depth + 1);
      }
    }
  }

  for (const inputPath of inputPaths) {
    visit(inputPath, 0);
    if (fatalLimit) break;
  }

  files.sort(lexicalCompare);
  discoveryErrors.sort((left, right) =>
    lexicalCompare(left.path, right.path) || lexicalCompare(left.code, right.code)
  );
  warnings.sort((left, right) =>
    lexicalCompare(left.path, right.path) || lexicalCompare(left.code, right.code)
  );
  return { files, discoveryErrors, warnings, fatalLimit };
}

function collectDuplicateGroups(results, fingerprintPath) {
  const groups = new Map();
  for (const item of results) {
    if (!item.ok) continue;
    const key = fingerprintPath(item);
    const paths = groups.get(key) || [];
    paths.push(item.file);
    groups.set(key, paths);
  }
  return Array.from(groups.entries())
    .filter(([, paths]) => paths.length > 1)
    .map(([fingerprint, paths]) => ({ fingerprint, paths: paths.sort(lexicalCompare) }))
    .sort((left, right) => lexicalCompare(left.fingerprint, right.fingerprint));
}

function inspectBatch(inputPaths, recursive) {
  const collected = collectBatchFiles(inputPaths, recursive);
  const files = [];
  let totalBytesRead = 0;

  for (const filePath of collected.files) {
    const remaining = MAX_BATCH_TOTAL_BYTES - totalBytesRead;
    if (remaining <= 0) {
      files.push({
        ok: false,
        file: filePath,
        error: {
          code: "BATCH_TOTAL_SIZE_LIMIT",
          message: "Batch input exceeds the " + MAX_BATCH_TOTAL_BYTES + "-byte aggregate read limit."
        },
        bytesRead: 0
      });
      continue;
    }
    const inspected = inspectOneFile(filePath, remaining);
    totalBytesRead += inspected.bytesRead || 0;
    files.push({
      file: filePath,
      ok: Boolean(inspected.report ? inspected.report.ok : inspected.ok),
      ...(inspected.report ? { report: inspected.report } : { error: inspected.error })
    });
  }

  const successful = files.filter((item) => item.ok).map((item) => ({
    file: item.file,
    fingerprints: item.report.fingerprints
  }));
  const byteDuplicates = collectDuplicateGroups(
    successful,
    (item) => item.fingerprints.sourceBytes.hash
  );
  const semanticDuplicates = collectDuplicateGroups(
    successful,
    (item) => "v" + item.fingerprints.semanticContent.canonicalVersion + ":" + item.fingerprints.semanticContent.hash
  );

  const summary = {
    discoveredFiles: collected.files.length,
    fingerprintedFiles: successful.length,
    failedFiles: files.length - successful.length,
    discoveryErrors: collected.discoveryErrors.length,
    warnings: collected.warnings.length,
    bytesRead: totalBytesRead,
    byteIdenticalGroups: byteDuplicates.length,
    semanticDuplicateGroups: semanticDuplicates.length
  };

  return {
    ok: summary.failedFiles === 0 && summary.discoveryErrors === 0 && !collected.fatalLimit,
    mode: "batch",
    recursive,
    limits: {
      maxFiles: MAX_BATCH_FILES,
      maxTotalBytes: MAX_BATCH_TOTAL_BYTES,
      maxFileBytes: MAX_FILE_BYTES,
      maxDirectoryEntries: MAX_BATCH_DIRECTORY_ENTRIES,
      maxDirectoryDepth: MAX_BATCH_DIRECTORY_DEPTH
    },
    files,
    discoveryErrors: collected.discoveryErrors,
    warnings: collected.warnings,
    duplicateGroups: {
      byteIdentical: byteDuplicates,
      semanticContentEquivalent: semanticDuplicates
    },
    summary,
    semanticCanonicalVersion: SEMANTIC_CANONICAL_VERSION,
    readOnly: {
      inputsModified: false,
      outputsWritten: false
    }
  };
}

function renderHumanFingerprint(report) {
  if (!report.ok) {
    return [
      "Project Fingerprint",
      "Status: INVALID",
      "File: " + report.file,
      "Error [" + report.error.code + "]: " + report.error.message
    ].join("\n");
  }
  return [
    "Project Fingerprint",
    "Status: COMPLETE",
    "File: " + report.input.path,
    "Source bytes: " + report.input.byteCount,
    "Source format: " + report.input.sourceFormat + " (v" + report.input.sourceVersion + ")",
    "Project: " + (report.projectIdentity.name || "(unnamed)"),
    "Source project ID: " + (report.projectIdentity.id || "not present in source"),
    "Source-byte SHA-256: " + report.fingerprints.sourceBytes.hash,
    "Semantic fingerprint v" + report.fingerprints.semanticContent.canonicalVersion + ": " +
      report.fingerprints.semanticContent.hash,
    "Source modified: no"
  ].join("\n");
}

function renderHumanBatch(report) {
  const lines = [
    "Project Fingerprint — Batch",
    "Status: " + (report.ok ? "COMPLETE" : "COMPLETED WITH ERRORS"),
    "Discovered: " + report.summary.discoveredFiles,
    "Fingerprinted: " + report.summary.fingerprintedFiles,
    "Failed: " + report.summary.failedFiles,
    "Discovery errors: " + report.summary.discoveryErrors,
    "Bytes read: " + report.summary.bytesRead,
    "Byte-identical groups: " + report.summary.byteIdenticalGroups,
    "Semantic content-equivalent groups: " + report.summary.semanticDuplicateGroups
  ];
  for (const item of report.files) {
    if (item.ok) {
      lines.push("OK " + item.file + " — " + item.report.fingerprints.semanticContent.hash);
    } else {
      lines.push("ERROR " + item.file + " [" + item.error.code + "] " + item.error.message);
    }
  }
  for (const error of report.discoveryErrors) {
    lines.push("DISCOVERY ERROR " + error.path + " [" + error.code + "] " + error.message);
  }
  for (const warning of report.warnings) {
    lines.push("WARNING " + warning.path + " [" + warning.code + "] " + warning.message);
  }
  return lines.join("\n");
}

function emitFailure(filePath, jsonMode, error) {
  const failure = {
    ok: false,
    file: filePath,
    error: {
      code: error.code || "FINGERPRINT_FAILED",
      message: error.message || "Project fingerprint failed."
    }
  };
  if (jsonMode) {
    process.stdout.write(JSON.stringify(failure, null, 2) + "\n");
  } else {
    process.stderr.write([
      "Project Fingerprint",
      "Status: INVALID",
      "File: " + (filePath || "(not supplied)"),
      "Error [" + failure.error.code + "]: " + failure.error.message
    ].join("\n") + "\n");
  }
  process.exitCode = error.exitCode || 1;
}

function main(argv) {
  const args = parseArguments(argv);
  if (args.help) {
    process.stdout.write(usage() + "\n");
    return;
  }
  if (args.error) {
    emitFailure(args.filePath, args.json, args.error);
    return;
  }
  if (args.batch) {
    const report = inspectBatch(args.inputPaths, args.recursive);
    if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    else process.stdout.write(renderHumanBatch(report) + "\n");
    if (!report.ok) process.exitCode = 1;
    return;
  }

  const inspected = inspectOneFile(args.filePath);
  if (inspected.report) {
    if (args.json) process.stdout.write(JSON.stringify(inspected.report, null, 2) + "\n");
    else process.stdout.write(renderHumanFingerprint(inspected.report) + "\n");
  } else {
    const error = fingerprintError(inspected.error.code, inspected.error.message);
    emitFailure(args.filePath, args.json, error);
  }
}

main(process.argv.slice(2));
