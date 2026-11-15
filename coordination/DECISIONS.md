# Art Club — current decisions

This file contains only decisions that govern current and future work. Historical decision logs and superseded AC/workstream instructions have been retired from the active coordination tree.

## Product and engineering

1. **Local-first product:** core editing must work in the browser without mandatory accounts, backend services or network access.
2. **Plain JavaScript:** do not introduce TypeScript.
3. **Canvas fidelity:** logical pixel cells stay square; operations use integer pixel coordinates and deterministic results.
4. **Real functionality only:** every visible control must perform its advertised action. No decorative fake controls or prototype behavior represented as production.
5. **Safe mutations:** validate before changing state. Failed, stale, clipped or denied operations must not partially modify artwork, history or persisted projects.
6. **Evidence honesty:** distinguish source inspection, design proposal, automated test, manual browser verification, deployment and live-site verification. Never claim one as another.

## Team and execution

7. **Role-based team:** ten agent sessions operate through UI Designer, UX Designer, Competitor Analyst, Coder 1, Coder 2, Verifier and Coordinator functions. The current role definitions in `TEAM_MODEL.md` replace the former AC-based numbered workstreams.
8. **Coordinator authority:** the coordinator owns priorities, assignments, file ownership, integration and release decisions. No agent expands its own scope.
9. **One writer per file:** parallel work is allowed only across disjoint files or interfaces explicitly separated by the coordinator.
10. **No new branches:** create no branch, fork, rename, restore or reactivate. The one pre-existing UI-02 branch is grandfathered only for its already-started work and is not reusable.
11. **No historic PR recovery:** do not reopen, restore, recreate, merge, close or audit old PRs, or recover deleted branches, unless the user explicitly asks.
12. **No per-task test loops:** do not run automated tests during each small implementation step. Use one consolidated release validation on `main` after integration, when the candidate is ready and explicitly authorized.
13. **Concise delivery:** report changed paths, commit, working behavior, limitations and blockers. Avoid repeated repository scans, redundant reports and process-only work.
14. **GitHub is shared storage, not a background runtime:** commits do not wake inactive agent chats. The user must resume an agent session for it to act.
