"use strict";

const Project = require("../../../js/project-model.js");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Small asynchronous IndexedDB test double with transaction snapshots.
 * A transaction commits its writes only when it completes; an injected
 * QuotaExceededError aborts the whole transaction.
 */
function createMemoryIndexedDB() {
  const stores = new Map();
  let nextPutFailure = null;

  function copyStore(source) {
    return new Map(Array.from(source.entries(), ([key, value]) => [key, clone(value)]));
  }

  return {
    failNextPut(storeName, error) {
      nextPutFailure = { storeName, error };
    },

    open() {
      const request = {};
      queueMicrotask(() => {
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

          transaction(storeNames, mode) {
            const names = Array.isArray(storeNames) ? storeNames : [storeNames];
            const drafts = new Map();
            for (const name of names) {
              if (!stores.has(name)) throw new Error("Unknown object store: " + name);
              drafts.set(name, copyStore(stores.get(name)));
            }

            let aborted = false;
            const transaction = {
              error: null,

              objectStore(name) {
                const values = drafts.get(name);
                if (!values) throw new Error("Store is outside this transaction: " + name);

                return {
                  get(key) {
                    const result = {};
                    queueMicrotask(() => {
                      if (aborted) return;
                      result.result = clone(values.get(key));
                      if (result.onsuccess) result.onsuccess({ target: result });
                    });
                    return result;
                  },

                  getAll() {
                    const result = {};
                    queueMicrotask(() => {
                      if (aborted) return;
                      result.result = Array.from(values.values(), clone);
                      if (result.onsuccess) result.onsuccess({ target: result });
                    });
                    return result;
                  },

                  put(value) {
                    const result = {};
                    queueMicrotask(() => {
                      if (aborted) return;
                      if (nextPutFailure &&
                          (!nextPutFailure.storeName || nextPutFailure.storeName === name)) {
                        const failure = nextPutFailure;
                        nextPutFailure = null;
                        result.error = failure.error;
                        if (result.onerror) result.onerror({ target: result });
                        abort(failure.error);
                        return;
                      }
                      const key = value.id || value.projectId;
                      values.set(key, clone(value));
                      result.result = key;
                      if (result.onsuccess) result.onsuccess({ target: result });
                    });
                    return result;
                  },

                  delete(key) {
                    values.delete(key);
                    return { result: key };
                  }
                };
              },

              abort() {
                abort(new Error("Transaction aborted by test"));
              }
            };

            function abort(error) {
              if (aborted) return;
              aborted = true;
              transaction.error = error;
              queueMicrotask(() => {
                if (transaction.onerror) transaction.onerror({ target: transaction });
                if (transaction.onabort) transaction.onabort({ target: transaction });
              });
            }

            setTimeout(() => {
              if (aborted) return;
              if (mode === "readwrite") {
                for (const [name, values] of drafts) stores.set(name, values);
              }
              if (transaction.oncomplete) transaction.oncomplete({ target: transaction });
            }, 0);

            return transaction;
          },

          close() {}
        };

        request.result = db;
        if (request.onupgradeneeded) request.onupgradeneeded({ target: request });
        if (request.onsuccess) request.onsuccess({ target: request });
      });
      return request;
    }
  };
}

function createLifecycleProject(options) {
  options = options || {};
  const id = options.id || "qa-project";
  const colors = options.colors || ["#112233", "#223344", "#334455", "#445566"];
  const project = Project.createProject({
    id,
    name: options.name || id,
    width: 3,
    height: 2,
    palette: ["#112233", "#223344", "#334455", "#445566"],
    selectedColorIndex: options.selectedColorIndex === undefined ? 2 : options.selectedColorIndex
  });

  const baseLayer = project.layers[0];
  baseLayer.id = id + "-base";
  const firstFrame = project.frames[0];
  firstFrame.id = id + "-frame-1";
  project.cels[0].layerId = baseLayer.id;
  project.cels[0].frameId = firstFrame.id;

  const overlayLayer = Project.makeLayer("Overlay");
  overlayLayer.id = id + "-overlay";
  overlayLayer.visible = options.overlayVisible === undefined ? false : options.overlayVisible;
  overlayLayer.locked = options.overlayLocked === undefined ? true : options.overlayLocked;
  project.layers.push(overlayLayer);

  const secondFrame = Project.makeFrame("Frame 2", 180);
  secondFrame.id = id + "-frame-2";
  project.frames.push(secondFrame);

  const baseSecondFrame = Project.ensureCel(project, baseLayer.id, secondFrame.id);
  const overlayFirstFrame = Project.ensureCel(project, overlayLayer.id, firstFrame.id);
  const overlaySecondFrame = Project.ensureCel(project, overlayLayer.id, secondFrame.id);

  project.cels.find(cel => cel.layerId === baseLayer.id && cel.frameId === firstFrame.id).pixels[0] = colors[0];
  overlayFirstFrame.pixels[1] = colors[1];
  baseSecondFrame.pixels[2] = colors[2];
  overlaySecondFrame.pixels[3] = colors[3];

  project.activeLayerId = options.activeLayer === "base" ? baseLayer.id : overlayLayer.id;
  project.activeFrameId = options.activeFrame === "first" ? firstFrame.id : secondFrame.id;
  return project;
}

function duplicateLifecycleProject(source, id) {
  const copy = Project.cloneProject(source);
  copy.id = id;
  copy.name = (source.name + " copy").slice(0, 100);
  const now = new Date().toISOString();
  copy.metadata.createdAt = now;
  copy.metadata.updatedAt = now;
  return copy;
}

module.exports = {
  Project,
  createMemoryIndexedDB,
  createLifecycleProject,
  duplicateLifecycleProject
};
