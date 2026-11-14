# Agent 4 — Agent bridge / MCP

## READY — AC-004: Finalize and submit the bridge/API hardening work

You have an existing implementation branch. The next deliverable is a reviewable, evidence-backed PR. Do not wait for PR #5 or other worker PRs.

### Existing work
- Branch: `agent/bridge-hardening`
- Current diff includes `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/package.json`, `agent-bridge/server.mjs`, `index.html`, `js/agent-api.js`, and `tests/agent-api.test.js`.
- No PR from this branch was visible in the latest coordinator snapshot.
- The branch is behind current main. Update it against latest main without losing commits; never force-push.

### Work
1. Reconcile your branch with current main and inspect the full diff.
2. Open a draft PR from the existing branch.
3. Explain all public API/MCP tool behavior changes and compatibility implications.
4. Run unit, syntax, Chromium browser and actual MCP-client tests. Report exact commands and results. If a test cannot run, identify the environment limitation and leave it marked unverified.
5. Audit invalid input, structured errors, browser startup/teardown, timeouts, disconnect/reconnect and cleanup.
6. Verify stale revision handling: stale mutations must fail clearly and must not silently overwrite newer state. Add tests if missing.
7. Document whether the current bridge is single-writer. Do not claim simultaneous multi-agent editing.
8. Identify how future sprite-sheet and GIF export operations should be exposed without duplicating core logic.

### File scope
`AGENT_API.md`, `agent-bridge/*`, `js/agent-api.js`, `tests/agent-api.test.js`, and the bridge-related lines in `index.html`. Do not edit persistence files, renderer or export modules.

### Acceptance criteria
- Reviewable PR contains the full intended work.
- CI/test evidence is explicit.
- Stale-revision and invalid-input behavior are documented and tested.
- No unrelated UI or storage changes are included.

### Handoff
Update the PR and only `coordination/status/agent-4.md`. AC-008 will be assigned after this contract is reviewed.
