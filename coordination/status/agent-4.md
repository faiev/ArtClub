# Status — Agent 4

- **Current task:** Coordinator-requested read-only dependency review for PR #96 (D-028).
- **Status:** INVESTIGATION COMPLETE — actionable P1/P2 design prepared; no production files changed and no tests claimed.
- **PR #96:** [UI-02A safe active-cel/selection Clear](https://github.com/faiev/ArtClub/pull/96), open/draft.
- **Exact PR head inspected:** `7071f9550f94f413f4dd414416a804079ee179c4`.
- **Branch:** `coordinator/ui-02a-safe-clear`; head matches the requested SHA.
- **Scope:** read-only source and coordination review. No branch, code, workflow, Agent 1, or Agent 6 files modified. Only this Agent 4 status file and a concise PR discussion handoff are being updated.
- **Tests:** NOT RUN. This execution environment has GitHub source access but no repository checkout/runtime; no test pass is claimed.

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