# Mandatory orchestration policy — zero new branches, fifty-PR ceiling, one release gate

**Effective:** 2026-11-15  
**Applies to:** all ten agents, the coordinator, every resumed agent chat, and every GitHub-side orchestration instruction.  
**Status:** mandatory; no agent may override it.

This policy supersedes every conflicting instruction in older assignments, status files, backlog entries, board snapshots, prompts and coordination decisions. In particular, it overrides any instruction to create a branch after each task/PR, continue by opening another PR, run tests after each small change, or create test-only branches/PRs. The coordinator must assign work within these limits; agent autonomy never overrides them.

## 1. Zero new working branches — permanent rule

- **The team-wide allowance for creating new non-main branches is ZERO.** This is not a per-agent allowance. No agent, including the coordinator, may create, fork, rename, recreate, or reactivate a working branch.
- This rule is permanent because branch refs are treated as lasting repository history and must not be multiplied for each task, agent, release, or version.
- **Grandfathered existing branch:** `coordinator/ui-02-safe-edit-mainline` already existed when this rule was adopted. It is the only non-main branch currently present and may be used only to finish the UI-02 work already committed to it. Do not repurpose it for a different release or create descendants from it. After its current work receives a final disposition, leave it untouched as a permanent historical ref.
- Do not delete, force-update, rename, or otherwise rewrite any existing branch. Existing historical branches are not work queues; do not revive them or attempt to recover deleted branches.
- All new authorized implementation and documentation work must be committed directly to `main`, with coordinator-assigned scope, one writer per file, and serialized updates for shared files. Workers must never push to `main` without an explicit assignment covering the exact paths they own.
- Because there are zero new branch slots, do not open a new PR that requires creating a branch. The coordinator may finish the one grandfathered UI-02 slice from its existing branch if a PR is necessary; all later work proceeds through authorized direct commits to `main`.
- Do not run tests or create testing infrastructure to justify a branch exception. There are no urgency, agent-count, hotfix, stacked-work, documentation, QA, or testing exceptions.

## 2. Maximum fifty open PRs; hard stop at the cap

- **No more than 50 open pull requests may exist in the active release cohort.** Draft PRs count. Stacked PRs count. QA, docs and integration PRs count. There is no separate allowance for any agent.
- The 50-PR limit applies to the team as a whole, not to each agent.
- When the cohort reaches 50 PRs, **PR admission freezes**. Do not open PR #51, create a replacement PR because another one was closed, split a task into more PRs, or open a PR simply to carry tests/docs.
- After the 50-PR cap is reached, no new PRs may be opened until every PR in that cohort has a final disposition (merged into the release or explicitly closed as rejected/superseded/abandoned), the newer version has been released and deployed, and the coordinator records that release.
- A closed PR is not automatically “solved.” Its code must either be included in the release or have a recorded reason for exclusion. Do not reopen an old PR or create a substitute without coordinator authorization.
- The next PR cycle starts only after the prior cohort is resolved and the new version is shipped. The same 50-PR ceiling applies again.
- The coordinator checks the live open-PR count before authorizing any PR. If the count or cohort state is uncertain, stop and reconcile it; do not guess.

## 3. No per-task test churn

- Do not run unit, integration, browser, MCP, benchmark or full-suite tests after every small task, commit, push or PR update.
- Do not create branches, PRs, harnesses or extra workflows whose purpose is to test a test, prove that a runner works, or repeat an already-known test.
- Do not spend agent time/token budget producing repetitive test reports or triggering duplicate CI runs. Keep status updates short and report only material completed work, blockers and exact changed paths/commits.
- Agents may implement the assigned product work and keep necessary acceptance criteria with that work. Test execution is deferred; it is not a separate workstream or deliverable. Do not add speculative test infrastructure during the release freeze.
- **There is one coordinated automated validation gate:** run the consolidated project validation once, on `main`, only after all approved PR work for the release is integrated, the latest version is assembled as a release candidate, and it is genuinely ready to ship.
- That single workflow invocation covers the required Node/model/editor checks and the real Chromium/browser plus bridge/MCP checks. Do not split it into many preliminary test runs or create a test branch. The workflow is manually dispatched; routine pushes and PR updates must not trigger test suites.
- If the final gate fails, do not ship. Report the concrete failure to the coordinator and user. Do not start an unbounded test/fix/test loop or create a test branch. Any further full validation run requires explicit coordinator/user authorization.
- The release gate is not permission to claim success before it runs. Do not say the release works, passes or is ready until the one authorized final validation completes.

