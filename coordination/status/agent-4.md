# Status — Agent 4

- **Current task:** D-028 read-only branch/PR dependency inventory for MCP/bridge PRs #8/#38/#54/#82/#86/#92 and historical bridge refs.
- **Status:** INVENTORY COMPLETE; no code, branch, PR-state or workflow changes. Only this status file updated.
- **Latest main:** `84a9d83a059f41f3b3d4e7f1f2e02bcfb67cbbfa` (GitHub `refs/heads/main`, fetched live).
- **Acceptance:** dependency graph, exact heads, direct parent deltas, main divergence, changed files, exact-head CI and ownership conflicts recorded below.
- **Local tests/commands:** no shell commands or local tests run; this session had GitHub API read access but no checkout/runtime. CI evidence below is fetched from GitHub Actions and is not a local test claim.

## Current assignment — 2026-11-15 branch hygiene

### 1. PR dependency inventory

All six PRs are open and draft. Their current PR metadata heads and base branches were fetched live. Direct parent comparisons use the exact declared parent head; cumulative main comparisons use current main `84a9d83a059f41f3b3d4e7f1f2e02bcfb67cbbfa`.

| PR | Branch / exact head | Base | Unique commits vs direct parent | Files changed by this PR vs parent | Cumulative vs current main | Current Actions |
|---|---|---|---:|---:|---:|---|
| [#8 AC-004](https://github.com/faiev/ArtClub/pull/8) | `agent/bridge-hardening` / `1a04d834ec3bb77610b4b83375ab89ce78720112` | `main` (PR base SHA `dc647d10708e6a8596a8ab7df5b37b311729c66f`) | 60 from merge-base; compare is diverged | 11 | 60 ahead / 75 behind; merge base `dc647d10708e6a8596a8ab7df5b37b311729c66f` | [#43622700035](https://github.com/faiev/ArtClub/actions/runs/43622700035): `test` failed; `browser-e2e` passed |
| [#38 AC-043](https://github.com/faiev/ArtClub/pull/38) | `agent/ac-043-operation-deadlines` / `8ab838fae2c83414af29f0cc7b4a72fd0122e46d` | `agent/bridge-hardening` | 27 | 7 | 87 ahead / 75 behind; same merge base | [#43622711281](https://github.com/faiev/ArtClub/actions/runs/43622711281): `test` failed; `browser-e2e` passed |
| [#54 AC-044](https://github.com/faiev/ArtClub/pull/54) | `agent/ac-044-profile-lock` / `5ad306cb282182415cc867f0c9f1582724993eb8` | `agent/ac-043-operation-deadlines` | 23 | 6 | 110 ahead / 75 behind; same merge base | [#43622747415](https://github.com/faiev/ArtClub/actions/runs/43622747415): `test` failed; `browser-e2e` passed |
| [#82 AC-045](https://github.com/faiev/ArtClub/pull/82) | `agent/ac-045-security-hardening` / `f3aa9d29397e85c39c60f323a5e4ba7306acec72` | `agent/ac-044-profile-lock` | 16 | 7 | 126 ahead / 75 behind; same merge base | [#43622756765](https://github.com/faiev/ArtClub/actions/runs/43622756765): `test` failed; `browser-e2e` passed |
| [#86 AC-046](https://github.com/faiev/ArtClub/pull/86) | `agent/ac-046-capability-contract` / `77cc76ca4b6d75dece3e38f8864f11dc33642055` | `agent/ac-045-security-hardening` | 4 | 8 | 130 ahead / 75 behind; same merge base | [#43622831950](https://github.com/faiev/ArtClub/actions/runs/43622831950): `test` failed; `browser-e2e` passed |
| [#92 AC-048](https://github.com/faiev/ArtClub/pull/92) | `agent/ac-048-resilience-observability` / `d059c6d60e639371102d9560660eff20c5fc97e3` | `agent/ac-046-capability-contract` | 14 | 11 | 144 ahead / 75 behind; same merge base | [#43631517622](https://github.com/faiev/ArtClub/actions/runs/43631517622): `test` failed; `browser-e2e` passed |

Direct parent graph verified by compare results:

`main → #8 (60 commits) → #38 (+27) → #54 (+23) → #82 (+16) → #86 (+4) → #92 (+14)`.

Every child comparison is `ahead` with `behind_by=0`; merge base equals the parent head. All six cumulative comparisons against current main are `diverged`, `behind_by=75`, and share merge base `dc647d10708e6a8596a8ab7df5b37b311729c66f`. Thus the child PRs are correctly stacked relative to one another, but the chain is stale relative to main. GitHub's `mergeable=true` on children is not evidence that the chain is ready to land; #8 itself reports `mergeable=false`.

### 2. Changed-file boundaries by direct PR delta

- **#8 (11):** `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/e2e-test.mjs`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/package.json`, `agent-bridge/server.mjs`, `index.html`, `js/agent-api.js`, `js/layer-edit-guard.js`, `tests/agent-api.test.js`, `tests/layer-edit-guard.test.js`.
- **#38 (7):** `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/operation-queue.mjs`, `agent-bridge/operation-queue.test.mjs`, `agent-bridge/package.json`, `agent-bridge/server.mjs`.
- **#54 (6):** `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/package.json`, `agent-bridge/profile-lock.mjs`, `agent-bridge/profile-lock.test.mjs`, `agent-bridge/server.mjs`.
- **#82 (7):** `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/package.json`, `agent-bridge/security-utils.mjs`, `agent-bridge/security-utils.test.mjs`, `agent-bridge/server.mjs`.
- **#86 (8):** `AGENT_API.md`, `agent-bridge/README.md`, `agent-bridge/capabilities.mjs`, `agent-bridge/capabilities.test.mjs`, `agent-bridge/fixtures/capabilities-v1.json`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/package.json`, `agent-bridge/server.mjs`.
- **#92 (11):** `agent-bridge/README.md`, `agent-bridge/bridge-observability.mjs`, `agent-bridge/bridge-observability.test.mjs`, `agent-bridge/capabilities.mjs`, `agent-bridge/capabilities.test.mjs`, `agent-bridge/fixtures/capabilities-v1.json`, `agent-bridge/mcp-e2e-test.mjs`, `agent-bridge/operation-queue.mjs`, `agent-bridge/operation-queue.test.mjs`, `agent-bridge/package.json`, `agent-bridge/server.mjs`.

### 3. Exact-head CI and failure evidence

The current head SHAs above exactly match the `head_sha` reported by the corresponding GitHub Actions runs. In every fetched run, the `browser-e2e` job completed successfully and the `test` job failed at the step `Run model and editor interaction tests`. Run IDs and exact heads are in the table. The run/job metadata endpoint exposed job conclusions and step names, but not the step's assertion log text in this session; no individual failing assertion names are inferred here.

PR #82's current description records five inherited failures in Agent 6-owned `tests/safe-edit-conformance.test.js` and `tests/safe-edit-operations.test.js`; it explicitly states its own changed-file set does not include those files. The same failed `test` job continues through #86 and #92, while their browser jobs pass. Treat this as a known inherited parent-chain CI blocker pending a fresh exact-head full-suite run and Agent 6/coordinator diagnosis—not as an Agent 4 implementation failure or a verified root-cause log. Exact run URLs: #8 `43622700035`, #38 `43622711281`, #54 `43622747415`, #82 `43622756765`, #86 `43622831950`, #92 `43631517622`.

### 4. Cross-agent conflicts and shared-file locks

- **Confirmed Agent 6 ownership conflict in #8 ancestry:** fetched PR #8 patch explicitly removes from `js/layer-edit-guard.js` the `LAYER_ZERO_OPACITY`, revision-context, selection-validation and related metadata guards, and removes the corresponding regression tests from `tests/layer-edit-guard.test.js` (including zero-opacity, malformed opacity/metadata, frame metadata, stale project/frame/composite revisions, invalid selections and canvas-limit tests). The current branch is 75 commits behind main, so this stale snapshot would conflict with/revert newer safety work unless reconciled carefully. Both paths are Agent 6-owned under current board exclusions. Agent 4 did not edit either file.
- **Agent 4 shared E2E lock:** #8 changes `agent-bridge/e2e-test.mjs`, the file Agent 4 is sole writer of while reconciling #8. No other agent ownership was found for the file; however this current assignment is read-only, so no change was made.
- **Production UI/API lock:** #8's cumulative diff also contains `index.html` and `js/agent-api.js`. These are inherited historical changes, not authorized new work under D-028. Current coordinator owns production UI; no edit or branch sync was attempted.
- #38/#54/#82/#86/#92 direct deltas stay within bridge files and bridge documentation. They inherit #8's older ancestry and its cross-agent/UI diff until the parent is reconciled.

### 5. Historical bridge-related refs

- Branch search found `agent/bridge-hardening` (the #8 head branch) and `agent/ac-047-export-pixel-adapters` (no open PR found by head-branch search).
- `agent/ac-047-export-pixel-adapters` compares **identical** to PR #86 head `77cc76ca4b6d75dece3e38f8864f11dc33642055` (0 ahead / 0 behind, no unique files/commits). It is a redundant alias ref, not an additional deliverable. Candidate for coordinator review as a redundant branch only after confirming no external consumer; not deleted.
- The other bridge phase refs correspond to the six open PR branches in the table. No branch was deleted, moved or force-pushed.

### 6. Disposition recommendation (coordinator decision only)

| PR / ref | Recommendation | Rationale |
|---|---|---|
| #8 | **Retain parked; reconcile before any merge decision** | Parent for all descendants; 60 unique commits but 75 behind main; `mergeable=false`; includes stale Agent 6 guard/test removals and inherited `index.html`/Agent API changes. Do not close while descendants depend on it. |
| #38 | **Retain parked as required parent** | 27 unique bridge commits on #8; exact-head test job fails; do not merge before #8 and full CI. |
| #54 | **Retain parked as required parent** | 23 unique profile-lock commits on #38; exact-head test job fails; no independent main merge path. |
| #82 | **Retain parked as required parent** | 16 unique security commits on #54; five inherited Agent 6 safe-edit assertions reported failing; exact-head test job fails. |
| #86 | **Retain parked as required parent** | 4 unique capability-contract commits on #82; exact-head test job fails; #92 depends on it. |
| #92 | **Retain parked as leaf candidate** | 14 unique observability commits on #86; exact-head test job fails; no listed downstream PR. Do not close without coordinator's disposition decision. |
| `agent/ac-047-export-pixel-adapters` | **Redundant-ref candidate for coordinator review** | Identical to #86 head, no PR, no unique commits/files. Preserve pending coordinator confirmation; no delete action available/attempted. |

### 7. Commands, evidence and execution boundary

- **Shell commands executed:** none. No repository checkout or local runtime was available.
- **Read-only GitHub operations executed:** fetched repository metadata and `refs/heads/main`; fetched `coordination/BOARD.md`, `coordination/assignments/agent-4.md` and this status file; fetched PR metadata for #8/#38/#54/#82/#86/#92; compared each head with its direct parent and current main; fetched exact-head Actions workflow-run/job metadata; searched bridge-related branches and PR head references; fetched PR #8 patch to inspect ownership conflicts.
- **Changed files:** only `coordination/status/agent-4.md` (this report). No production files, tests, workflows, branches or PR states changed.
- **Status commit:** recorded by the GitHub update-file operation after this report is written; verify the returned commit SHA before reporting it.
- **CI evidence:** the six linked GitHub Actions runs are exact-head evidence, all browser-e2e passed and all `test` jobs failed. No local tests were run.

### 8. Unresolved blockers / next actions

1. Coordinator + Agent 6 must reconcile the stale Agent 6 guard/test changes in #8 against current main without losing accepted safe-edit behavior.
2. Coordinator must decide whether/how to rebase or otherwise reconcile the 75-commit main divergence while preserving the six-PR parent chain; Agent 4 made no ref changes.
3. Obtain full failing test logs for the `test` job on #92 (and preferably #8/#82) to identify exact five inherited assertions; current job metadata only proves failed step, and PR #82 description supplies the five-failure report.
4. After parent reconciliation, rerun complete exact-head CI sequentially through the stack; browser-e2e green alone is not sufficient.
5. Coordinator reviews the redundant `agent/ac-047-export-pixel-adapters` ref and makes any retain/delete decision; no deletion is authorized here.

---

## Historical report — PR #96 persistence/recovery review


## 1. Files and functions inspected

At PR head `7071f9550f94f413f4dd414416a804079ee179c4`:
- `index.html`: `loadProjectIntoEditor()`, `restore()`, `remember()`, `commitSafeEditResult()`, `runSafeClear()`, `saveCurrentProject()`, `persistNow()`, `scheduleSave()`, `openProjectLibrary()`, project-library rename/recover handlers, and calls to `getProject()` / `getRecovery()` / `saveProject()`.
- `js/project-storage.js`: `ProjectStorage.prototype.saveProject()`, `getProject()`, `getRecovery()`, `clearRecovery()`, `deleteProject()`, `sameProjectContent()`, IndexedDB transaction helpers.
- `js/project-model.js`: project schema, `cloneProject()`, `deserializeProject()`, metadata shape and validation.
- `tests/project-storage.test.js`: existing in-memory IndexedDB test double and recovery rotation/no-op test.

Coordination documents read from main:
- `coordination/README.md`, `BOARD.md`, `BACKLOG.md`, `DECISIONS.md`
- `coordination/assignments/agent-4.md`, `coordination/status/agent-4.md`, `coordination/status/agent-6.md`

## 2. Current save and recovery lifecycle

- The editor maintains `projectDoc` plus a separate active pixel buffer. `documentRevision` is an in-tab UI/edit-target counter; `safeEditBusy` and `persistInFlight` coordinate work only within that page.
- `scheduleSave()` increments `documentRevision`, debounces 280 ms, then calls `persistNow()`. `persistNow()` calls `saveCurrentProject()`; with project storage enabled that invokes `projectStorage.saveProject(doc)`.
- `commitSafeEditResult()` waits for the current page's `persistInFlight`, validates the captured in-memory project/layer/frame/revision target, then calls `saveProject(nextProject)`. After persistence it calls `remember()`, publishes via `loadProjectIntoEditor()`, increments `documentRevision`, and writes the local backup.
- `ProjectStorage.saveProject()` opens one IndexedDB read-write transaction over both `projects` and `recovery`, reads the current project, compares content (ignoring `metadata.updatedAt`), and either no-ops or puts the previous primary into RECOVERY and the candidate into PROJECTS. The two store writes are transactionally grouped.
- Project Library recovery reads RECOVERY and calls ordinary `saveProject(previous.project)`, then publishes it if that project is active. Rename also calls ordinary `saveProject()`.
- The storage record has timestamps but no explicit per-project revision/CAS token. The project model has no storage revision field. `updatedAt` is not currently used as an expected-version precondition.

## 3. Root cause of P1 — stale cross-tab writes

The IndexedDB read-write transaction serializes competing writes, but `saveProject()` is last-writer-wins: it reads the latest record only to decide recovery rotation, then unconditionally writes the supplied candidate. It does not verify that the candidate was based on the version just read.

Example: tabs A and B both load V0. B saves V1. A later saves its V0-derived candidate. A's transaction reads V1, rotates V1 to RECOVERY, and overwrites PROJECTS with stale A. Transaction atomicity prevents torn writes, not lost updates.

The UI `documentRevision` is page-local and cannot detect B's edits. No Web Locks, BroadcastChannel, storage-event coordination, or shared cross-tab revision token was found in the inspected production save/storage path. A broadcast/lock alone would not be sufficient as the authoritative integrity boundary.

## 4. Root cause of P2 — rollback rotates recovery incorrectly

After `saveProject(nextProject)` commits, `remember()` / `loadProjectIntoEditor()` / rendering or later publication work can throw. The catch path calls `saveProject(previousProject)`.

That rollback is treated as a new ordinary save. Since the current primary is now the rejected candidate, storage rotates that candidate into RECOVERY, writes the previous in-memory project as primary, and overwrites the pre-attempt recovery snapshot. It can also overwrite another tab's newer primary because rollback has no expected-current-version check. The in-memory `previousProject` is not a sufficient storage rollback receipt: it does not preserve the exact prior RECOVERY record.

## 5. Recommended minimal fix

Use IndexedDB as the authoritative cross-tab compare-and-swap boundary; retain the existing transaction over PROJECTS + RECOVERY.

**A. Add a persisted per-project revision.**
- Add integer `revision` to each PROJECTS record (not to the user-facing project document); legacy records with no revision are treated as revision 0 on first read.
- A read API returns a snapshot `{ project, revision }` (or equivalent). Keep that storage revision in the editor's persistence state, separate from `documentRevision`.
- Every update to an existing project must pass `expectedRevision`. Inside the same read-write transaction, read the record and compare the current revision with the expected revision before any PROJECTS or RECOVERY write. On mismatch, abort/reject with a typed conflict error and perform zero writes. On success, increment revision and write the candidate plus normal previous-primary recovery rotation atomically.
- A new project uses an explicit create-if-absent precondition. Do not silently fall back to unconditional overwrite when the token is absent.
- Route autosave, safe edit, rename, recovery and any other existing-project writer through this contract. A single guarded safe-edit callsite is insufficient if ordinary autosave or recovery remains unconditional.
- On conflict, do not publish the candidate; surface a reload/reopen conflict message. Do not auto-retry a stale candidate against the newly read revision.

**B. Return a storage rollback receipt and add a non-rotating conditional restore.**
- A successful CAS save returns an opaque receipt containing the exact previous primary record, exact previous RECOVERY record (including absence), and the revision/token assigned to the committed candidate. Capture these values inside the same transaction that performs the save.
- If post-persist publication fails, call a dedicated `rollbackProjectCommit(receipt)`, not `saveProject(previousProject)`.
- In one PROJECTS + RECOVERY read-write transaction, verify that the current primary is still exactly the receipt's committed revision/token. If it is not, refuse rollback and report a concurrent-change/rollback-conflict error; never overwrite a newer tab.
- If it matches, restore the exact previous primary and exact previous RECOVERY record (or delete RECOVERY if it was absent), without running normal recovery rotation. This makes rollback restore both stores byte-for-byte to their pre-commit state.
- The UI rollback should use the receipt, not a reconstructed in-memory project. If rollback cannot be safely applied, retain the current committed state, report the failure, and provide export/reload guidance rather than performing an unconditional write.

This is the smallest safe change that uses the existing IndexedDB transaction mechanism, avoids a new cross-tab messaging dependency, and gives rollback enough information to preserve the one-step recovery contract. Web Locks/BroadcastChannel can be added later for UX/serialization, but they are not substitutes for CAS.

## 6. Alternatives considered and rejected

- **Web Locks only:** optional support/coordination and not an authoritative persisted precondition; does not protect writers that do not acquire the same lock.
- **BroadcastChannel or storage events only:** notifications can be delayed/missed and cannot atomically compare-and-write with IndexedDB.
- **Reuse `documentRevision`:** it is page-local, changes for UI interactions, and is not persisted/shared across tabs.
- **Use `updatedAt` as the sole version token:** timestamp precision/collision and existing no-op behavior make it a weaker, implicit concurrency contract. Add an explicit monotonic record revision.
- **Rollback through ordinary `saveProject(previousProject)`:** explicitly rejected; it rotates RECOVERY and can clobber a newer primary.
- **Move publication before persistence:** changes the established persist-before-publish safety contract and still needs a well-defined rollback boundary; not the smallest change.

## 7. Exact acceptance criteria

1. Every existing-project save is conditional on the revision the caller actually loaded/last successfully committed; no writer silently performs last-writer-wins.
2. The expected-revision comparison and primary/recovery writes occur in the same IndexedDB read-write transaction.
3. A revision mismatch rejects before any primary or recovery mutation.
4. Two tabs saving from the same revision produce exactly one winner; the loser is rejected and cannot rotate the winner into RECOVERY.
5. A successful normal commit rotates exactly the previous primary into RECOVERY once.
6. A post-persist publication failure restores the exact previous primary and exact previous RECOVERY contents/absence.
7. Rollback is conditional on the exact committed revision/token and cannot overwrite a later tab's save.
8. Rejected candidates never become RECOVERY snapshots.
9. Existing no-op save semantics remain: metadata-only/no-content changes do not rotate recovery or spuriously increment content revision.
10. Legacy records remain readable and receive a deterministic initial revision; all active write paths are migrated to the guarded API.
11. Conflict and rollback-conflict errors are distinguishable from storage-unavailable errors and are shown to the user without claiming the candidate was saved.

## 8. Deterministic regression-test plan

Use real Chromium with two browser contexts sharing the same origin and IndexedDB database for cross-tab tests. Use explicit deferred promises/fault injection at the storage/publication seam; no sleeps.

- **CAS-01 — simultaneous same-base saves:** seed V0/recovery R. Load V0 in A and B. Pause both immediately before the IndexedDB compare/write transaction; release both. Assert exactly one succeeds, the other gets conflict, primary equals the winner, and RECOVERY equals V0 (not the rejected candidate). Assert no loser publication/undo.
- **CAS-02 — stale tab:** A and B load revision N. B saves V1 and receives N+1. A attempts a V0-derived candidate with N. Assert typed conflict, primary remains V1 byte-for-byte, RECOVERY remains its pre-A value byte-for-byte, and A does not publish or enqueue another autosave.
- **ROLLBACK-01 — post-persist publication fault:** seed primary P and recovery R. Commit candidate C with expected revision N and capture receipt. Inject a deterministic throw after persistence and before/inside publication. Invoke rollback with receipt. Assert primary P and RECOVERY R byte-for-byte; editor project JSON/pixels and history remain at pre-attempt state.
- **ROLLBACK-02 — rollback must not clobber a newer writer:** commit C and pause before simulated publication failure/rollback; another context writes a later valid version using the new revision. Resume rollback. Assert rollback refuses due to revision mismatch and leaves the newer primary and recovery untouched.
- **RECOVERY-01 — rejected candidate isolation:** cause a CAS conflict for candidate X. Assert X appears in neither primary nor RECOVERY, and prior recovery R is unchanged.
- **CONTROL-01 — successful commit/no-op:** a valid save moves prior primary P to RECOVERY exactly once and increments revision; a no-op save preserves both revision and RECOVERY.

Existing `tests/project-storage.test.js` is a useful fast contract test, but its current memory IndexedDB double does not model true transaction scheduling/rollback. Add deterministic storage-level tests with a transaction-capable fake, then use the real-browser shared-origin tests as acceptance evidence.

## 9. Risks, compatibility concerns, unresolved questions

- Audit every `saveProject()` caller before making expectedRevision mandatory: autosave, safe edit, project rename, recovery, import/new-project and any bridge/API writer. A single legacy unconditional caller reopens the lost-update path.
- Decide whether recovery itself should be modeled as a new commit based on the current primary revision; recommendation: yes, CAS against the revision read when Recover was requested.
- If `saveCurrentProject()` writes local backup before IndexedDB CAS, a conflict can leave local backup reflecting a rejected candidate. The implementation must either delay backup publication until CAS succeeds or restore/preserve the prior backup on conflict.
- Recovery receipts must preserve absence as well as exact record contents; do not represent missing RECOVERY as an empty project.
- IndexedDB transaction callbacks must remain synchronous with respect to transaction lifetime; do not await arbitrary promises inside an open transaction. Keep get/compare/put work in request callbacks.
- Decide how a tab refreshes its revision after successful autosave and how external commits are surfaced. A lightweight BroadcastChannel/storage event may improve stale-tab UX, but correctness must still come from CAS.
- The editor currently has a project model document `metadata.updatedAt` but no concurrency revision. Keep storage revision out of the portable project schema unless a separate migration decision is made.

## 10. Exact commit SHA inspected

`7071f9550f94f413f4dd414416a804079ee179c4` (PR #96 head; verified via PR metadata).

---

**Execution limitation:** source/coordination review only. No checkout was available to run tests. No test is reported as passed.