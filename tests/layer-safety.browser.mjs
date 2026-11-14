#!/usr/bin/env node
"use strict";

const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { access } = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

async function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (_) {
      // Try the next known location.
    }
  }
  throw new Error(
    "Chromium was not found. Set CHROMIUM_PATH to a Chromium/Chrome executable."
  );
}

function extractResult(dom) {
  const match = dom.match(
    /<pre id="test-result" data-status="(passed|failed)">([\s\S]*?)<\/pre>/
  );
  if (!match) {
    throw new Error("Chromium did not return the layer safety result element.");
  }
  const status = match[1];
  const payload = match[2]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return { status, result: JSON.parse(payload) };
}

async function main() {
  const chromium = await findChromium();
  const htmlPath = path.join(scriptDirectory, "layer-safety.browser.html");
  const url = pathToFileURL(htmlPath).href;
  const { stdout, stderr } = await execFileAsync(chromium, [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--dump-dom",
    "--virtual-time-budget=1000",
    url
  ], { timeout: 45000, maxBuffer: 5 * 1024 * 1024 });

  const { status, result } = extractResult(stdout);
  if (stderr.trim()) process.stderr.write(stderr);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  if (status !== "passed" || result.ok !== true || result.failed !== 0) {
    process.exitCode = 1;
  } else {
    process.stdout.write("Layer safety browser harness passed.\n");
  }
}

export { extractResult };

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
