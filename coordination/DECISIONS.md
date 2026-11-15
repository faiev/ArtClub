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

## D-021 — Coordinator extension queues
On 2026-11-14 the coordinator appended AC-087 through AC-096, one follow-on phase to each of the ten workstreams. These phases are pre-authorized after the corresponding agent's existing queue; they do not cancel unfinished phases, loosen file ownership or grant shared-file locks.

## D-022 — UX prototype is not production UI authorization
Agent 5's AC-091 may create a self-contained, interactive prototype and design system under `docs/ux/**`. It must be labelled non-production and must not edit `index.html`, production CSS/JS or application tests. Production UI ownership remains with the coordinator and will be issued as a separate, explicit lock.

## D-023 — Keep renderer and exporter integration evidence separate
Agent 2's AC-088 must distinguish the live editor's DOM-grid performance from isolated Canvas renderer measurements. Agent 3's AC-089 may add cooperative async cancellation/progress to exporter APIs but must not duplicate bridge request-deadline behavior owned by Agent 4. No renderer/exporter UI integration is implied.

## D-024 — Status files must catch up with submitted PRs
Several status files lag the open PR inventory. On each resume, the owner must reconcile their own status with every submitted phase/PR, exact current head, parent dependency, tested SHA, CI result and remaining limitation before starting the next phase. The coordinator updates the board from both status files and PR evidence, but does not overwrite worker-owned status files.

## D-025 — Workflow and bridge E2E locks remain explicit
Agent 3 retains the project workflow lock only for AC-027 sprite-sheet browser verification/CI wiring and must explicitly release it when complete. Agent 4 remains sole writer of the shared bridge browser E2E file while PR #8 is reconciled. No other agent may infer these locks have expired from later independent PRs.


## D-026 — Accept the AC-091 visual direction, not the incomplete prototype handoff

On 2026-11-14 the coordinator reviewed Agent 5's graphite/olive design system and workstation prototype source. The visual direction is approved as the basis for UI-01: compact creative-workstation hierarchy, canvas-first center, restrained graphite surfaces, muted olive selection, warm visible focus, precise separators and reduced promotional chrome.

This is **directional approval only**. PR #77 remains draft and UI-00 is not fully accepted: its branch/status metadata is stale, screenshot references are unresolved, and the reviewed prototype still has documented accessibility/tool limitations. Agent 5 remains restricted to `docs/ux/**`; no production-file authority is granted.

The coordinator may proceed with narrow production UI slices that preserve existing live DOM controls, command handlers, renderer, project model and persistence. Do not port prototype-only behavior or represent unavailable commands as working controls. The first production slice is UI-01, tracked in coordinator-owned PR #84. Its exact-head browser regression and reviewer gates must pass before merge.


## D-027 — UI-02 production safety integration takes release priority

On 2026-11-15, UI-01 is confirmed merged and its merge commit's GitHub Pages deployment succeeded. The next user-visible milestone is UI-02: guarded active-cel/selection Clear, staged asynchronous image import with target revalidation, and atomic selection paste/replace, with real Chromium denial and immutability coverage.

The safe-edit helper modules remain isolated until integrated. The coordinator is sole writer of index.html and production UI; Agent 1 owns QA-only paths, Agent 6 supplies safety modules/review, and Agent 5 supplies design/accessibility guidance. No project model/storage, Agent API/bridge or workflow ownership is implicitly transferred.

New isolated feature expansion under AC-087–096 is paused as a team priority while UI-02 release gates are active. Existing PRs may be reconciled, exact-head tested and reviewed when parent dependencies and scope are clear. Do not self-merge or bypass exact-head CI. GitHub assignment changes do not wake inactive agent chats.


## D-028 — Product-delivery reset (2026-11-15)

The previous multi-agent workstream model generated excessive branches, open PRs and isolated modules without a matching rate of production feature delivery. Effective immediately, UI-02 is the sole active release lane. New isolated AC feature expansion is paused. Agent 1 is limited to UI-02 QA paths; Agent 6 is limited to read-only safety review and its owned harness; all other agents pause new feature branches/PRs and perform no work unless the coordinator requests a specific dependency review. The coordinator owns the production UI integration and runs one vertical slice at a time. Existing branches/PRs are preserved until individually classified; no bulk destructive cleanup. Product progress is counted only after browser-tested production integration, merge, successful deployment and live verification. This decision supersedes D-015, D-016, D-018 and D-021 where they encourage parallel feature expansion during this release; ownership boundaries and test/quality requirements remain in force.


## D-029 — Five-branch, fifty-PR and single release-validation policy (2026-11-15)

The user has replaced the previous high-parallelism, per-task testing model. All ten agents share at most five active non-main working branches total. The active release cohort is capped at 50 open PRs total; once the cap is reached, PR creation remains frozen until the entire cohort has a recorded final disposition and the newer version is released/deployed. No branch or PR may be created solely for testing or test-runner validation. Automated test execution is deferred until all approved release work is integrated and the newest candidate is ready to ship; then the coordinator may dispatch one consolidated final validation workflow on main. The main test workflow is manual-dispatch only. A failed final gate blocks release; another full run requires explicit authorization.

This decision supersedes D-005, D-009, D-015, D-016, D-018, D-020, D-021, D-024, D-025 and D-028 wherever they authorize additional branches/PRs or repeated per-task tests. Existing file ownership, technical safety constraints and accurate reporting remain in force unless they conflict with this decision. The full operational rules and release sequence are in `coordination/ORCHESTRATION_POLICY.md`.
