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
