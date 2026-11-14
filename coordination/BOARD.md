# Art Club coordination board

Last coordinator snapshot: 2026-11-14  
Repository: [faiev/ArtClub](https://github.com/faiev/ArtClub)  
Default branch: `main`  
Snapshot base commit: `c7ff0702c27cba22e443f9012fc482c217363613`

> This board records repository evidence, not unverified statements from private chat windows. Worker status files contain their latest handoffs. The coordinator alone changes this board.

## Current agent state

| Agent | Role | Branch state against main | Current deliverable | Coordination state |
|---|---|---:|---|---|
| 1 | QA / release | 3 commits ahead | [Draft PR #1](https://github.com/faiev/ArtClub/pull/1), E2E persistence test correction | `REVIEW` — QA says 35 unit/editor tests, Chromium E2E and MCP E2E passed; coordinator must verify checks |
| 2 | Rendering / performance | Identical to main, 0 commits ahead | No committed artifact found on branch | `NEEDS_HANDOFF` — original benchmark/prototype has not been published to the branch |
| 3 | Animation / export | 3 commits ahead | [Draft PR #3](https://github.com/faiev/ArtClub/pull/3), sprite-sheet PNG + metadata module | `REVIEW` — PR reports 10 exporter tests passing; full repository/browser CI not reported |
| 4 | Agent bridge / MCP | 8 commits ahead | Changes to API, bridge, E2E, package and index files; no open PR found | `NEEDS_PR` — publish a reviewable PR and exact test report before more scope is assigned |
| 5 | UX / product | 1 commit ahead | `UX_AUDIT.md` added on branch; no open PR found | `NEEDS_PR` — submit the audit as a PR and summarize its top findings |

Branch comparisons were made against the snapshot base commit. The absence of a PR does not prove an agent did no work; it means the work is not yet available for normal review and integration.

## Current file ownership / collision avoidance

| Paths | Owner until handoff is reviewed |
|---|---|
| `agent-bridge/*`, `js/agent-api.js`, `AGENT_API.md`, `tests/agent-api.test.js`, `index.html` changes related to bridge wiring | Agent 4 — finish and submit its existing branch first |
| `js/sprite-sheet-export.js`, `tests/sprite-sheet-export.test.js`, `ANIMATION_EXPORT.md` | Agent 3 |
| `agent-bridge/e2e-test.mjs` | Agent 1 |
| `UX_AUDIT.md` | Agent 5 |
| Canvas renderer module / benchmark files | Agent 2, after it declares exact file scope in its status |
| `coordination/BOARD.md`, `BACKLOG.md`, `DECISIONS.md`, `assignments/*` | Coordinator only |
| `coordination/status/agent-N.md` | Only the matching agent |

**Shared UI/API rule:** Do not allow Agent 3 and Agent 4 to change `index.html`, `js/agent-api.js`, or `agent-bridge/*` concurrently. Agent 4's current bridge PR must be reviewed first; then the coordinator can assign Agent 3 the export UI/API integration against the accepted interface.

## Active tasks

| Task | Owner | State | Next action |
|---|---|---|---|
| AC-001 — Correct frame-aware persistence E2E checks | Agent 1 | `REVIEW` | Review PR #1 and its CI run; do not merge until checks are independently verified |
| AC-002 — Build sprite-sheet PNG and timing metadata exporter | Agent 3 | `REVIEW` | Review PR #3 and run required repository/browser checks |
| AC-003 — Canvas performance audit and prototype | Agent 2 | `IN_PROGRESS` | Publish benchmark/prototype or a blocker report; current branch has no commits |
| AC-004 — Harden local MCP bridge and browser agent API | Agent 4 | `IN_PROGRESS` | Open a PR from the existing 8-commit branch with scope, behavior changes, tests and risks |
| AC-005 — UX/product audit | Agent 5 | `IN_PROGRESS` | Open a PR containing `UX_AUDIT.md`; include the top five prioritized findings |

## Dependencies

1. AC-001 PR #1 review precedes the new recovery-snapshot fix (AC-006), because the new test work should build on the accepted QA baseline.
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
