/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Project = require("../js/project-model.js");
const Storage = require("../js/project-storage.js");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// A small asynchronous IndexedDB test double. The browser E2E suite exercises
// the same workflow against Chromium's real IndexedDB implementation.
function createMemoryIndexedDB() {
  const stores = new Map();

  return {
    open() {
      const request = {};
      setTimeout(() => {
        const db = {
          objectStoreNames: {
            contains(name) {
              return stores.has(name);
            }
          },
          createObjectStore(name) {
            stores.set(name, new Map());
            return { createIndex() {} };
          },
          transaction() {
            const transaction = {
              objectStore(name) {
                const values = stores.get(name);
                if (!values) throw new Error("Unknown object store: " + name);
                return {
                  get(key) {
                    const result = {};
                    queueMicrotask(() => {
                      result.result = clone(values.get(key));
                      if (result.onsuccess) result.onsuccess();
                    });
                    return result;
                  },
                  getAll() {
                    const result = {};
                    queueMicrotask(() => {
                      result.result = Array.from(values.values(), clone);
                      if (result.onsuccess) result.onsuccess();
                    });
                    return result;
                  },
                  put(value) {
                    const key = value.id || value.projectId;
                    values.set(key, clone(value));
                    return { result: key };
                  },
                  delete(key) {
                    values.delete(key);
                  }
                };
              },
              abort() {
                if (transaction.onabort) transaction.onabort();
              }
            };
            setTimeout(() => {
              if (transaction.oncomplete) transaction.oncomplete();
            }, 0);
            return transaction;
          },
          close() {}
        };

        request.result = db;
        if (request.onupgradeneeded) request.onupgradeneeded();
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }
  };
}

function pixelsOf(project) {
  return Project.getCel(project).pixels;
}

test("no-op saves preserve the previous recovery snapshot while real edits rotate it", async () => {
  const storage = await Storage.open({
    indexedDB: createMemoryIndexedDB(),
    projectModel: Project
  });

  try {
    const versionA = Project.createProject({
      width: 2,
      height: 2,
      name: "Recovery test",
      palette: ["#112233", "#445566", "#778899"]
    });
    pixelsOf(versionA)[0] = "#112233";
    await storage.saveProject(versionA);

    const versionB = Project.cloneProject(versionA);
    pixelsOf(versionB)[0] = "#445566";
    await storage.saveProject(versionB);

    const recoveryAfterB = await storage.getRecovery(versionA.id);
    assert.ok(recoveryAfterB, "a real edit should create a recovery snapshot");
    assert.deepEqual(pixelsOf(recoveryAfterB.project), pixelsOf(versionA),
      "saving B should place A in recovery");

    const savedB = await storage.getProject(versionA.id);
    const savedBUpdatedAt = savedB.metadata.updatedAt;
    await new Promise(resolve => setTimeout(resolve, 10));

    await storage.saveProject(versionB);

    const afterNoOp = await storage.getProject(versionA.id);
    assert.equal(afterNoOp.metadata.updatedAt, savedBUpdatedAt,
      "a no-op save should not change the saved version timestamp");
    const recoveryAfterNoOp = await storage.getRecovery(versionA.id);
    assert.deepEqual(pixelsOf(recoveryAfterNoOp.project), pixelsOf(versionA),
      "a no-op save must not replace A with the current B version");

    const versionC = Project.cloneProject(versionB);
    pixelsOf(versionC)[1] = "#778899";
    await storage.saveProject(versionC);

    const recoveryAfterC = await storage.getRecovery(versionA.id);
    assert.deepEqual(pixelsOf(recoveryAfterC.project), pixelsOf(versionB),
      "a genuine edit/save should rotate the previous current version into recovery");
  } finally {
    storage.close();
  }
});

test("two independent storage connections reject a stale cross-tab save without rotating recovery", async () => {
  const indexedDB = createMemoryIndexedDB();
  const tabA = await Storage.open({ indexedDB, projectModel: Project });
  const tabB = await Storage.open({ indexedDB, projectModel: Project });
  try {
    const p0 = Project.createProject({ width: 2, height: 2, name: "CAS", palette: ["#112233", "#445566"] });
    pixelsOf(p0)[0] = "#112233";
    await tabA.saveProject(p0);
    const p1 = Project.cloneProject(p0);
    pixelsOf(p1)[0] = "#445566";
    await tabA.saveProject(p1);
    const staleA = await tabA.getProject(p0.id);
    const staleB = await tabB.getProject(p0.id);
    const nextA = Project.cloneProject(staleA);
    pixelsOf(nextA)[1] = "#445566";
    await tabA.saveProject(nextA);
    const recoveryBefore = await tabA.getRecovery(p0.id);
    const staleWrite = Project.cloneProject(staleB);
    pixelsOf(staleWrite)[1] = "#112233";
    await assert.rejects(tabB.saveProject(staleWrite), error =>
      error && error.code === "PROJECT_REVISION_CONFLICT" &&
      error.expectedRevision === 2 && error.actualRevision === 3);
    const persisted = await tabB.getProject(p0.id);
    const recoveryAfter = await tabB.getRecovery(p0.id);
    assert.deepEqual(pixelsOf(persisted), pixelsOf(nextA), "stale tab must not replace the newer primary");
    assert.deepEqual(recoveryAfter, recoveryBefore, "stale tab must not rotate recovery");
  } finally {
    tabA.close();
    tabB.close();
  }
});

test("conditional rollback restores the exact previous primary and recovery snapshots", async () => {
  const indexedDB = createMemoryIndexedDB();
  const storage = await Storage.open({ indexedDB, projectModel: Project });
  try {
    const p0 = Project.createProject({ width: 2, height: 2, name: "Rollback", palette: ["#112233", "#445566"] });
    pixelsOf(p0)[0] = "#112233";
    await storage.saveProject(p0);
    const p1 = Project.cloneProject(p0);
    pixelsOf(p1)[0] = "#445566";
    await storage.saveProject(p1);
    const primaryBefore = await storage.getProject(p0.id);
    const recoveryBefore = await storage.getRecovery(p0.id);
    const rejectedCandidate = Project.cloneProject(p1);
    pixelsOf(rejectedCandidate)[1] = "#112233";
    const saved = await storage.saveProject(rejectedCandidate);
    assert.equal(saved.revision, 3);
    await storage.restoreIfCurrent(saved.rollbackReceipt);
    assert.deepEqual(await storage.getProject(p0.id), primaryBefore);
    assert.deepEqual(await storage.getRecovery(p0.id), recoveryBefore);
  } finally {
    storage.close();
  }
});

test("rollback receipt cannot overwrite a newer commit from another tab", async () => {
  const indexedDB = createMemoryIndexedDB();
  const tabA = await Storage.open({ indexedDB, projectModel: Project });
  const tabB = await Storage.open({ indexedDB, projectModel: Project });
  try {
    const p0 = Project.createProject({ width: 2, height: 2, name: "Rollback race", palette: ["#112233", "#445566"] });
    await tabA.saveProject(p0);
    const candidateA = Project.cloneProject(p0);
    pixelsOf(candidateA)[0] = "#445566";
    const committedA = await tabA.saveProject(candidateA);
    const loadedB = await tabB.getProject(p0.id);
    const candidateB = Project.cloneProject(loadedB);
    pixelsOf(candidateB)[1] = "#445566";
    await tabB.saveProject(candidateB);
    const primaryAfterB = await tabB.getProject(p0.id);
    const recoveryAfterB = await tabB.getRecovery(p0.id);
    await assert.rejects(tabA.restoreIfCurrent(committedA.rollbackReceipt), error =>
      error && error.code === "PROJECT_REVISION_CONFLICT");
    assert.deepEqual(await tabA.getProject(p0.id), primaryAfterB);
    assert.deepEqual(await tabA.getRecovery(p0.id), recoveryAfterB);
  } finally {
    tabA.close();
    tabB.close();
  }
});

test("a stale tab cannot overwrite a deleted and recreated project with a reused revision", async () => {
  const indexedDB = createMemoryIndexedDB();
  const oldTab = await Storage.open({ indexedDB, projectModel: Project });
  const newTab = await Storage.open({ indexedDB, projectModel: Project });
  try {
    const original = Project.createProject({ width: 2, height: 2, name: "Original", palette: ["#112233"] });
    await oldTab.saveProject(original);
    const stale = await oldTab.getProject(original.id);
    await newTab.deleteProject(original.id);
    const replacement = Project.createProject({ width: 2, height: 2, name: "Replacement", palette: ["#445566"] });
    replacement.id = original.id;
    await newTab.saveProject(replacement);
    const staleCandidate = Project.cloneProject(stale);
    staleCandidate.name = "Stale overwrite";
    await assert.rejects(oldTab.saveProject(staleCandidate), error =>
      error && error.code === "PROJECT_REVISION_CONFLICT");
    assert.equal((await newTab.getProject(original.id)).name, "Replacement");
  } finally {
    oldTab.close();
    newTab.close();
  }
});
