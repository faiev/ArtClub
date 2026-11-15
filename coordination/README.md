# Art Club agent coordination

This is the persistent coordination system for ten worker chats plus one coordinator.

> **MANDATORY POLICY:** Read and follow [ORCHESTRATION_POLICY.md](ORCHESTRATION_POLICY.md) before doing any work. It permits **zero new non-main branches**, retains the one already-existing `coordinator/ui-02-safe-edit-mainline` branch only for its current UI-02 work, caps open PRs at fifty, prohibits test-only workstreams, and permits only one consolidated final validation run immediately before release. All subsequent authorized changes are direct commits to `main` with coordinator-assigned file scopes. This policy overrides every conflicting older instruction in this README, BOARD, BACKLOG, DECISIONS, assignment or status file.

## Important runtime limitation

These files provide shared assignments, backlog, status, ownership and decisions. They do **not** automatically wake a ChatGPT chat, run it in the background, or let one chat message another. A worker only executes when its chat receives a prompt. The goal of this system is to make every resumed session productive for as long as possible and remove coordinator approval between pre-authorized tasks.

## Operating model: ten agents, zero new working branches

All ten agents may be scheduled by the coordinator in parallel only when their assigned file ownership does not overlap. **No agent may create another branch.** Authorized application and coordination changes are committed directly to `main` with coordinator-issued path ownership and serialized writes to shared files. The already-existing `coordinator/ui-02-safe-edit-mainline` branch is grandfathered only for the UI-02 work already on it; it must not become a reusable branch for future releases. Agents without an explicit file assignment remain paused or perform only requested read-only review. The older three-chat restriction in D-028 is superseded by D-029, while its product-delivery focus and ownership boundaries remain in force.

## Historical operating model (paused during UI-02)

Every agent receives a multi-phase workstream with a ranked queue of substantial deliverables. A PR is a checkpoint, not a stop condition.

**Required worker behavior:**
1. Start from the active workstream and read the entire assignment, not just the first item.
2. Work through the ordered phases in one continuous session whenever tools/context permit.
3. When a coherent deliverable is ready, commit and open/update its PR.
4. **Immediately continue to the next unblocked phase. Do not wait for the coordinator to review/merge the previous PR.**
5. Do not create a branch for the next deliverable. Work only on coordinator-assigned, non-overlapping file scopes directly on `main`; serialize dependencies in the order the coordinator specifies.
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

Only the coordinator edits README, BOARD, BACKLOG, DECISIONS and assignment files. Each worker edits only its own status file on `main`. Application code is committed directly to `main` only under a coordinator-issued exact-path assignment; workers must not edit shared or coordinator-owned files.

## Active coordination source

PR #7 is merged. The active coordination ref is **main**.

At the start of each resumed session, fetch README, BOARD, BACKLOG, DECISIONS, your assignment and your status from main. Do not read from the old orchestration branch for current assignments; it is retained as historical bootstrap state.

## Start/resume protocol

1. Fetch the six coordination files listed above from main.
2. Treat your assignment file as the canonical authorization and scope. Your status file may still contain the old single-task handoff until you resume; update it to the new workstream rather than treating stale status text as a blocker. Read all phases in your assignment and select the first unfinished, unblocked item.
3. Report task IDs, active branch/head, current PRs, test state and blockers.
4. Begin immediately. There is no need to ask permission to move to the next item in your assigned queue.
5. Check file ownership and branch dependencies before each phase.
6. Commit only the exact files authorized in your direct-to-main assignment. Never create or reuse a separate working branch.
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

## Branch and PR cadence — zero new branches

- Do not create, recreate, fork, rename, or reactivate any non-main branch.
- All new authorized work lands through direct commits to `main`; the coordinator assigns exact paths and ensures one writer per file.
- The existing `coordinator/ui-02-safe-edit-mainline` branch is grandfathered only for its current UI-02 slice. Do not use it for unrelated work or a later release.
- Do not create a new PR that requires a new branch. The coordinator may use the grandfathered branch only to finish that already-started UI-02 slice.
- Preserve existing history. Never force-update or delete an existing branch.

## Shared-file locks and safe autonomy

- One writer per shared file.
- Agent 4 owns bridge/API files and bridge-related `index.html` work while reconciling PR #8. Agent 1's AC-025 audit is complete and read-only; Agent 4 must decide how to port the non-duplicative PR #1 persistence assertions before closing the stale overlap.
- PR #11 is merged. Agent 3 currently owns `.github/workflows/project-tests.yml` for AC-027 sprite-sheet browser verification and CI wiring. Agent 2 may prepare/run its own renderer browser harness, but must coordinate before changing the shared workflow; Agent 3 releases the lock when AC-027 workflow work is complete.
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

> Resume your Art Club work from the GitHub coordination system. Fetch the latest README, BOARD, BACKLOG, DECISIONS, your assignment and your status from main. Read the entire multi-phase assignment and status queue. Start the first unfinished, unblocked item immediately. A PR being open or awaiting review is not a reason to stop: after submitting one deliverable, continue to the next independent authorized phase without waiting for the coordinator. Keep a ranked queue of the next 3–5 actions in your status file. Respect shared-file locks, follow the coordinator-issued direct-to-main file assignment; never create a branch or self-authorize a main update. Pause only for a genuine external blocker and continue any independent work.

## Coordinator workflow

1. Review all ten status files and PRs from main.
2. Keep agents supplied with several authorized, non-overlapping phases—not one tiny task.
3. Reserve shared files explicitly and release locks promptly, including after a dependency merges.
4. Review and merge coherent PRs in small increments, only after the exact current head has passing required checks and the diff against main is limited to assigned files.
5. Update workstream queues only when the existing queue is exhausted, unsafe or superseded.

This design reduces coordinator bottlenecks but does not create background execution or automatic wakeups. To make a chat act again, the user still needs to resume that chat unless a separate scheduler/orchestrator is added.
