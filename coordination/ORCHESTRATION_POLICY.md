# Mandatory orchestration policy — zero new branches, one mainline, one release gate

**Effective:** 2026-11-15  
**Applies to:** all ten role-based agent sessions and the coordinator.  
**Authority:** this file, `TEAM_MODEL.md`, `BOARD.md` and `DECISIONS.md`.

## 1. Zero new branches — permanent

- The team-wide allowance for creating non-main branches is **ZERO**. No agent, including the coordinator, may create, fork, rename, recreate, restore or reactivate a branch.
- The only existing non-main branch, `coordinator/ui-02-safe-edit-mainline`, is grandfathered solely for its already-started UI-02 change. It must not be reused for any other task or release. Do not delete, force-update or rewrite it.
- All future authorized work is committed directly to `main`, with coordinator-issued exact file scopes, one writer per file and serialized changes to shared files.
- Because no new branch may be created, agents must not open PRs that require a new branch. Do not work around this rule by pushing to old branches or reviving deleted branches.
- Do not inspect, recover, close, merge, reopen or otherwise act on historical PRs or deleted branches unless the user explicitly requests it.

## 2. PR ceiling

- The maximum permitted count is **50 open PRs** across the team. Draft and dependent PRs count.
- The current workflow is direct-to-`main`, so no new PR is expected or authorized. The 50-PR rule is a hard ceiling, not a target or an allowance to create branches.
- Do not reopen or create substitute PRs for historical work. No old PR cleanup is implied by this policy.

## 3. One validation gate — no per-task test churn

- Do not run unit, integration, browser, MCP, benchmark or full-suite tests after every small edit, commit or implementation step.
- Do not create test harnesses, workflows, branches or PRs merely to validate another test or repeat an existing run.
- Keep acceptance criteria with the assigned product task; defer automated execution during implementation.
- **Run the consolidated project validation exactly once on `main`**, after the approved release work is integrated, assembled as a release candidate and genuinely ready to ship. This gate covers the required Node/model/editor checks and real Chromium/browser plus bridge/MCP checks.
- If the gate fails, do not ship. Report the concrete failure. Another full run requires explicit user/coordinator authorization; do not start an unbounded test/fix/test loop.
- Never claim that an untested change passes or is release-ready.

## 4. Build production behavior

- Prioritize working, user-visible editor features. Avoid speculative modules, disconnected prototypes, duplicate research, documentation-only work and experiments unless they directly unblock the current release.
- Research and design must result in a concrete product decision or acceptance criteria. A prototype, report or helper module is not a shipped feature.
- Coders work within coordinator-assigned paths and integrate with existing plain-JavaScript architecture. Do not introduce TypeScript or mandatory backend/network dependencies.
- Verifiers review changed code and user workflows for data loss, stale state, partial operations, security, accessibility and false success states. Automated tests remain governed by the single release gate.
- One shared file has one writer at a time. Parallel work is permitted only when file scopes do not overlap.
- The coordinator owns priorities, exact path assignment, mainline integration, release and deployment.

## 5. Execution efficiency

- Fetch the latest `main` once per work session. Read this policy, `TEAM_MODEL.md`, `BOARD.md`, `DECISIONS.md`, and only the source files needed for the assigned task.
- Batch independent GitHub reads. Do not repeatedly fetch whole files, re-read unchanged paths, scan old histories or inventory unrelated PRs/branches.
- Once the scope and relevant dependencies are clear, implement. Do not produce extra plans, status diaries or coordination paperwork instead of product work.
- Send updates only at meaningful milestones or when a genuine blocker requires action. Report changed paths, commit, working behavior and remaining limitation.
- Stop researching when the evidence is sufficient. State precise uncertainty rather than broadening into unrelated inspection.

**Default:** the smallest safe set of reads, one clear owner per file, substantial product progress, no new branches, no per-task test loops and one final release-validation gate.
