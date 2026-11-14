/*!
 * One Pixel Studio — local project storage
 * IndexedDB-backed project library with one-step recovery snapshots.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const DATABASE_NAME = "one-pixel-studio";
  const DATABASE_VERSION = 1;
  const PROJECTS = "projects";
  const RECOVERY = "recovery";

  function requestResult(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB request failed.")); };
    });
  }

  function transactionResult(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(transaction.error || new Error("IndexedDB transaction failed.")); };
      transaction.onabort = function () { reject(transaction.error || new Error("IndexedDB transaction was aborted.")); };
    });
  }

  function openDatabase(indexedDBFactory) {
    if (!indexedDBFactory || typeof indexedDBFactory.open !== "function") {
      return Promise.reject(new Error("This browser does not support IndexedDB. Export your project as JSON to keep a portable backup."));
    }
    return new Promise(function (resolve, reject) {
      let request;
      try { request = indexedDBFactory.open(DATABASE_NAME, DATABASE_VERSION); }
      catch (error) { reject(error); return; }

      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECTS)) {
          const store = db.createObjectStore(PROJECTS, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(RECOVERY)) {
          db.createObjectStore(RECOVERY, { keyPath: "projectId" });
        }
      };
      request.onsuccess = function () {
        const db = request.result;
        db.onversionchange = function () { db.close(); };
        resolve(db);
      };
      request.onerror = function () { reject(request.error || new Error("Could not open the local project database.")); };
      request.onblocked = function () { reject(new Error("The project database is busy in another tab. Close other Art Club tabs and try again.")); };
    });
  }

  function sameProjectContent(projectModel, left, right) {
    const current = projectModel.cloneProject(left);
    const previous = projectModel.cloneProject(right);
    if (current.metadata) delete current.metadata.updatedAt;
    if (previous.metadata) delete previous.metadata.updatedAt;
    return JSON.stringify(current) === JSON.stringify(previous);
  }

  function ProjectStorage(db, projectModel) {
    this.db = db;
    this.model = projectModel;
    // A token is learned only by reading the current record in this tab.
    // It is deliberately not shared between tabs: stale tabs must conflict.
    this.revisions = new Map();
    this.rollbackReceipts = new WeakMap();
  }

  function revisionOf(record) {
    return record && Number.isSafeInteger(record.revision) ? record.revision : 0;
  }

  function revisionTokenOf(record) {
    return {
      revision: revisionOf(record),
      commitToken: record && typeof record.commitToken === "string" ? record.commitToken : null
    };
  }

  function conflictError(projectId, expected, actual) {
    const error = new Error("This project was saved in another tab. Reload it before saving again.");
    error.name = "ProjectRevisionConflictError";
    error.code = "PROJECT_REVISION_CONFLICT";
    error.projectId = projectId;
    error.expectedRevision = expected;
    error.actualRevision = actual;
    return error;
  }

  ProjectStorage.open = async function (options) {
    options = options || {};
    const model = options.projectModel || root.ArtClubProject;
    if (!model) throw new Error("The project model must be loaded before project storage.");
    const db = await openDatabase(options.indexedDB || root.indexedDB);
    return new ProjectStorage(db, model);
  };

  let commitSequence = 0;
  function newCommitToken() {
    const cryptoObject = root && root.crypto;
    if (cryptoObject && typeof cryptoObject.randomUUID === "function") return cryptoObject.randomUUID();
    commitSequence += 1;
    return String(Date.now()) + ":" + String(commitSequence) + ":" + String(Math.random()).slice(2);
  }

  ProjectStorage.prototype.saveProject = async function (project, expectedRevision) {
    const copy = this.model.cloneProject(project);
    const now = new Date().toISOString();
    copy.metadata = copy.metadata || {};
    copy.metadata.updatedAt = now;
    const record = {
      id: copy.id,
      name: copy.name,
      width: copy.canvas.width,
      height: copy.canvas.height,
      updatedAt: now,
      createdAt: copy.metadata.createdAt || now,
      data: copy
    };

    const cachedToken = this.revisions.get(copy.id) || { revision: 0, commitToken: null };
    const expected = Number.isSafeInteger(expectedRevision) ? expectedRevision : cachedToken.revision;
    const expectedCommitToken = expected === cachedToken.revision ? cachedToken.commitToken : null;
    if (!Number.isSafeInteger(expected) || expected < 0) {
      throw new TypeError("expectedRevision must be a non-negative safe integer.");
    }
    const tx = this.db.transaction([PROJECTS, RECOVERY], "readwrite");
    const projects = tx.objectStore(PROJECTS);
    const recovery = tx.objectStore(RECOVERY);
    const done = transactionResult(tx);
    const projectModel = this.model;
    let savedRecord = null;
    let receipt = null;
    let failure = null;
    const previousRequest = projects.get(copy.id);

    previousRequest.onsuccess = function () {
      const previous = previousRequest.result || null;
      const actualRevision = revisionOf(previous);
      const actualCommitToken = previous && typeof previous.commitToken === "string" ? previous.commitToken : null;
      if (actualRevision !== expected || actualCommitToken !== expectedCommitToken) {
        failure = conflictError(copy.id, expected, actualRevision);
        try { tx.abort(); } catch (_) {}
        return;
      }

      const recoveryRequest = recovery.get(copy.id);
      recoveryRequest.onsuccess = function () {
        const previousRecovery = recoveryRequest.result || null;
        if (previous && previous.data && sameProjectContent(projectModel, copy, previous.data)) {
          savedRecord = previous;
          receipt = Object.freeze({ projectId: copy.id, committedRevision: actualRevision, noOp: true });
          return;
        }

        const nextRevision = actualRevision + 1;
        const commitToken = newCommitToken();
        record.revision = nextRevision;
        record.commitToken = commitToken;
        receipt = Object.freeze({ projectId: copy.id, committedRevision: nextRevision, commitToken: commitToken });
        this.rollbackReceipts.set(receipt, {
          previous: previous,
          previousRecovery: previousRecovery,
          previousRevision: actualRevision
        });
        if (previous && previous.data) {
          recovery.put({
            projectId: copy.id,
            projectName: previous.name,
            savedAt: previous.updatedAt,
            data: previous.data
          });
        }
        projects.put(record);
        savedRecord = record;
      }.bind(this);
      recoveryRequest.onerror = function () {
        failure = recoveryRequest.error || new Error("Could not read the project recovery snapshot.");
        try { tx.abort(); } catch (_) {}
      };
    }.bind(this);
    previousRequest.onerror = function () {
      failure = previousRequest.error || new Error("Could not read the saved project.");
      try { tx.abort(); } catch (_) {}
    };

    try { await done; }
    catch (error) { throw failure || error; }
    if (failure) throw failure;
    if (!savedRecord) throw new Error("The project save transaction completed without a saved record.");
    this.revisions.set(copy.id, revisionTokenOf(savedRecord));
    return {
      id: savedRecord.id,
      name: savedRecord.name,
      width: savedRecord.width,
      height: savedRecord.height,
      updatedAt: savedRecord.updatedAt,
      revision: revisionOf(savedRecord),
      rollbackReceipt: receipt
    };
  };

  ProjectStorage.prototype.restoreIfCurrent = async function (receipt) {
    if (receipt && receipt.noOp) return true;
    const snapshot = receipt && this.rollbackReceipts.get(receipt);
    if (!snapshot) {
      throw new Error("The rollback receipt is invalid, expired, or belongs to another storage session.");
    }
    const projectId = receipt.projectId;
    const tx = this.db.transaction([PROJECTS, RECOVERY], "readwrite");
    const projects = tx.objectStore(PROJECTS);
    const recovery = tx.objectStore(RECOVERY);
    const done = transactionResult(tx);
    let failure = null;
    const currentRequest = projects.get(projectId);
    currentRequest.onsuccess = function () {
      const current = currentRequest.result || null;
      const actualRevision = revisionOf(current);
      if (!current || actualRevision !== receipt.committedRevision ||
          current.commitToken !== receipt.commitToken) {
        failure = conflictError(projectId, receipt.committedRevision, actualRevision);
        try { tx.abort(); } catch (_) {}
        return;
      }
      if (snapshot.previous) projects.put(snapshot.previous);
      else projects.delete(projectId);
      if (snapshot.previousRecovery) recovery.put(snapshot.previousRecovery);
      else recovery.delete(projectId);
    };
    currentRequest.onerror = function () {
      failure = currentRequest.error || new Error("Could not verify the committed project before rollback.");
      try { tx.abort(); } catch (_) {}
    };
    try { await done; }
    catch (error) { throw failure || error; }
    this.rollbackReceipts.delete(receipt);
    if (snapshot.previous) this.revisions.set(projectId, revisionTokenOf(snapshot.previous));
    else this.revisions.delete(projectId);
    return true;
  };

  ProjectStorage.prototype.listProjects = async function () {
    const tx = this.db.transaction(PROJECTS, "readonly");
    const done = transactionResult(tx);
    const request = tx.objectStore(PROJECTS).getAll();
    const records = await requestResult(request);
    await done;
    return records.map(function (record) {
      return {
        id: record.id,
        name: record.name,
        width: record.width,
        height: record.height,
        updatedAt: record.updatedAt,
        createdAt: record.createdAt
      };
    }).sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  };

  ProjectStorage.prototype.getProject = async function (id) {
    const tx = this.db.transaction(PROJECTS, "readonly");
    const done = transactionResult(tx);
    const request = tx.objectStore(PROJECTS).get(id);
    const record = await requestResult(request);
    await done;
    if (!record || !record.data) {
      this.revisions.delete(id);
      return null;
    }
    this.revisions.set(id, revisionTokenOf(record));
    return this.model.deserializeProject(record.data);
  };

  ProjectStorage.prototype.getRecovery = async function (id) {
    const tx = this.db.transaction(RECOVERY, "readonly");
    const done = transactionResult(tx);
    const request = tx.objectStore(RECOVERY).get(id);
    const record = await requestResult(request);
    await done;
    if (!record || !record.data) return null;
    return {
      project: this.model.deserializeProject(record.data),
      projectName: record.projectName,
      savedAt: record.savedAt
    };
  };

  ProjectStorage.prototype.clearRecovery = async function (id) {
    const tx = this.db.transaction(RECOVERY, "readwrite");
    const done = transactionResult(tx);
    tx.objectStore(RECOVERY).delete(id);
    await done;
  };

  ProjectStorage.prototype.deleteProject = async function (id) {
    const tx = this.db.transaction([PROJECTS, RECOVERY], "readwrite");
    const done = transactionResult(tx);
    tx.objectStore(PROJECTS).delete(id);
    tx.objectStore(RECOVERY).delete(id);
    await done;
    this.revisions.delete(id);
  };

  ProjectStorage.prototype.close = function () {
    this.db.close();
  };

  return Object.freeze({
    DATABASE_NAME: DATABASE_NAME,
    DATABASE_VERSION: DATABASE_VERSION,
    open: ProjectStorage.open
  });
});