## 4. Build the release, not a pile of experiments

- Prioritize user-visible production features and integration. Stop speculative modules, unrelated feature expansion, duplicate prototypes, benchmark-only tasks, test-runner experiments and documentation-only PRs unless the coordinator explicitly identifies them as necessary to ship the current release.
- Combine related, authorized tasks into complete implementation slices using coordinator-assigned direct commits to `main`. Do not create a branch or PR because an AC number, release, or agent changes.
- One task assignment must describe a meaningful product outcome, exact owned files, dependencies and expected integration point. Agents must not invent follow-on tasks or split one deliverable into artificial microtasks.
- Keep the existing single-writer file ownership rules. Branch/PR limits do not grant permission to edit another agent's files.
- The coordinator is responsible for sequencing the work, integrating the release and maintaining the live branch/PR budget. Agents must stop before any action that would breach a cap.

## 5. Release sequence and authority

1. Coordinator selects the product work required for the next user-visible release and assigns exact, non-overlapping file scopes for direct commits to `main`; the grandfathered UI-02 branch may only finish its already-started slice.
2. Agents complete substantial, compatible work within those slots. No test runs or new test branches during this implementation phase.
3. The coordinator resolves the release-cohort PRs within the 50-PR ceiling and integrates the approved changes.
4. When the newest version is assembled and ready to ship, freeze implementation and dispatch the single consolidated final validation workflow on `main`.
5. If it passes, ship/deploy that version and record the release commit, deployment and final PR disposition. Only then may the coordinator ask the user to authorize a new release cycle.

**Default when uncertain: stop branch/PR creation, do not run tests, preserve existing work, and ask the coordinator.** No agent may interpret urgency or “keep going” as permission to exceed these hard limits.

## 6. Execution efficiency — build first, avoid unnecessary inspection

This section applies to every agent and every role. The objective is to spend time on useful product work, not repeated coordination or repository archaeology.

- **Minimal startup:** Fetch the latest `main` once. Read this policy, the current board/decisions, and only the assignment and status files relevant to your own role. The coordinator may inspect other agents' status files when making a concrete scheduling or dependency decision; agents must not read all ten assignments/statuses by default.
- **Batch GitHub work:** Make independent GitHub reads in parallel where possible. Prefer one branch listing, one open-PR listing and targeted file reads over many serial queries. Record the current `main` SHA, assigned branch head and fetched file SHAs; do not fetch unchanged files repeatedly.
- **No historical PR archaeology:** Do not reopen, restore, recreate, audit, reconcile, merge, close, or otherwise act on old PRs or deleted branches unless the user explicitly asks. Do not inventory closed PRs, deleted branches, stale historical snapshots or old agent work merely to understand today's task. A deleted branch is not a recovery task. Current work starts from current `main`.
- **Inspect only what the task needs:** Find the relevant symbols/paths first, then read the smallest useful source ranges. Do not repeatedly fetch entire large files, search the same terms, or inspect unrelated modules. Expand inspection only when a concrete dependency, conflict, security issue or integration boundary requires it.
- **Implementation before paperwork:** Once scope, ownership and dependencies are clear, begin the highest-priority authorized implementation. Do not generate another plan, report or coordination document when the task calls for building or reviewing the product. Do not ask questions whose answers are already in the repository or current conversation.
- **Role-appropriate focus:** Designers review the actual affected interface and interaction; analysts research only enough to support a concrete product decision; coders implement the production workflow; verifiers review the relevant diff and safety boundaries; the coordinator resolves only the decisions and dependencies needed to keep delivery moving.
- **One useful review pass:** Review the changed diff and its direct integration points. Avoid repeated review passes that add no new evidence. Do not run tests outside the single authorized release gate.
- **Concise communication:** Send an update when a meaningful milestone is reached or a real blocker appears. Do not narrate every API call, repeat repository facts, or send progress messages that do not help a teammate act. Final reports should state the result, changed paths/commit, integration need and genuine blocker only.
- **Stop when evidence is sufficient:** Do not continue searching after the required facts are established. If a required fact is unavailable, state the precise limitation and continue other authorized work rather than broadening into unrelated investigation.

**Default:** use the smallest set of reads and actions that safely establishes scope, then make substantial product progress. Speed must not compromise ownership, data integrity, the zero-new-branch rule, the fifty-PR ceiling, or the single release-validation gate.
