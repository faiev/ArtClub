# Art Club task backlog

The coordinator owns this list. Agents must not self-assign tasks. Priority can change after PR review or new findings.

## Ready after dependencies

### AC-006 — Fix project recovery snapshot rotation
- **Candidate owner:** Agent 1
- **Priority:** High
- **State:** `QUEUED`, blocked until AC-001 / PR #1 is reviewed and merged.
- **Reference:** [Issue #2](https://github.com/faiev/ArtClub/issues/2)
- **Problem:** Opening Project Library may persist an already-saved project and overwrite the one-step recovery snapshot, making Recover return the current version instead of the previous one.
- **Acceptance criteria:**
  1. Reproduce the A → autosaved B → open Project Library → Recover scenario in Chromium.
  2. Confirm recovery restores A, not B.
  3. Confirm opening the library without a dirty project does not rotate the recovery snapshot.
  4. Add regression coverage and run the full browser E2E suite.
  5. Preserve normal autosave, explicit save, and project migration behavior.
- **Suggested branch:** `agent/qa-recovery-snapshot`

### AC-007 — Integrate sprite-sheet export into the editor and agent workflows
- **Candidate owner:** Agent 3
- **Priority:** High
- **State:** `QUEUED`, blocked until AC-002 is accepted and AC-004's API/bridge contract is reviewed.
- **Acceptance criteria:**
  1. Provide a user-facing sprite-sheet export workflow with layout, spacing and margin settings.
  2. Download the PNG and matching JSON metadata.
  3. Preserve frame order, transparency, native pixel dimensions and durations.
  4. Expose equivalent structured functionality to the browser Agent API and MCP tools, without duplicating exporter logic.
  5. Add UI and browser/MCP integration tests.
- **File-scope warning:** coordinate before editing `index.html`, `js/agent-api.js`, or `agent-bridge/*`.

### AC-008 — Add a concurrency and stale-write contract for agents
- **Candidate owner:** Agent 4
- **Priority:** Medium
- **State:** `QUEUED`, blocked until AC-004 is reviewed and merged.
- **Acceptance criteria:**
  1. Document whether the editor supports one writer or multiple concurrent writers per project.
  2. Ensure stale revisions are detected and rejected with a structured error.
  3. Ensure a failed mutation cannot silently overwrite newer work.
  4. Add MCP integration tests for stale revisions and concurrent mutation attempts.
  5. Document recovery and retry behavior for an agent client.
- **Constraint:** do not promise distributed multi-agent editing unless it is actually implemented and tested.

### AC-009 — Convert UX findings into a prioritized implementation plan
- **Candidate owner:** Agent 5
- **Priority:** Medium
- **State:** `QUEUED`, blocked until AC-005 is accepted.
- **Acceptance criteria:**
  1. Select the five highest-impact findings from the accepted audit.
  2. Convert each into a self-contained task with user problem, exact behavior, acceptance criteria and dependencies.
  3. Identify tasks that conflict with active agent file ownership.
  4. Recommend an implementation sequence; do not implement code in this task.

## Future candidates

Add new work here only after a bug, user need, or accepted audit finding is supported by evidence. Every new item must have an owner candidate, priority, acceptance criteria, dependencies, and a test/verification plan.
