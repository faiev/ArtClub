# Project lifecycle browser harness

This harness is independent of `agent-bridge/e2e-test.mjs`. It opens the production editor inside an isolated iframe on a local static server and drives it with real Chromium and the browser's IndexedDB implementation.

## Prerequisites

- Node.js 20 or newer.
- Install the existing Playwright dependency in `agent-bridge`.
- Install the Playwright Chromium browser.

## Run locally

From the repository root:

```bash
cd agent-bridge
npm install --ignore-scripts
npx playwright install chromium
cd ..
node tests/qa/browser/project-lifecycle.mjs
```

The runner starts a loopback-only static server, creates a fresh browser context, and validates project creation, layer/frame edits, switching between two projects, reload persistence, active layer/frame restoration, cel isolation and the Project Library Recover workflow. It captures browser page errors and console errors and fails if either list is non-empty.

## CI integration note

The current workflow's `browser-e2e` job already installs the `agent-bridge` dependencies and Chromium. A coordinator/workflow owner can add this command as a separate step after browser installation:

```yaml
- name: Run standalone project lifecycle QA
  run: node tests/qa/browser/project-lifecycle.mjs
```

Run it from the repository root. This PR does not edit `.github/workflows/project-tests.yml` or the shared bridge E2E file; both remain outside Agent 1's ownership.

## Evidence boundaries

This is a real-browser test against Chromium IndexedDB, not an IndexedDB test double. It validates the current lifecycle behavior but does not replace the separate agent-bridge, MCP, model-unit or exporter tests. The runner has not been executed in this development environment because GitHub repository download/clone access is unavailable here; report a pass only from a later local run or CI job that explicitly invokes this exact script.
