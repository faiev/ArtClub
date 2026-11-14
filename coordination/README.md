# Art Club agent coordination

This directory is the shared coordination memory for the five ChatGPT worker chats and the coordinator.

## Important limitation

A GitHub file does **not** wake up a ChatGPT chat, send it a notification, or make two chats talk to each other automatically. It gives every chat a common, durable source of truth. A worker must fetch the latest files whenever it starts or resumes. The user/coordinator still dispatches the message that wakes a worker.

The goal is to eliminate repeated one-off prompts, hidden handoffs, duplicate work, and conflicting edits.

## Sources of truth

| Path | Owner | Purpose |
|---|---|---|
| [BOARD.md](BOARD.md) | Coordinator only | Current project state, task ownership, dependencies, review state and file locks |
| [BACKLOG.md](BACKLOG.md) | Coordinator only | Prioritized tasks not currently assigned |
| [DECISIONS.md](DECISIONS.md) | Coordinator only | Decisions all workers must follow |
| `assignments/agent-N.md` | Coordinator only | The current assignment and next task for one worker |
| `status/agent-N.md` | That worker only | Its latest status, evidence, blockers and handoff |

The application source remains in the normal source tree. Worker code must be committed to that worker's feature branch and submitted as a pull request. Coordination status is metadata and should be committed to `main` in the worker's own status file so the other chats can read it immediately.

## Bootstrap mode (while the coordination PR is still open)

The initial coordination system is introduced in PR #5. Until that PR is merged into `main`, the coordination files do not exist on the default branch. **Do not report this as a blocker.**

Temporary source of truth:
- Read `coordination/README.md`, `BOARD.md`, `BACKLOG.md`, `DECISIONS.md`, your assignment and your status from ref `coordination/orchestration-v1`.
- In GitHub file fetch operations, explicitly set `ref=coordination/orchestration-v1`. Do not omit the ref during bootstrap.
- Update only your own `coordination/status/agent-N.md` on the same `coordination/orchestration-v1` branch. Fetch the latest file first and use its current blob SHA. Do not update another agent's status or coordinator-owned files.
- Keep all application code commits on your assigned feature branch, never on the coordination branch.
- Because several agents may update separate status files, re-fetch the branch and your file immediately before writing. If the write is rejected because the file/branch changed, re-fetch and reconcile; never force-push or overwrite another worker's update.
- The coordinator alone updates BOARD.md, BACKLOG.md, DECISIONS.md and assignments.
- After PR #5 is merged, switch the source of truth to the default branch `main`. Confirm the merge commit contains all coordination files before changing the ref.

This bootstrap exception exists only to make the first coordination PR usable. It does not authorize application-code changes on the coordination branch.

## Worker start/resume protocol

At the beginning of **every** new work session, and after completing any task:

1. Fetch the latest versions from the default branch: `coordination/BOARD.md`, your `assignments/agent-N.md`, your own `status/agent-N.md`, `coordination/DECISIONS.md`, and any task documents linked by your assignment.
2. Read the other agents' status files when your task depends on their work or touches a shared interface.
3. Confirm the task ID, acceptance criteria, dependencies, allowed files, and current main commit. Do not rely on an old chat prompt if the repository has newer instructions.
4. Before coding, update only your own status file to `IN_PROGRESS`, recording task ID, branch, base commit, and planned file scope. Commit that status update to `main` if the GitHub connection permits it.
5. Work only on your assigned feature branch. Never commit application code directly to `main`.
6. Before touching a file, check the file-ownership table in BOARD.md. Do not edit a file currently reserved by another agent. If a dependency or conflict appears, report it and stop the conflicting part.
7. Run the tests required by the assignment. Report exact commands and results; distinguish tests run locally from CI results.
8. Commit code to your feature branch. Open or update a draft PR. Do not merge it.
9. Update only your own status file on `main` to `REVIEW`, `BLOCKED`, or `DONE`. Include PR URL, branch, commit SHA, changed files, test results, known risks, and the exact next handoff.
10. Do not pick a new task from the backlog yourself. The coordinator assigns work in your assignment file, avoiding two agents claiming the same task.

If you cannot update your status file on `main`, include the complete status update in your chat response and explicitly say it was **not** written to the shared board. Do not claim other agents can see an update that is only in your private chat or unmerged branch.

## Task states

- `QUEUED`: recorded in the backlog, not assigned.
- `READY`: assigned and dependencies are satisfied.
- `IN_PROGRESS`: worker has started.
- `BLOCKED`: worker cannot proceed; the reason and unblock condition are recorded.
- `REVIEW`: code/report is submitted and awaits coordinator review.
- `DONE`: coordinator accepted the deliverable and required integration is complete.
- `DROPPED`: coordinator cancelled the task with a recorded reason.

A worker cannot mark its own work `DONE`. It can only submit it for review.

## Handoffs and coordination

- A PR is not complete just because a branch exists. The worker must submit a concise report and link the PR.
- A task that changes a shared interface must include an integration note and name downstream agents that depend on it.
- The coordinator updates BOARD.md and assignment files after reviewing a handoff, assigning new work, or changing dependencies.
- When one agent finishes, the coordinator can assign it another task immediately by updating its assignment file. The user then sends that chat the short resume prompt below.
- If a worker discovers a bug outside its scope, create a handoff note or recommend a task; do not silently expand scope.
- If two agents need the same file, serialize those edits. A branch is not a coordination mechanism by itself.

## Resume prompt to paste into any worker chat

> Resume your Art Club assignment using the GitHub coordination system. Fetch the latest files from the default branch: coordination/README.md, coordination/BOARD.md, coordination/assignments/<your-agent-file>.md, coordination/status/<your-agent-file>.md, and coordination/DECISIONS.md. Read any referenced dependencies. Report the current task ID, its status, your branch and base commit, and any blockers before continuing. Follow the repository instructions over stale chat instructions. Update only your own status file; keep code changes on your assigned feature branch. Do not self-assign or merge.

Replace `<your-agent-file>` with your own agent number, for example `agent-3.md`.

## Coordinator workflow

1. Read all five status files and open PRs.
2. Review evidence and CI, not just worker claims.
3. Update the board with accepted state and any new decisions.
4. Assign the next unblocked task in the relevant assignment file.
5. Send that worker the resume prompt. The worker fetches the new assignment from GitHub.
6. Merge only after review and required CI checks pass.

This is shared-memory coordination, not an autonomous multi-agent runtime. For automatic wakeups, task claiming, or agent-to-agent messaging, a separate always-running orchestrator and authenticated agent runtime would be required.
