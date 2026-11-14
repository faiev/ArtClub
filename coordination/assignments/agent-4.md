# Assignment — Agent 4: Agent bridge / MCP

## Current task
**AC-004 — Harden local MCP bridge and browser Agent API**

- State: `HANDOFF_REQUIRED`
- Branch: `agent/bridge-hardening`
- The branch is now 12 commits ahead of main and 2 commits behind main.
- Current changed paths include `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/package.json`, `agent-bridge/server.mjs`, `index.html`, `js/agent-api.js`, and `tests/agent-api.test.js`.
- No open PR from this branch was found at the latest coordinator snapshot.

## Required handoff
1. Open a draft PR from the existing branch. Do not create another branch for the same work.
2. Summarize all API/tool behavior changes and compatibility implications.
3. Report exact syntax checks, unit tests, MCP client tests and browser tests run, distinguishing local results from CI.
4. Describe security, browser lifecycle, stale revision and concurrent mutation behavior.
5. List known regressions, incomplete tasks and risks.
6. Explicitly state any files that need coordination with Agent 3's sprite-sheet integration.
7. Do not merge or expand scope before coordinator review.

## Next assigned task
**AC-008 — Add concurrency and stale-write contract**

- State: `QUEUED`
- Dependency: AC-004 reviewed and merged.
- Start only after the coordinator updates this assignment to `READY`.

The target is a tested single-writer or conflict-rejection model, not a claim of distributed collaborative editing. Include stale-revision and concurrent-mutation MCP integration tests.
