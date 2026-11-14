# Art Club agent coordination

This directory is the shared coordination memory and task queue for ten worker chats and one coordinator chat.

## What this does — and does not do

GitHub files give the chats shared, persistent state: assignments, task status, dependencies, file ownership and decisions. A ChatGPT chat does not automatically wake up when a file changes, and separate chats cannot message each other automatically. The user/coordinator sends a short resume message to wake a worker; that worker then fetches the latest assignment.

**A blocked PR is not a reason to idle an agent.** A worker should continue its assigned independent task, prepare tests/review evidence, or produce a useful blocker report. Only a specific file conflict or a true technical dependency should stop work.

## Files and ownership

| Path | Owner | Purpose |
|---|---|---|
| `BOARD.md` | Coordinator | Live task state, PRs, dependencies and file ownership |
| `BACKLOG.md` | Coordinator | Future tasks with acceptance criteria |
| `DECISIONS.md` | Coordinator | Shared architecture and workflow decisions |
| `assignments/agent-N.md` | Coordinator | Current task and next task for one worker |
| `status/agent-N.md` | Matching worker | Progress, evidence, blockers and handoff |

The board and assignments are not agent-editable. Each worker updates only its own status file. Application code belongs on a worker's feature branch and is submitted through a PR.

## Bootstrap mode

This coordination system is introduced by PR #7. Until PR #7 is merged, these files exist on branch `coordination/orchestration-v2`, not on `main`.

During bootstrap:
- Fetch all coordination files with explicit ref `coordination/orchestration-v2`.
- Update only your own `coordination/status/agent-N.md` on that same branch.
- Re-fetch your status file immediately before writing and use its latest blob SHA.
- Keep application code on your own assigned feature branch.
- Never write to another agent's status file, the board, backlog, decisions or assignments.
- If a write fails due to a changed branch/file, fetch again and reconcile. Never force-push.

After PR #7 merges:
- Read coordination files from `main`.
- Update only your own status file on `main`.
- Continue keeping application code on the assigned feature branch.

The coordinator alone changes board, backlog, decisions and assignments, including on the bootstrap branch.

## Start/resume protocol

At the start of every session and after completing each task:

1. Fetch `coordination/README.md`, `BOARD.md`, `BACKLOG.md`, `DECISIONS.md`, your assignment and your status from the active coordination ref: `coordination/orchestration-v2` during bootstrap, then `main` after PR #7 merges.
2. Read relevant dependencies and other agents' status files when your task touches their work.
3. Report your task ID, state, feature branch, base commit and blockers.
4. If assigned work is `READY`, change your status to `IN_PROGRESS` and begin. Do not wait for another PR to merge unless your assignment identifies a specific dependency.
5. Check file ownership before editing. If one file is reserved by another agent, do not edit it; continue with non-conflicting files and tests.
6. Make application changes only on your assigned feature branch.
7. Run the exact tests in your assignment. Report commands and results honestly. Distinguish mocked tests, local browser tests and CI.
8. Commit work and open/update a draft PR when the deliverable is reviewable.
9. Update only your status file with `REVIEW`, `BLOCKED`, or `DONE`, including commit SHA, PR, changed files, test evidence, risks and next handoff.
10. Do not self-assign from the backlog. Ask the coordinator for a new task after submitting the current handoff.

## States

- `READY`: assigned and can begin immediately.
- `IN_PROGRESS`: active work.
- `BLOCKED`: a specific external dependency prevents the next action; name the blocker and continue any independent work.
- `REVIEW`: submitted for coordinator review.
- `ACCEPTED`: coordinator accepts the report/code but integration may remain.
- `DONE`: acceptance criteria and required integration are complete.
- `QUEUED`: future work not yet assigned.

Workers do not mark their own work `ACCEPTED` or `DONE`.

## Handoff and concurrency rules

- PR opened, PR reviewable, CI passing, PR merged and feature integrated are distinct states.
- A worker's next assignment can start while an earlier PR is under review if it uses a different branch and does not conflict with active file ownership.
- Do not assign two agents the same file at once. Coordinator serializes shared UI/API changes.
- When blocked on another worker, state exactly what is blocked. Continue independent tests, docs, or isolated modules.
- Do not rebase or force-push someone else's branch.
- Do not claim a feature is integrated merely because an isolated module exists.

## Quick resume prompt

> Resume your Art Club work from the GitHub coordination system. Fetch the latest README, BOARD, BACKLOG, DECISIONS, your assignment and your status from ref `coordination/orchestration-v2` (until PR #7 merges; afterward use `main`). Read dependencies, confirm your task ID/state/branch/base commit, and begin immediately if it is READY. Do not wait for unrelated PRs. Respect file ownership, update only your own status file, keep code on your assigned feature branch, run and report real tests, and submit a reviewable PR. Do not self-assign or merge.

## Adding more agents (repeatable process)

To extend the team beyond ten:

1. Choose the next unused agent number and a role with a real, bounded deliverable.
2. Pick a task ID and define a user-facing problem, exact acceptance criteria, tests and a clear handoff.
3. Create a feature branch from the latest `main` commit (or current agreed integration base). Do not reuse another agent's branch.
4. Add `coordination/assignments/agent-N.md` with the task, feature branch, allowed files, constraints, dependencies and tests.
5. Add `coordination/status/agent-N.md` with the same task ID, `READY` state, branch and base SHA.
6. Add the worker and task to BOARD.md, reserve exclusive file ownership, and add later follow-ups to BACKLOG.md.
7. Check that the task does not overlap existing file locks. If it must touch a shared file, schedule that edit after the current owner hands it off.
8. Commit coordination metadata to the active coordination branch during bootstrap, or to `main` after this PR merges.
9. Open a new ChatGPT chat and paste the generic resume prompt, replacing N with the new agent number.
10. Verify that the worker fetched the intended assignment before allowing code changes.

An agent is not "added" until its assignment, status, board row, file ownership, branch and prompt all agree. Never create empty agents merely to increase the count.

## Coordinator workflow

1. Read all worker status files and open PRs.
2. Review diffs, acceptance criteria and CI evidence.
3. Keep every agent assigned to one active, actionable task.
4. Only mark work blocked where a concrete dependency or file collision exists.
5. Update board/assignments and send the worker its resume prompt.
6. Merge in small increments after review and required checks.

This is a human-dispatched multi-chat workflow with shared memory, not an autonomous agent runtime. Automatic wakeups require a separate orchestrator.
