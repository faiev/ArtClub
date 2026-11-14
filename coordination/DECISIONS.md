# Art Club coordination decisions

The coordinator owns this log. All workers must follow these decisions unless a later decision explicitly supersedes one.

## D-001 — Keep static and local-first
Art Club remains deployable on GitHub Pages. Do not add a mandatory backend, paid service, login, account, API key or phone-number verification for core editor use. The local MCP bridge is optional.

## D-002 — Plain JavaScript
Use plain JavaScript, not TypeScript. Avoid build tooling unless a task gives a concrete, approved reason.

## D-003 — GitHub is shared state, not an autonomous runtime
GitHub coordinates assignments, status, dependencies and handoffs. A file change does not wake a ChatGPT chat or deliver a message to another chat. The user/coordinator must send a resume prompt.

## D-004 — Agents should not idle behind unrelated PRs
A worker continues independent work while an earlier PR is under review. Only a real dependency or same-file edit conflict should stop work. If blocked on one file, continue tests, documentation, isolated modules or other non-conflicting acceptance criteria.

## D-005 — Branch and PR policy
All application code belongs on a worker's dedicated feature branch. Never commit application code directly to main. Open a PR for review. Workers do not merge their own PRs. Each worker may create additional clearly named feature branches for the next authorized deliverables. Workers update only their own status file on main.

## D-006 — Single-writer ownership
Only one agent edits a shared file at a time. Agent 2 owns renderer/browser validation and viewport files; Agent 3 owns GIF/sprite-sheet exporter files and the project-test workflow for AC-027 sprite-sheet browser verification; Agent 4 owns bridge/API files. No UI/API integration is authorized without a coordinator-issued file lock.

## D-007 — Pixel fidelity
Preserve exact pixel colors and integer boundaries. Do not introduce smoothing/interpolation into artwork, transforms or exports. UI overlays must not enter exported artwork unless requested.

## D-008 — Evidence before claims
Separate unit tests with mocks, real browser tests, CI, benchmark measurements, PR review, merge and integration. A browser benchmark page is not proof of a speedup until it has been run. A module is not integrated just because it exists.

## D-009 — Tasks have a testable finish line
Every assigned phase contains a concrete user problem, exact acceptance criteria, allowed files, required tests and handoff evidence. Assignments may contain multiple pre-authorized phases in one workstream.

## D-010 — Ten-agent team and isolated work packages
The team may have ten worker chats plus one coordinator. Agents 6–10 own isolated modules/diagnostic tools as defined in BOARD.md. They must not edit shared UI, storage, renderer, project model or Agent API files unless a later assignment grants a specific file lock.

## D-011 — Module-first feature development
Where integration would collide with another active worker, deliver a tested, documented module with a clear integration contract first. Mark it as an isolated deliverable, not a shipped user-facing feature. The coordinator schedules integration after review.

## D-012 — Keep exports and pixel algorithms deterministic
Palette import/export, tiled preview, pixel effects and project inspection must be deterministic, bounded, local-only and independently tested. No network dependencies or silent data mutation.

## D-013 — Single writer for browser E2E
Agent 4 is the sole worker authorized to edit the shared bridge browser E2E file while reconciling PR #8. Agent 1's PR #1 review is read-only. Preserve PR #10's recovery regression and rerun browser/MCP checks after combined changes.

## D-014 — Revalidate after base-branch changes
A passing CI run is evidence for the exact commit SHA tested, not all future branch heads. When main changes or a PR branch is updated, re-check the head SHA and run required tests on the resulting commit before merging.

## D-015 — Continuous multi-phase workstreams
Every agent receives a ranked queue of multiple substantial deliverables. Opening a PR is a checkpoint, not a stop condition. After submitting a coherent deliverable, the agent must continue to the next unfinished, unblocked item already authorized in its assignment. Agents do not need coordinator approval between phases in that queue. Keep each PR narrow; use separate branches/PRs for independent follow-on deliverables.

## D-016 — No idle-on-review rule
A PR awaiting review, merge or CI does not block unrelated work. While waiting, the worker continues another authorized module, tests, fixtures, documentation, browser harness, compatibility matrix, security audit or integration adapter within its file scope. Only pause when a genuine shared-file conflict or external decision prevents every useful action.

## D-017 — Rolling status queue
Every worker status file must list the active phase, current branch/head, PR/CI evidence, completed phases, the next 3–5 authorized actions and exact blockers. Update the status after each substantial deliverable and before switching to a new branch. Keep it concise and factual.

## D-018 — Autonomous scope boundary
The coordinator pre-authorizes the phases written in each assignment. Workers may choose the next unfinished item in that assigned list without asking. They may not self-assign unrelated roadmap items, alter shared-file locks, change product architecture, merge PRs or widen scope beyond the assignment.

## D-019 — No background execution claim
The GitHub coordination system is shared memory, not a scheduler. It cannot wake an idle ChatGPT chat or make a worker run between user prompts. Continuous workstreams reduce the number of prompts needed, but a new user resume message is still needed to start a chat that is inactive.

## D-020 — Release shared locks when the blocking PR merges
The PR #11 project-test workflow changes are merged. Agent 3 retains the workflow writer lock only for the assigned AC-027 sprite-sheet browser verification/CI wiring; Agent 2 must not edit the workflow until Agent 3 records the lock release. The bridge E2E lock remains with Agent 4 while PR #8 is reconciled.
