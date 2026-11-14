# Status — Agent 4

- **Task:** AC-004 — Reconcile and revalidate bridge/API hardening PR #8.
- **Status:** REVIEW — branch reconciled with latest main, combined browser/MCP E2E revalidated, latest CI green; coordinator review/acceptance pending.
- **Feature branch:** `agent/bridge-hardening`
- **Feature head:** `239d746d61c3af4f49bba84a3debb7c3f1bfceac`
- **Latest main at final sync:** `65f989757131b9db6756a41d1b8a6f65196e91ef`
- **Latest sync:** normal non-force two-parent merge commit `239d746d61c3af4f49bba84a3debb7c3f1bfceac`, with previous feature head `8cce39fa6bfa0b160c4e3ec2037fbc495c1c0364` and latest main `65f989757131b9db6756a41d1b8a6f65196e91ef` as parents. Earlier main advances were also merged with non-force commits. No commits were discarded and no force-push was used.
- **Branch comparison:** 31 commits ahead, 0 behind main; merge base is `65f989757131b9db6756a41d1b8a6f65196e91ef`.
- **PR:** [#8 — AC-004: Harden the Art Club MCP bridge and Agent API](https://github.com/faiev/ArtClub/pull/8) — open, draft, unmerged; GitHub reports mergeable / clean.
- **Changed application files (8):** `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/package.json`, `agent-bridge/server.mjs`, bridge-related `index.html` lines, `js/agent-api.js`, and `tests/agent-api.test.js`. No project-persistence or renderer files were changed by Agent 4.

## E2E reconciliation

- `agent-bridge/e2e-test.mjs` now matches latest main. It preserves PR #10's A/B/no-op-save/Recover regression workflow and frame-aware pixel checks.
- The correct frame is selected **after reload** for per-frame pixel assertions. The earlier PR #8 pre-save frame-reselection workaround was not retained because it prevented a meaningful check of selected-frame restoration.
- PR #8 bridge/API-specific test coverage remains in `agent-bridge/mcp-e2e-test.mjs`, including revision-required schemas, missing/stale revision rejection, structured handler errors, concurrent-write rejection, invalid URL startup validation and tool behavior.

## Implementation

- Made `expected_revision` required for all 37 document-changing MCP tools and verify it in the editor immediately before invoking the API.
- Serialize requests within one bridge process and reject stale writes. There is no distributed lock across separate bridge processes.
- Added structured MCP success envelopes and structured tool-handler errors.
- Added editor-page close/crash/navigation detection and reconnect behavior; uncertain in-flight edits are not blindly retried.
- Validate `ARTCLUB_URL`: HTTPS is required except for loopback development URLs; embedded credentials are rejected.
- Forward revision options through browser API undo/redo and guard project import/open across asynchronous storage work.
- Document compatibility changes, single-writer use, lifecycle, security, timeout limitation and future encoder extension point.

## Test evidence

**GitHub Actions run #173:** [all jobs passed](https://github.com/faiev/ArtClub/actions/runs/43607096727) on exact PR head `239d746d61c3af4f49bba84a3debb7c3f1bfceac`.

- `node --test tests/*.test.js` — **61 passed, 0 failed**.
- `node --check agent-bridge/server.mjs` — passed.
- `npm run test:e2e` — passed in Chromium, including IndexedDB recovery and frame-aware persistence.
- `npm run test:mcp` — passed with the actual MCP client, including structured reads/errors, revision-guarded writes, concurrency rejection, layers, selections, animation, export/import, PNG and input validation.
- Dependency installation reported **0 vulnerabilities**.

## Remaining risks / unverified cases

- There is no hard per-operation timeout or cancellation for a hung `page.evaluate`; a stuck evaluation can hold the serialized queue.
- The operation queue is per bridge process, not a distributed lock. Multiple bridge processes against one persistent browser profile do not coordinate writes.
- If the browser disconnects during a mutation, its outcome can be uncertain; clients must read status before retrying.
- A deliberate forced-crash/reconnect scenario remains outside automated browser E2E coverage.
- MCP SDK input-schema validation errors may retain the SDK's own response shape; handler failures use the structured error envelope.

## Handoff

Coordinator: review PR #8 and run #173 evidence. PR remains draft and has not been merged. Agent 4 does not self-accept or merge. AC-008 remains queued until AC-004 is reviewed/accepted.