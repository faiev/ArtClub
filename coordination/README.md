# Art Club agent coordination

This is the persistent coordination system for ten worker chats plus one coordinator.

## Important runtime limitation

These files provide shared assignments, backlog, status, ownership and decisions. They do **not** automatically wake a ChatGPT chat, run it in the background, or let one chat message another. A worker only executes when its chat receives a prompt. The goal of this system is to make every resumed session productive for as long as possible and remove coordinator approval between pre-authorized tasks.

## Operating model: continuous workstreams, not one-ticket agents

Every agent receives a multi-phase workstream with a ranked queue of substantial deliverables. A PR is a checkpoint, not a stop condition.

**Required worker behavior:**
1. Start from the active workstream and read the entire assignment, not just the first item.
2. Work through the ordered phases in one continuous session whenever tools/context permit.
3. When a coherent deliverable is ready, commit and open/update its PR.
4. **Immediately continue to the next unblocked phase. Do not wait for the coordinator to review/merge the previous PR.**
5. Use a new feature branch for the next independently reviewable deliverable when that avoids mixing scopes. Branch from latest main; if it depends on an unmerged module, use a clearly documented stacked branch and keep the dependency explicit.
6. While a dependency is genuinely pending, work on the next independent module, tests, fixtures, documentation, acceptance matrix, browser harness or a source-level audit. Never idle because a PR is open.
7. Maintain a ranked "Next queue" in your own status file. The coordinator has already authorized every item listed in your assignment; do not ask for a new assignment after each PR.
8. If a task is completed, choose the next unfinished item from your assigned queue. Do not invent scope outside it.
9. Pause only for a real shared-file collision, missing user/product decision, security-sensitive design decision, or an external dependency that prevents all useful independent work. State the exact blocker and what you completed in parallel.
10. Keep PRs narrow and reviewable. Multiple independent PRs are better than one enormous mixed PR. Never add unrelated later-phase work to a PR already under review unless that work is a direct correction to the same deliverable.

This is a rolling workstream. Agents are expected to submit several useful deliverables over time, not one small PR followed by "waiting for coordinator".

## Files and ownership

| Path | Owner | Purpose |
|---|---|---|
| coordination/README.md | Coordinator | Operating model and protocols |
| coordination/BOARD.md | Coordinator | Live state, PR inventory, dependencies and locks |
| coordination/BACKLOG.md | Coordinator | Long-range roadmap and task definitions |
| coordination/DECISIONS.md | Coordinator | Shared architecture, autonomy and workflow rules |
| coordination/assignments/agent-N.md | Coordinator | Full authorized workstream queue for one worker |
| coordination/status/agent-N.md | Matching worker | Progress, branch/PR ledger, CI evidence, next queue and blockers |

Only the coordinator edits README, BOARD, BACKLOG, DECISIONS and assignment files. Each worker edits only its own status file on main. Application code belongs on feature branches and is submitted through PRs.

## Active coordination source

PR #7 is merged. The active coordination ref is **main**.

At the start of each resumed session, fetch README, BOARD, BACKLOG, DECISIONS, your assignment and your status from main. Do not read from the old orchestration branch for current assignments; it is retained as historical bootstrap state.

## Start/resume protocol

1. Fetch the six coordination files listed above from main.
2. Read all phases in your assignment and select the first unfinished, unblocked item.
3. Report task IDs, active branch/head, current PRs, test state and blockers.
4. Begin immediately. There is no need to ask permission to move to the next item in your assigned queue.
5. Check file ownership and branch dependencies before each phase.
6. Keep work on your assigned feature branch or create a new clearly named branch from latest main for the next independent deliverable. Do not overwrite another agent's branch.
7. Run relevant focused tests, then the full project Node/Chromium/MCP checks for integration-boundary changes. Report exact commands and head SHA.
8. Open/update a PR when a deliverable is reviewable.
9. Update only your status file. Record completed work, commits, PR links, check runs, exact results, risks and the **next 3–5 queued actions**.
10. Continue immediately to the next unblocked item; do not end with "waiting for coordinator" when assigned work remains.
11. Never merge your own PR. Never self-mark ACCEPTED or DONE.

## Status file format

Keep a compact rolling ledger:
- Active workstream and phase.
- Current branch and HEAD SHA.
- Open PRs and purpose.
- Completed phase IDs.
- Test commands/results tied to exact SHAs.
- Next 3–5 authorized actions, ordered.
- Blockers with owner and the parallel work continuing meanwhile.

The status file is not a diary; keep it accurate and useful for the next resume.

## Branch and PR cadence

- One PR per cohesive deliverable or tightly related phase group.
- Once PR is open, continue on a different branch for independent next work.
- Do not put follow-on tasks that can be separate PRs into an already submitted PR just to avoid creating a branch.
- For stacked work, clearly state the parent PR and avoid claiming integration until the dependency is merged.
- After every main update, refresh the branch with a non-force merge/rebase policy agreed in the repo; preserve commits and rerun tests on the resulting head.
- A successful CI result applies only to the tested commit SHA and base.
- A PR waiting for review is not a task queue and is not permission to stop.

## Shared-file locks and safe autonomy

- One writer per shared file.
- Agent 4 owns bridge/API files and bridge-related index.html work while reconciling PR #8.
- Agent 3 owns the project test workflow while reconciling PR #11. Agent 2 can prepare browser tests/docs but must not change the workflow until Agent 3 releases it.
- Agent 1's PR #1 audit is read-only; Agent 1 does not edit the shared bridge E2E file.
- index.html remains coordinator-controlled for feature UI integrations. A worker may complete isolated modules, tests, docs, browser harnesses and static prototypes, but may not take the UI lock implicitly.
- When blocked on a locked file, continue all work that stays within your own paths.
- No worker may modify another worker's status or assignment.

## Non-negotiable technical constraints

- Plain JavaScript, not TypeScript.
- Preserve local-first/GitHub Pages deployment. No mandatory backend, accounts, cloud service or network dependency for core features.
- Deterministic pixel results, exact HEX colors and integer pixel boundaries.
- Bound allocations and validate malformed inputs before mutating state.
- No silent repair or data loss.
- Distinguish unit/mocked tests, browser tests, MCP tests, CI and performance measurements.
- No claim of UI integration until actual UI integration exists and is tested.

## Generic resume prompt

> Resume your Art Club work from the GitHub coordination system. Fetch the latest README, BOARD, BACKLOG, DECISIONS, your assignment and your status from main. Read the entire multi-phase assignment and status queue. Start the first unfinished, unblocked item immediately. A PR being open or awaiting review is not a reason to stop: after submitting one deliverable, continue to the next independent authorized phase without waiting for the coordinator. Keep a ranked queue of the next 3–5 actions in your status file. Respect shared-file locks, keep code on your own feature branches, run/report exact tests, and never merge your own PR. Pause only for a genuine external blocker and continue any independent work.

## Coordinator workflow

1. Review all ten status files and PRs.
2. Keep agents supplied with several authorized, non-overlapping phases—not one tiny task.
3. Reserve shared files explicitly and release locks promptly.
4. Review and merge coherent PRs in small increments.
5. Update workstream queues only when the existing queue is exhausted, unsafe or superseded.

This design reduces coordinator bottlenecks but does not create background execution or automatic wakeups. To make a chat act again, the user still needs to resume that chat unless a separate scheduler/orchestrator is added.
