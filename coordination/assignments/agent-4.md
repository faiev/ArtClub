# Agent 4 — Agent API / MCP bridge / local automation

## Continuous workstream: make the optional local agent bridge reliable, safe and extensible

You own the local Agent API/MCP bridge. This is a multi-phase engineering program, not just PR #8. After each coherent PR, keep working on the next authorized bridge phase; do not wait for the coordinator.

### Phase 0 — AC-004: Reconcile PR #8
PR #8: https://github.com/faiev/ArtClub/pull/8
Sync agent/bridge-hardening with latest main without force-pushing. Reconcile the shared browser E2E changes while preserving PR #10's recovery/frame-selection coverage and PR #8's bridge-specific assertions. You are the sole writer of agent-bridge/e2e-test.mjs during this reconciliation. Run Node 24 unit suite, bridge syntax, Chromium E2E and actual MCP-client E2E. Update PR and status with exact head/CI.

### Phase 1 — AC-043: Operation deadlines, cancellation and queue isolation
Design and implement bounded request execution:
- per-tool deadline and bounded input/output size;
- client disconnect/cancellation behavior;
- a timed-out request must not allow a later mutation to execute out of order;
- queue failures must not permanently poison subsequent requests;
- structured timeout/cancel errors with request IDs;
- shutdown drains or cancels pending work safely.
Test timeout, cancellation, queue recovery and uncertain in-flight mutation semantics. Do not claim rollback if a browser mutation may already have occurred.

### Phase 2 — AC-044: Cross-process single-writer protection
The current mutation queue is per process. Evaluate and implement a robust local-profile lock so two bridge processes cannot silently mutate the same browser profile concurrently. Prefer an atomic OS-level lock/lock-directory strategy with stale-owner detection and clear recovery; document platform limitations. Test competing child processes, stale lock handling, graceful release and crash leftovers. If a safe cross-platform lock cannot be guaranteed, keep explicit refusal/diagnostics rather than claiming support.

### Phase 3 — AC-045: MCP/API security and input hardening
Audit all tools for schema validation, untrusted strings, URL validation, payload sizes, path handling, error leakage, startup/shutdown and browser-profile exposure. Add negative tests for oversized batches, malformed project payloads, invalid frame/layer IDs, unsupported origins and unexpected object shapes. Keep local-only operation; do not add cloud services or secrets.

### Phase 4 — AC-046: Contract and capability discovery
Define a machine-readable capability/version document for clients:
- protocol version and compatibility;
- read-only versus mutating tools;
- revision requirements and conflict behavior;
- max canvas/project/batch sizes;
- timeout/cancellation behavior;
- export and diagnostic feature availability.
Add a stable tools/capabilities result, fixtures and docs. Ensure old clients receive actionable compatibility errors.

### Phase 5 — AC-047: Export and pixel-tool API adapters
After exporter/pixel modules are available on main, add thin Agent API/MCP adapters that call the shared modules rather than duplicating algorithms. Cover palette import/export, sprite-sheet/GIF export, tile preview diagnostics and safe pixel-effects previews as appropriate. Do not expose destructive tools without revision checks, bounded payloads and explicit read/write semantics. Coordinate with Agents 3, 6–10 and obtain the coordinator's shared-file lock before touching index.html.

### Phase 6 — AC-048: Recovery, resilience and observability
Add deliberate browser crash/navigation/disconnect tests, reconnect state reporting, queue metrics, request IDs and redacted diagnostics. Make lifecycle cleanup deterministic. Document remaining ambiguous outcomes and operator recovery steps.

## Ownership
AGENT_API.md, agent-bridge/*, js/agent-api.js and bridge-related index.html code. You alone own agent-bridge/e2e-test.mjs for AC-004. Do not edit project storage, Canvas renderer, exporter implementation, palette modules or project model. Request the UI/API lock before any shared index.html integration.

## Working rules
All phases are authorized. PR #8 can be under review while phases 1–3 proceed on isolated bridge files/branches. If a phase needs an unavailable feature module, build schemas/adapters/tests against a documented interface or continue security/resilience work.

## Handoff
Update only coordination/status/agent-4.md with phase, branch/head, PRs, checks, security findings, unresolved concurrency guarantees and next 3–5 actions. Do not merge or self-accept.

## Coordinator-added extension — AC-090: Local bridge doctor and diagnostics

After AC-048, build a read-only diagnostic command that helps users understand whether the optional local MCP bridge can start and communicate safely.

### Deliverable
- Add `agent-bridge/doctor.mjs` (or an equivalently scoped executable) with human and stable JSON output.
- Check supported Node version, required package availability, configured editor URL policy, browser automation executable availability, profile directory accessibility and profile-lock state.
- Distinguish pass, warning, fail and unknown. Never reveal environment secrets, credentials, full sensitive paths or browser profile contents.
- Read stale lock metadata but never automatically reclaim or delete a lock; direct the user to the documented explicit recovery operation.
- Do not start/stop the bridge, launch a browser, change environment variables, install packages, contact a remote service or mutate project data.
- Add tests for missing configuration, invalid URLs, unsupported runtimes, missing browser executables, inaccessible profiles, active/stale/malformed locks and redaction.
- Document exit codes and troubleshooting. Ensure diagnostics work offline.

**Allowed files:** `agent-bridge/doctor.mjs`, focused bridge doctor tests and `agent-bridge/README.md` / `AGENT_API.md` diagnostics sections. Do not change shared bridge E2E without the existing lock, index.html, editor storage, workflow or exporter code.
