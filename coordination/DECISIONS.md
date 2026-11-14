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
All application code belongs on the worker's dedicated feature branch. Never commit application code directly to main. Open a PR for review. Workers do not merge their own PRs. Coordination metadata is separate: during bootstrap, workers update only their own status file on `coordination/orchestration-v2`; after PR #7 merges, they update only their own status file on `main`.

## D-006 — Single-writer ownership
Only one agent edits a shared file at a time. Agent 2 owns renderer/benchmark files; Agent 3 owns GIF/sprite-sheet exporter files; Agent 4 owns bridge/API files; Agent 5 owns its assigned planning document. No UI/API integration is authorized without a coordinator-issued file lock.

## D-007 — Pixel fidelity
Preserve exact pixel colors and integer boundaries. Do not introduce smoothing/interpolation into artwork, transforms or exports. UI overlays must not enter exported artwork unless requested.

## D-008 — Evidence before claims
Separate unit tests with mocks, real browser tests, CI, benchmark measurements, PR review, merge and integration. A browser benchmark page is not proof of a speedup until it has been run. A module is not integrated just because it exists.

## D-009 — Tasks have a testable finish line
Every assignment contains a concrete user problem, exact acceptance criteria, allowed files, required tests, dependencies and explicit handoff. No worker should be left with a vague task or an indefinite wait instruction.

## D-010 — Ten-agent team and isolated work packages
The team may have ten worker chats plus one coordinator. Agents 6–10 own isolated modules/diagnostic tools as defined in BOARD.md. They must not edit shared UI, storage, renderer, project model or Agent API files unless a later assignment grants a specific file lock.

## D-011 — Module-first feature development
Where integration would collide with another active worker, deliver a tested, documented module with a clear integration contract first. Mark it as an isolated deliverable, not a shipped user-facing feature. The coordinator schedules integration after review.

## D-012 — Keep exports and pixel algorithms deterministic
Palette import/export, tiled preview, pixel effects and project inspection must be deterministic, bounded, local-only and independently tested. No network dependencies or silent data mutation.

## D-013 — Single writer for browser E2E
After PR #10 merged, Agent 4 is the sole worker authorized to edit `agent-bridge/e2e-test.mjs` while reconciling PR #8. Agent 1's AC-025 comparison of PR #1 is read-only. Preserve PR #10's recovery regression and rerun `npm run test:e2e` and `npm run test:mcp` after any combined E2E changes. No second worker edits the file without a new coordinator lock.

## D-014 — Revalidate after base-branch changes
A passing CI run is evidence for the exact commit SHA tested, not all future branch heads. When main changes or a PR branch is updated, re-check the head SHA and run the required test suite on the resulting commit before merging. A previously known baseline failure may be reclassified only after the fix is present on the tested base and the new run confirms it.
