"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Storage = require("../../../js/project-storage.js");
const {
  Project,
  createMemoryIndexedDB,
  createLifecycleProject,
  duplicateLifecycleProject
} = require("../../fixtures/qa/lifecycle-fixtures.js");

async function openStorage(indexedDB) {
  return Storage.open({ indexedDB, projectModel: Project });
}

function cel(project, layerId, frameId) {
  const result = Project.getCel(project, layerId, frameId);
  assert.ok(result, "fixture cel should exist");
  return result;
}

test("project records stay isolated across create, switch, reload, rename, duplicate and delete", async () => {
  const indexedDB = createMemoryIndexedDB();
  let storage = await openStorage(indexedDB);

  try {
    const alpha = createLifecycleProject({ id: "qa-alpha", name: "Alpha" });
    const beta = createLifecycleProject({
      id: "qa-beta",
      name: "Beta",
      activeLayer: "base",
      activeFrame: "first",
      overlayVisible: true,
      overlayLocked: false,
      colors: ["#aa0001", "#aa0002", "#aa0003", "#aa0004"]
    });

    await storage.saveProject(alpha);
    await storage.saveProject(beta);

    // Reopen the database to exercise serialization rather than shared object
    // references retained by the first storage instance.
    storage.close();
    storage = await openStorage(indexedDB);

    const reopenedBeta = await storage.getProject(beta.id);
    const reopenedAlpha = await storage.getProject(alpha.id);

    assert.equal(reopenedAlpha.id, alpha.id);
    assert.equal(reopenedBeta.id, beta.id);
    assert.equal(reopenedAlpha.activeLayerId, alpha.activeLayerId);
    assert.equal(reopenedAlpha.activeFrameId, alpha.activeFrameId);
    assert.equal(reopenedBeta.activeLayerId, beta.activeLayerId);
    assert.equal(reopenedBeta.activeFrameId, beta.activeFrameId);
    assert.notEqual(reopenedAlpha.activeLayerId, reopenedBeta.activeLayerId);
    assert.notEqual(reopenedAlpha.activeFrameId, reopenedBeta.activeFrameId);

    assert.deepEqual(reopenedAlpha.layers, alpha.layers,
      "reload should preserve Alpha's layer order, visibility and lock flags");
    assert.deepEqual(reopenedBeta.layers, beta.layers,
      "reload should preserve Beta's independent layer state");
    assert.deepEqual(reopenedAlpha.cels, alpha.cels,
      "Alpha's frame/layer pixels should survive reload");
    assert.deepEqual(reopenedBeta.cels, beta.cels,
      "Beta's frame/layer pixels should survive reload");
    assert.equal(cel(reopenedAlpha, alpha.layers[0].id, alpha.frames[0].id).pixels[0], "#112233");
    assert.equal(cel(reopenedBeta, beta.layers[0].id, beta.frames[0].id).pixels[0], "#aa0001");
    assert.equal(reopenedAlpha.selectedColorIndex, alpha.selectedColorIndex);
    assert.equal(reopenedBeta.selectedColorIndex, beta.selectedColorIndex);

    // Editing a loaded object must not mutate another project or the database.
    cel(reopenedAlpha, alpha.layers[0].id, alpha.frames[0].id).pixels[0] = "#ffffff";
    assert.equal(
      cel(await storage.getProject(alpha.id), alpha.layers[0].id, alpha.frames[0].id).pixels[0],
      "#112233",
      "getProject should return an isolated copy"
    );
    assert.equal(
      cel(await storage.getProject(beta.id), beta.layers[0].id, beta.frames[0].id).pixels[0],
      "#aa0001",
      "switching project records must not leak pixel buffers"
    );

    const renamed = await storage.getProject(alpha.id);
    renamed.name = "Alpha renamed";
    await storage.saveProject(renamed);
    const recordsAfterRename = await storage.listProjects();
    assert.ok(recordsAfterRename.some(record => record.id === alpha.id && record.name === "Alpha renamed"));
    const renameRecovery = await storage.getRecovery(alpha.id);
    assert.equal(renameRecovery.project.name, "Alpha",
      "a rename is a meaningful project change and should rotate the prior version");

    const duplicate = duplicateLifecycleProject(await storage.getProject(alpha.id), "qa-alpha-copy");
    await storage.saveProject(duplicate);
    assert.notEqual(duplicate.id, alpha.id);
    assert.equal((await storage.getProject(duplicate.id)).name, "Alpha renamed copy");
    assert.deepEqual((await storage.getProject(duplicate.id)).cels, duplicate.cels,
      "duplicate should retain the source frame/layer pixel data");

    const changedDuplicate = await storage.getProject(duplicate.id);
    cel(changedDuplicate, changedDuplicate.layers[0].id, changedDuplicate.frames[0].id).pixels[0] = "#abcdef";
    await storage.saveProject(changedDuplicate);
    assert.ok(await storage.getRecovery(duplicate.id),
      "a meaningful edit to the duplicate should create its own recovery slot");

    await storage.deleteProject(duplicate.id);
    assert.equal(await storage.getProject(duplicate.id), null);
    assert.equal(await storage.getRecovery(duplicate.id), null,
      "deleting a project should also delete its recovery snapshot");

    await storage.deleteProject(alpha.id);
    assert.equal(await storage.getProject(alpha.id), null);
    assert.equal(await storage.getRecovery(alpha.id), null);
    assert.ok(await storage.getProject(beta.id),
      "deleting Alpha must not delete or alter Beta");
  } finally {
    storage.close();
  }
});

