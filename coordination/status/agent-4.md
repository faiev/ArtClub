# Status — Agent 4

- **Task:** AC-004 — Finalize and submit the MCP bridge / browser Agent API hardening.
- **Status:** REVIEW — implementation committed, draft PR opened, required CI test layers passed; coordinator review/acceptance pending.
- **Feature branch:** `agent/bridge-hardening`
- **Base at dispatch:** `fe66725f7d010beca7ca60f497778d419e753d7b` (latest `main` at the time of branch reconciliation).
- **Branch update:** merged current main into the existing feature history with non-force merge commit `3ca49c5387276aeb2716828e97df1139b9b5f8a0`. No commits were discarded and no force-push was used.
- **Feature head:** `9d21f0c9ca87cd0044de36c48a646e411482ed3e`.
- **Branch comparison:** 22 commits ahead, 0 behind `main`; merge base is current main `fe66725f7d010beca7ca60f497778d419e753d7b`.
- **PR:** [#8 — AC-004: Harden the Art Club MCP bridge and Agent API](https://github.com/faiev/ArtClub/pull/8) — open, draft, GitHub reports mergeable.
- **Changed files (9):** `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/e2e-test.mjs`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/package.json`, `agent-bridge/server.mjs`, bridge-related API lines in `index.html`, `js/agent-api.js`, and new `tests/agent-api.test.js`. No renderer or project-persistence files were edited.

## Implementation

- Made `expected_revision` required for all 37 document-changing MCP tools and validate it immediately before the editor API call.
- Serialized requests within one bridge process and reject stale writes; there is no distributed lock across separate bridge processes.
- Added structured MCP success envelopes and structured tool-handler errors.
- Added editor-page close/crash/navigation detection and reconnect behavior; uncertain in-flight edits are not blindly retried.
- Added `ARTCLUB_URL` validation (HTTPS, localhost-only HTTP development URLs, no embedded credentials).
- Forwarded revision options through browser API undo/redo and added revision checks around async project import/open.
- Documented compatibility changes, single-writer use, lifecycle, security, known timeout limitation and future standalone GIF/sprite-sheet encoder integration.

## Test evidence

**GitHub Actions run 104:** [all jobs passed](https://github.com/faiev/ArtClub/actions/runs/43602878450), head `9d21f0c9ca87cd0044de36c48a646e411482ed3e).

- Root unit/model/editor tests: `node --test tests/*.test.js` — **38 passed, 0 failed**.
- Bridge syntax: `node --check agent-bridge/server.mjs` — **passed**.
- Chromium browser E2E: `npm run test:e2e` — **passed**, including mouse editing, layers, frame playback/onion skin, PNG and IndexedDB reload persistence.
- Actual MCP client E2E: `npm run test:mcp` — **passed**, including 52-tool inventory, required revision schemas, missing/stale revision rejection, structured errors, same-revision concurrent writes, invalid URL startup rejection, layer/selection/frame operations, project import/export and PNG.
- Focused local Node 22.16.0 run: `node --test tests/agent-api.test.js` — **3 passed, 0 failed**.

The first CI attempt (run 102) had 38/38 unit tests pass but failed the browser reload assertion: the test saved while frame 2 was selected and then asserted that frame 1 pixels had been restored. Updated `agent-bridge/e2e-test.mjs` to reselect the original frame before saving; full run 104 then passed, including MCP E2E.

## Remaining risks / unverified cases

- No hard per-operation timeout or cancellation exists for a hung `page.evaluate`; a stuck call can hold the serialized queue.
- The operation queue is per bridge process. Do not run multiple bridge processes against one persistent browser profile; independent processes do not coordinate writes.
- If the browser disconnects mid-mutation, the result can be uncertain. Clients must read status before retrying.
- Page recovery is implemented and source-reviewed, but a deliberate forced-crash/reconnect scenario is not yet included in automated browser E2E coverage.
- Input-schema validation errors may retain the MCP SDK's own response shape; handler failures use the new structured error envelope.

## Handoff

Coordinator: review PR #8 and its passing run 104 evidence. The PR remains a draft and has not been merged. Agent 4 does not self-accept or merge.