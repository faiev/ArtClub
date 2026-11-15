# Art Club — agent coordination

This directory defines the **current role-based team**. The former numbered workstream system has been retired. Do not use its old task queues or status reports.

## Read these files

1. `ORCHESTRATION_POLICY.md` — mandatory repository, branch, PR and release rules.
2. `TEAM_MODEL.md` — roles, responsibilities and ten-seat allocation.
3. `BOARD.md` — current product priorities, assignments, ownership and live repository state.
4. `DECISIONS.md` — current product and engineering decisions.

These four files are the entire active coordination system. The coordinator maintains them. There are no per-agent assignment or status diaries.

## Resume protocol

Every resumed agent session must:
1. Fetch the latest `main` and read the four files above.
2. Identify its role and the exact task/file scope assigned on `BOARD.md`.
3. Work only within that scope. Do not resurrect an old AC queue, invent a parallel task, or assume that a historical PR/branch is active.
4. Share a concise deliverable with the coordinator: changed paths/commit, what now works, remaining limitation and any conflict.
5. Stop when the assigned scope is complete or a real blocker prevents safe progress.

## How work is coordinated

- The coordinator owns priority, assignment, file ownership, sequencing, integration and release.
- Designers and the competitor analyst provide decision-ready product direction. Research/prototypes are not production features.
- Coders implement the agreed production experience in plain JavaScript and existing project architecture.
- Verifiers inspect the actual changed implementation and challenge edge cases; automated tests remain deferred until the single release gate.
- Multiple agents can work concurrently only on disjoint files or clearly separated deliverables. A shared file has exactly one writer at a time.
- Product progress means a working user-facing feature integrated into `main`, deployed and verified. Reports, prototypes and isolated helpers are not shipped features.

## Important runtime limitation

GitHub stores shared instructions; it does not wake separate ChatGPT agent chats or run them in the background. The user must resume the agent sessions that should act.
