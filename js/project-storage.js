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
  const DATABASE_VERSION = 2;
  const PROJECTS = "projects";
  const RECOVERY = "recovery";
  const VERSIONS = "versions";

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
        if (!db.objectStoreNames.contains(VERSIONS)) {
          db.createObjectStore(VERSIONS, { keyPath: "projectId" });
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

    const tx = this.db.transaction([PROJECTS, RECOVERY, VERSIONS], "readwrite");
    const projects = tx.objectStore(PROJECTS);
    const recovery = tx.objectStore(RECOVERY);
    const versions = tx.objectStore(VERSIONS);
    const done = transactionResult(tx);
    const projectModel = this.model;
    let savedRecord = null;
    let receipt = null;
    let failure = null;
    let previous = null;
    let versionRecord = null;
    let primaryReady = false;
    let versionReady = false;
    let recoveryRequestStarted = false;

    function abortWith(error) {
      failure = error;
      try { tx.abort(); } catch (_) {}
    }

    const previousRequest = projects.get(copy.id);
    previousRequest.onsuccess = function () {
      previous = previousRequest.result || null;
      primaryReady = true;
      beginSaveWhenReady();
    };
    previousRequest.onerror = function () {
      abortWith(previousRequest.error || new Error("Could not read the saved project."));
    };

    const versionRequest = versions.get(copy.id);
    versionRequest.onsuccess = function () {
      versionRecord = versionRequest.result || null;
      versionReady = true;
      beginSaveWhenReady();
    };
    versionRequest.onerror = function () {
      abortWith(versionRequest.error || new Error("Could not read the project revision."));
    };

    const self = this;
    function beginSaveWhenReady() {
      if (!primaryReady || !versionReady || recoveryRequestStarted || failure) return;
      recoveryRequestStarted = true;
      const actualToken = versionRecord || revisionTokenOf(previous);
      const actualRevision = actualToken.revision;
      const actualCommitToken = actualToken.commitToken;
      if (actualRevision !== expected || actualCommitToken !== expectedCommitToken) {
        abortWith(conflictError(copy.id, expected, actualRevision));
        return;
      }

      const recoveryRequest = recovery.get(copy.id);
      recoveryRequest.onsuccess = function () {
        const previousRecovery = recoveryRequest.result || null;
        if (previous && previous.data && sameProjectContent(projectModel, copy, previous.data)) {
          savedRecord = previous;
          receipt = Object.freeze({
            projectId: copy.id,
            committedRevision: actualRevision,
            commitToken: actualCommitToken,
            noOp: true
          });
          return;
        }

        const nextRevision = actualRevision + 1;
        const commitToken = newCommitToken();
        record.revision = nextRevision;
        record.commitToken = commitToken;
        receipt = Object.freeze({
          projectId: copy.id,
          committedRevision: nextRevision,
          commitToken: commitToken
        });
        self.rollbackReceipts.set(receipt, {
          previous: previous,
          previousRecovery: previousRecovery
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
        versions.put({
          projectId: copy.id,
          revision: nextRevision,
          commitToken: commitToken
        });
        savedRecord = record;
      };
      recoveryRequest.onerror = function () {
        abortWith(recoveryRequest.error || new Error("Could not read the project recovery snapshot."));
      };
    }

    try { await done; }
    catch (error) { throw failure || error; }
    if (failure) throw failure;
    if (!savedRecord) throw new Error("The project save transaction completed without a saved record.");
    const savedToken = revisionTokenOf(savedRecord);
    this.revisions.set(copy.id, savedToken);
    return {
      id: savedRecord.id,
      name: savedRecord.name,
      width: savedRecord.width,
      height: savedRecord.height,
      updatedAt: savedRecord.updatedAt,
      revision: savedToken.revision,
      revisionToken: savedToken,
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
    const tx = this.db.transaction([PROJECTS, RECOVERY, VERSIONS], "readwrite");
    const projects = tx.objectStore(PROJECTS);
    const recovery = tx.objectStore(RECOVERY);
    const versions = tx.objectStore(VERSIONS);
    const done = transactionResult(tx);
    let failure = null;
    let current = null;
    let version = null;
    let primaryReady = false;
    let versionReady = false;
    let restoreStarted = false;

    function abortWith(error) {
      failure = error;
      try { tx.abort(); } catch (_) {}
    }

    const currentRequest = projects.get(projectId);
    currentRequest.onsuccess = function () {
      current = currentRequest.result || null;
      primaryReady = true;
      restoreWhenReady();
    };
    currentRequest.onerror = function () {
      abortWith(currentRequest.error || new Error("Could not verify the committed project before rollback."));
    };

    const versionRequest = versions.get(projectId);
    versionRequest.onsuccess = function () {
      version = versionRequest.result || null;
      versionReady = true;
      restoreWhenReady();
    };
    versionRequest.onerror = function () {
      abortWith(versionRequest.error || new Error("Could not verify the committed project revision before rollback."));
    };

    const self = this;
    function restoreWhenReady() {
      if (!primaryReady || !versionReady || restoreStarted || failure) return;
      restoreStarted = true;
      const currentToken = version || revisionTokenOf(current);
      if (!current || currentToken.revision !== receipt.committedRevision ||
          currentToken.commitToken !== receipt.commitToken) {
        abortWith(conflictError(projectId, receipt.committedRevision, currentToken.revision));
        return;
      }

      // Rollback is itself a new revision. The restored project and recovery
      // records are exact snapshots; the separate version row never moves back.
      const rollbackRevision = currentToken.revision + 1;
      const rollbackToken = newCommitToken();
      if (snapshot.previous) projects.put(snapshot.previous);
      else projects.delete(projectId);
      if (snapshot.previousRecovery) recovery.put(snapshot.previousRecovery);
      else recovery.delete(projectId);
      versions.put({
        projectId: projectId,
        revision: rollbackRevision,
        commitToken: rollbackToken
      });
    }

    try { await done; }
    catch (error) { throw failure || error; }
    if (failure) throw failure;
    this.rollbackReceipts.delete(receipt);
    this.revisions.set(projectId, {
      revision: receipt.committedRevision + 1,
      commitToken: (await this._readVersionToken(projectId)).commitToken
    });
    return true;
  };

  ProjectStorage.prototype._readVersionToken = async function (id) {
    const tx = this.db.transaction(VERSIONS, "readonly");
    const done = transactionResult(tx);
    const request = tx.objectStore(VERSIONS).get(id);
    const record = await requestResult(request);
    await done;
    return record ? { revision: record.revision, commitToken: record.commitToken } : { revision: 0, commitToken: null };
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
    const tx = this.db.transaction([PROJECTS, VERSIONS], "readonly");
    const done = transactionResult(tx);
    const projectRequest = tx.objectStore(PROJECTS).get(id);
    const versionRequest = tx.objectStore(VERSIONS).get(id);
    const record = await requestResult(projectRequest);
    const version = await requestResult(versionRequest);
    await done;
    if (!record || !record.data) {
      if (version) this.revisions.set(id, { revision: version.revision, commitToken: version.commitToken });
      else this.revisions.delete(id);
      return null;
    }
    this.revisions.set(id, version || revisionTokenOf(record));
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
    const tx = this.db.transaction([PROJECTS, RECOVERY, VERSIONS], "readwrite");
    const projects = tx.objectStore(PROJECTS);
    const recovery = tx.objectStore(RECOVERY);
    const versions = tx.objectStore(VERSIONS);
    const done = transactionResult(tx);
    let version = null;
    let previous = null;
    let deletedToken = null;
    let ready = 0;
    const finish = function () {
      ready += 1;
      if (ready !== 2) return;
      const current = version || revisionTokenOf(previous);
      const revision = current.revision + 1;
      const commitToken = newCommitToken();
      projects.delete(id);
      recovery.delete(id);
      versions.put({ projectId: id, revision: revision, commitToken: commitToken });
      deletedToken = { revision: revision, commitToken: commitToken };
    }.bind(this);
    const versionRequest = versions.get(id);
    versionRequest.onsuccess = function () { version = versionRequest.result || null; finish(); };
    versionRequest.onerror = function () { try { tx.abort(); } catch (_) {} };
    const projectRequest = projects.get(id);
    projectRequest.onsuccess = function () { previous = projectRequest.result || null; finish(); };
    projectRequest.onerror = function () { try { tx.abort(); } catch (_) {} };
    await done;
    this.revisions.set(id, deletedToken);
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
