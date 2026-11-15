# Mandatory orchestration policy — five branches, fifty PRs, one release gate

**Effective:** 2026-11-15  
**Applies to:** all ten agents, the coordinator, every resumed agent chat, and every GitHub-side orchestration instruction.  
**Status:** mandatory; no agent may override it.

This policy supersedes every conflicting instruction in older assignments, status files, backlog entries, board snapshots, prompts and coordination decisions. In particular, it overrides any instruction to create a branch after each task/PR, continue by opening another PR, run tests after each small change, or create test-only branches/PRs. The coordinator must assign work within these limits; agent autonomy never overrides them.

## 1. Ten agents share five branch slots

- There are ten agents, but **the entire team shares a maximum of five active non-main working branches**. This is five total, not five per agent.
- `main` is the protected baseline and is not counted as a working branch.
- The five-slot cap includes feature, coordinator, integration, QA, safety-review, documentation, hotfix, experiment and any other working branch. There are no exceptions for urgency, agent count, stacked work or testing.
- **Never create a branch for a test, a test of a test, a benchmark, a tiny task, or a separate PR-sized follow-up.** Testing does not get its own branch.
- Reuse the five existing working branches. Group related work into substantial, coherent changes. Retire and delete a branch before opening a replacement slot; do not exceed five even temporarily.
- The coordinator assigns branch slots. An agent without an assigned slot stays paused or performs only explicitly authorized read-only review. Two agents may share a slot only when the coordinator assigns it and their file ownership does not overlap.
- Closed or merged historical branches are frozen. They are not invitations to resume old work or create descendants. A frozen branch can only be reactivated by the coordinator after a working slot is available.
- Before any branch creation or reactivation, the coordinator checks the live branch list and records which of the five slots is being used. If five slots are occupied, branch creation stops.

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
- Combine related, authorized tasks into a small number of complete implementation slices on the five shared branches. Do not create a new branch or PR just because an AC number or agent changes.
- One task assignment must describe a meaningful product outcome, the owning branch slot, allowed files and expected integration point. Agents must not invent follow-on tasks or split one deliverable into artificial microtasks.
- Keep the existing single-writer file ownership rules. Branch/PR limits do not grant permission to edit another agent's files.
- The coordinator is responsible for sequencing the work, integrating the release and maintaining the live branch/PR budget. Agents must stop before any action that would breach a cap.

## 5. Release sequence and authority

1. Coordinator selects the product work required for the next user-visible release and assigns it to no more than five working branches.
2. Agents complete substantial, compatible work within those slots. No test runs or new test branches during this implementation phase.
3. The coordinator resolves the release-cohort PRs within the 50-PR ceiling and integrates the approved changes.
4. When the newest version is assembled and ready to ship, freeze implementation and dispatch the single consolidated final validation workflow on `main`.
5. If it passes, ship/deploy that version and record the release commit, deployment and final PR disposition. Only then may the coordinator ask the user to authorize a new release cycle.

**Default when uncertain: stop branch/PR creation, do not run tests, preserve existing work, and ask the coordinator.** No agent may interpret urgency or “keep going” as permission to exceed these hard limits.
