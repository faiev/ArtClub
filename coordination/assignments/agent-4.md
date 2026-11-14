# Agent 4 — Agent bridge / MCP

## AC-004 — Reconcile and revalidate bridge/API hardening PR #8

Your implementation is submitted:
https://github.com/faiev/ArtClub/pull/8

Feature branch: `agent/bridge-hardening`
Submitted head: `9d21f0c9ca87cd0044de36c48a646e411482ed3e`

The original CI run #104 passed, but that run predates the recovery fix merge and your branch is now behind main. GitHub currently reports PR #8 not mergeable.

### Required work

1. Fetch latest main. The recovery fix from PR #10 is now on main, followed by the Canvas prototype merge from PR #6.
2. Merge latest main into `agent/bridge-hardening` using a normal non-force merge. Preserve all existing commits.
3. Reconcile the shared `agent-bridge/e2e-test.mjs` changes carefully:
   - Preserve PR #10's recovery workflow and frame-aware assertion.
   - Preserve PR #8's bridge/API-specific E2E coverage.
   - Avoid duplicating or weakening assertions.
4. You are the sole worker authorized to edit `agent-bridge/e2e-test.mjs` during this task. Agent 1's PR #1 review is read-only. No other agent may edit this file.
5. Run and report exact results on the updated HEAD:
   - `node --test tests/*.test.js`
   - `node --check agent-bridge/server.mjs`
   - `npm run test:e2e` in Chromium
   - `npm run test:mcp` with the actual MCP client
6. Update PR #8 description with new head SHA, integration details and latest CI link.

### Keep explicit limitations

- The single-writer queue is per bridge process, not cross-process.
- There is no hard operation timeout/cancellation for a hung page evaluation.
- Browser disconnect during mutation can leave the outcome uncertain; clients must read status before retrying.
- A forced-crash/reconnect E2E scenario remains untested unless you add one safely within your assigned scope.

### File scope

Keep the original AC-004 files only:
`AGENT_API.md`, `agent-bridge/*`, `js/agent-api.js`, `tests/agent-api.test.js`, and bridge-related `index.html` lines.

Do not edit persistence or renderer files. Do not edit coordinator-owned files.

### Handoff

Update only `coordination/status/agent-4.md` with the new branch head, exact checks and risks. Do not merge PR #8 or claim collaboration across separate bridge processes.