test("autosave and explicit no-op saves preserve recovery; Recover and later edits rotate it", async () => {
  const storage = await openStorage(createMemoryIndexedDB());

  try {
    const versionA = createLifecycleProject({ id: "qa-recovery", name: "Recovery A" });
    await storage.saveProject(versionA);

    const versionB = Project.cloneProject(versionA);
    cel(versionB, versionB.layers[0].id, versionB.frames[0].id).pixels[0] = "#abcdef";
    await storage.saveProject(versionB);

    let current = await storage.getProject(versionA.id);
    let recovery = await storage.getRecovery(versionA.id);
    assert.equal(cel(current, current.layers[0].id, current.frames[0].id).pixels[0], "#abcdef");
    assert.equal(cel(recovery.project, versionA.layers[0].id, versionA.frames[0].id).pixels[0], "#112233",
      "saving B should put A in the recovery slot");
    const savedBUpdatedAt = current.metadata.updatedAt;

    // Autosave and an explicit Save both call saveProject with unchanged
    // content. Neither should rotate B into recovery in place of A.
    await new Promise(resolve => setTimeout(resolve, 10));
    await storage.saveProject(versionB);
    await storage.saveProject(versionB);
    current = await storage.getProject(versionA.id);
    recovery = await storage.getRecovery(versionA.id);
    assert.equal(current.metadata.updatedAt, savedBUpdatedAt,
      "no-op saves must not rewrite the stored version timestamp");
    assert.equal(cel(recovery.project, versionA.layers[0].id, versionA.frames[0].id).pixels[0], "#112233",
      "no-op saves must preserve version A in recovery");

    // Match Project Library's Recover flow: save the recovery document as the
    // current version, which should rotate B into the recovery slot.
    const recoveredA = (await storage.getRecovery(versionA.id)).project;
    await storage.saveProject(recoveredA);
    current = await storage.getProject(versionA.id);
    recovery = await storage.getRecovery(versionA.id);
    assert.equal(cel(current, versionA.layers[0].id, versionA.frames[0].id).pixels[0], "#112233",
      "Recover should restore version A");
    assert.equal(cel(recovery.project, versionA.layers[0].id, versionA.frames[0].id).pixels[0], "#abcdef",
      "Recover should retain version B as the next recovery version");

    const versionC = Project.cloneProject(current);
    cel(versionC, versionC.layers[0].id, versionC.frames[0].id).pixels[1] = "#fedcba";
    await storage.saveProject(versionC);
    recovery = await storage.getRecovery(versionA.id);
    assert.equal(cel(recovery.project, versionA.layers[0].id, versionA.frames[0].id).pixels[0], "#112233");
    assert.equal(cel(recovery.project, versionA.layers[1].id, versionA.frames[0].id).pixels[1], "#223344",
      "a genuine later edit should rotate recovered A into the one-step recovery slot");
  } finally {
    storage.close();
  }
});

test("quota failures reject saves and leave the last committed project and recovery untouched", async () => {
  const indexedDB = createMemoryIndexedDB();
  const storage = await openStorage(indexedDB);

  try {
    const quotaError = new Error("Storage quota exceeded");
    quotaError.name = "QuotaExceededError";
    const firstAttempt = createLifecycleProject({ id: "qa-quota-new" });

    indexedDB.failNextPut("projects", quotaError);
    await assert.rejects(
      storage.saveProject(firstAttempt),
      error => error.name === "QuotaExceededError" && /quota/i.test(error.message),
      "a failed initial write must reject instead of reporting success"
    );
    assert.equal((await storage.listProjects()).some(record => record.id === firstAttempt.id), false,
      "an aborted initial save must not create a project record");

    const committed = createLifecycleProject({ id: "qa-quota-existing", name: "Committed A" });
    await storage.saveProject(committed);
    const edited = Project.cloneProject(committed);
    cel(edited, edited.layers[0].id, edited.frames[0].id).pixels[0] = "#abcdef";

    // The recovery put is queued before the new project put. Failing the
    // second write must abort the whole readwrite transaction atomically.
    indexedDB.failNextPut("projects", quotaError);
    await assert.rejects(
      storage.saveProject(edited),
      error => error.name === "QuotaExceededError",
      "a failed replacement write must reject"
    );

    const stillCommitted = await storage.getProject(committed.id);
    assert.equal(cel(stillCommitted, committed.layers[0].id, committed.frames[0].id).pixels[0], "#112233",
      "a failed save must not replace the last committed project");
    assert.equal(await storage.getRecovery(committed.id), null,
      "a failed transaction must not leave a partial recovery record");
  } finally {
    storage.close();
  }
});
