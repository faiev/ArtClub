# Art Club coordination board

Last coordinator snapshot: 2026-11-14  
Repository: [faiev/ArtClub](https://github.com/faiev/ArtClub)  
Default branch: `main`  
Snapshot base commit: `b5beddb49e27d8520f4c0b5133942b1237ea39e1`

> This board records repository evidence, not unverified statements from private chat windows. Worker status files contain their latest handoffs. The coordinator alone changes this board.

## Current agent state

| Agent | Role | Current branch / main state | Current deliverable | Coordination state |
|---|---|---|---|---|
| 1 | QA / release | `agent/qa-release`: 3 commits ahead, 2 behind | [Draft PR #1](https://github.com/faiev/ArtClub/pull/1), frame-aware persistence E2E correction | `REVIEW` — PR reports 35 unit/editor tests, Chromium E2E and MCP E2E passed; coordinator must verify checks |
| 2 | Rendering / performance | `agent/canvas-renderer`: 2 commits ahead, 2 behind | `js/canvas-renderer.js` and `tests/canvas-renderer.test.js` committed; no PR found | `HANDOFF_REQUIRED` — prototype is present; benchmark evidence and PR summary are still missing |
| 3 | Animation / export | `agent/animation-export`: 3 commits ahead, 2 behind | [Draft PR #3](https://github.com/faiev/ArtClub/pull/3), sprite-sheet PNG + metadata module | `REVIEW` — PR reports 10 exporter tests passing; full repository/browser CI not reported |
| 4 | Agent bridge / MCP | `agent/bridge-hardening`: 12 commits ahead, 2 behind | API, bridge, MCP E2E, test and shared UI changes; no open PR found | `HANDOFF_REQUIRED` — submit the existing branch as a PR and attach exact validation results |
| 5 | UX / product | `UX_AUDIT.md` is now on `main`; `agent/ux-audit` is 1 commit behind | [UX_AUDIT.md](../UX_AUDIT.md), 540 lines | `REVIEW` — audit is available in main but has not been accepted by coordinator |

The current main branch is two commits ahead of the original worker base (`c7ff0702c27cba22e443f9012fc482c217363613`), including the UX audit. Worker branches based on the older SHA are now behind main. Rebase/update them only when their PR is reviewed; do not blindly merge stale branches.

Branch state is based on GitHub comparisons made for this snapshot. The absence of a PR does not prove an agent did no work; it means that work is not yet available through normal PR review.

## Current file ownership / collision avoidance

| Paths | Owner until handoff is reviewed |
|---|---|
| `agent-bridge/*`, `js/agent-api.js`, `AGENT_API.md`, `tests/agent-api.test.js`, `index.html` changes related to bridge wiring | Agent 4 — finish and submit its existing branch first |
| `js/sprite-sheet-export.js`, `tests/sprite-sheet-export.test.js`, `ANIMATION_EXPORT.md` | Agent 3 |
| `agent-bridge/e2e-test.mjs` | Agent 1 |
| `UX_AUDIT.md` | Already on main; coordinator review |
| `js/canvas-renderer.js`, `tests/canvas-renderer.test.js` | Agent 2 |
| `coordination/BOARD.md`, `BACKLOG.md`, `DECISIONS.md`, `assignments/*` | Coordinator only |
| `coordination/status/agent-N.md` | Only the matching agent |

**Shared UI/API rule:** Do not allow Agent 3 and Agent 4 to change `index.html`, `js/agent-api.js`, or `agent-bridge/*` concurrently. Agent 4's current bridge PR must be reviewed first; then the coordinator can assign Agent 3 the export UI/API integration against the accepted interface.

## Active tasks

| Task | Owner | State | Next action |
|---|---|---|---|
| AC-001 — Correct frame-aware persistence E2E checks | Agent 1 | `REVIEW` | Review PR #1 and CI; update its base as needed, then merge only after checks pass |
| AC-002 — Build sprite-sheet PNG and timing metadata exporter | Agent 3 | `REVIEW` | Review PR #3 and run required repository/browser checks |
| AC-003 — Canvas performance audit and prototype | Agent 2 | `HANDOFF_REQUIRED` | Prototype/tests now exist; publish benchmark evidence and a PR with test results |
| AC-004 — Harden local MCP bridge and browser agent API | Agent 4 | `HANDOFF_REQUIRED` | Open a PR from the existing 12-commit branch with scope, behavior changes, tests and risks |
| AC-005 — UX/product audit | Agent 5 | `REVIEW` | Review the report now present on main; accept or return it with specific findings |

## Dependencies

1. AC-001 PR #1 review precedes the new recovery-snapshot fix (AC-006).
2. AC-004 must be submitted and reviewed before any other worker edits the bridge/API/shared UI files.
3. AC-002 PR #3 review precedes export UI integration (AC-007).
4. AC-007 depends on AC-004 being integrated or its API/MCP contract being explicitly accepted.
5. AC-005 must be accepted before the UX worker is assigned implementation planning from its findings.

## Definition of done

A task is not `DONE` until the coordinator has:
- Reviewed the diff and confirmed scope stayed within assignment.
- Checked acceptance criteria and actual test evidence.
- Confirmed required CI checks pass.
- Resolved or explicitly accepted risks.
- Merged the PR or accepted a non-code report.
- Updated this board and the relevant assignment.

See [README.md](README.md), [BACKLOG.md](BACKLOG.md), and [DECISIONS.md](DECISIONS.md).
