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
  }

  ProjectStorage.open = async function (options) {
    options = options || {};
    const model = options.projectModel || root.ArtClubProject;
    if (!model) throw new Error("The project model must be loaded before project storage.");
    const db = await openDatabase(options.indexedDB || root.indexedDB);
    return new ProjectStorage(db, model);
  };

  ProjectStorage.prototype.saveProject = async function (project) {
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

    const tx = this.db.transaction([PROJECTS, RECOVERY], "readwrite");
    const projects = tx.objectStore(PROJECTS);
    const recovery = tx.objectStore(RECOVERY);
    const done = transactionResult(tx);
    const projectModel = this.model;
    let savedRecord = record;
    const getPrevious = projects.get(copy.id);
    getPrevious.onsuccess = function () {
      const previous = getPrevious.result;
      if (previous && previous.data) {
        // A save that only refreshes metadata is not a new project version.
        // In particular, opening Project Library calls persistNow() even when
        // the current document is already saved; rotating here would discard
        // the useful one-step recovery copy.
        if (sameProjectContent(projectModel, copy, previous.data)) {
          savedRecord = previous;
          return;
        }
        recovery.put({
          projectId: copy.id,
          projectName: previous.name,
          savedAt: previous.updatedAt,
          data: previous.data
        });
      }
      projects.put(record);
    };
    getPrevious.onerror = function () {
      try { tx.abort(); } catch (_) {}
    };
    await done;
    return {
      id: savedRecord.id,
      name: savedRecord.name,
      width: savedRecord.width,
      height: savedRecord.height,
      updatedAt: savedRecord.updatedAt
    };
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
    if (!record || !record.data) return null;
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
