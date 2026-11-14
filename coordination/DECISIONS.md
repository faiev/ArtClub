# Art Club coordination decisions

This is the cross-agent decision log. The coordinator owns it. Workers should read it before changing shared contracts.

## D-001 — Keep the current static, local-first deployment
- The app remains hostable as a static GitHub Pages site.
- Do not add a mandatory backend, paid service, login, account, API key, or phone-number verification for normal editor use.
- The optional local MCP bridge may use local dependencies, but core editor functionality must continue to work without it.

## D-002 — Use plain JavaScript
- Do not introduce TypeScript.
- Keep modules browser-compatible and avoid adding build tooling unless there is a concrete, approved reason.

## D-003 — GitHub is shared coordination memory, not an agent runtime
- The coordination files are the source of truth for assignments, status, dependencies and decisions.
- ChatGPT chats do not automatically wake up or monitor GitHub files. The user/coordinator sends the resume prompt.
- Do not claim automatic agent-to-agent messaging or background execution.

## D-004 — Branch and PR policy
- Application code must be committed on a dedicated feature branch.
- Never push application code directly to `main`.
- Every code task must have a PR, test evidence and handoff summary.
- Workers do not merge their own PRs.
- Coordination metadata may be written only to the active coordination source: during bootstrap, workers update only their own `coordination/status/agent-N.md` on `coordination/orchestration-v1`; after PR #5 merges, workers update only their own status file on `main`. The coordinator alone changes board, backlog, decisions and assignments.

## D-005 — Single-writer ownership for shared files
- One agent at a time may change shared UI/API/bridge files.
- Agent 4 currently owns the bridge/API/shared UI changes already present in `agent/bridge-hardening`.
- Agent 3's sprite-sheet exporter remains isolated until its review and subsequent integration assignment.
- If work requires a file owned by another agent, pause and request a handoff instead of editing around it.

## D-006 — Pixel fidelity
- Pixel artwork must preserve exact integer pixel boundaries and colors.
- Do not introduce smoothing or interpolation into drawing, transforms, sprite sheets, or exports.
- UI overlays such as selection marquees and onion skin must not become part of exported artwork unless explicitly requested.

## D-007 — No unsupported completion claims
- Distinguish code committed, PR opened, CI passed, PR merged, and feature integrated.
- A unit test with a canvas mock does not replace browser export verification.
- A branch with no commits is not a delivered implementation.
- A report is not accepted until the coordinator reviews its evidence.
