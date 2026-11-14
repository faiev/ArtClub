import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import constants from "node:constants";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const LOCK_FILE = ".artclub-agent.lock";
const RECOVERY_FILE = LOCK_FILE + ".recovery";
const LOCK_VERSION = 1;

export class ProfileLockError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProfileLockError";
    this.code = code;
    this.lockPath = details.lockPath;
    this.owner = details.owner;
    this.recoveryCommand = details.recoveryCommand;
    if (details.cause !== undefined) this.cause = details.cause;
  }
}

function recoveryCommand() {
  return "node agent-bridge/server.mjs --recover-stale-profile-lock";
}

async function canonicalProfileDirectory(profileDirectory) {
  if (typeof profileDirectory !== "string" || profileDirectory.trim() === "") {
    throw new TypeError("A non-empty browser profile directory is required.");
  }
  const requested = path.resolve(profileDirectory);
  await fs.mkdir(requested, { recursive: true, mode: 0o700 });
  const canonical = await fs.realpath(requested);
  const stat = await fs.lstat(canonical);
  if (!stat.isDirectory()) {
    throw new ProfileLockError(
      "PROFILE_DIRECTORY_INVALID",
      "The browser profile path is not a directory: " + canonical
    );
  }
  return canonical;
}

async function assertNoRecoveryMarker(recoveryPath, lockPath) {
  try {
    const stat = await fs.lstat(recoveryPath);
    if (!stat.isFile()) {
      throw new ProfileLockError(
        "PROFILE_LOCK_RECOVERY_IN_PROGRESS",
        "A profile-lock recovery marker exists and is not a regular file. Inspect and remove it manually only after verifying no recovery process is active.",
        { lockPath: recoveryPath }
      );
    }
    throw new ProfileLockError(
      "PROFILE_LOCK_RECOVERY_IN_PROGRESS",
      "A profile-lock recovery is in progress or was interrupted. Do not start another bridge. Verify no recovery process is active, then remove the stale marker " + recoveryPath + " manually before retrying.",
      { lockPath: recoveryPath }
    );
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
}

function validateOwnerRecord(value, lockPath) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.version !== LOCK_VERSION ||
      typeof value.token !== "string" || value.token.length < 16 ||
      !Number.isSafeInteger(value.pid) || value.pid < 1 ||
      typeof value.hostname !== "string" || value.hostname.length === 0 ||
      typeof value.acquired_at !== "string" ||
      typeof value.profile_dir !== "string") {
    throw new ProfileLockError(
      "PROFILE_LOCK_UNREADABLE",
      "The profile lock file is malformed. Do not delete it automatically; inspect " + lockPath + " and verify that no Art Club bridge owns this profile.",
      { lockPath }
    );
  }
  return value;
}

async function readLockRecord(lockPath) {
  let before;
  try {
    before = await fs.lstat(lockPath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new ProfileLockError(
        "PROFILE_LOCK_NOT_FOUND",
        "No profile lock exists at " + lockPath + ".",
        { lockPath, cause: error }
      );
    }
    throw new ProfileLockError(
      "PROFILE_LOCK_UNREADABLE",
      "Could not inspect the profile lock file " + lockPath + ": " + error.message,
      { lockPath, cause: error }
    );
  }

  if (before.isSymbolicLink()) {
    throw new ProfileLockError(
      "PROFILE_LOCK_UNSAFE_PATH",
      "The profile lock path is a symbolic link. Refusing to follow it: " + lockPath,
      { lockPath }
    );
  }
  if (!before.isFile()) {
    throw new ProfileLockError(
      "PROFILE_LOCK_UNSAFE_PATH",
      "The profile lock path is not a regular file. Refusing to use it: " + lockPath,
      { lockPath }
    );
  }

  let handle;
  try {
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    handle = await fs.open(lockPath, constants.O_RDONLY | noFollow);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new ProfileLockError(
        "PROFILE_LOCK_CHANGED",
        "The profile lock changed while it was being inspected. Refusing to guess its owner: " + lockPath,
        { lockPath }
      );
    }
    const text = await handle.readFile("utf8");
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) {
      throw new ProfileLockError(
        "PROFILE_LOCK_UNREADABLE",
        "The profile lock JSON is invalid. Inspect " + lockPath + "; automatic recovery is disabled.",
        { lockPath, cause: error }
      );
    }
    return {
      owner: validateOwnerRecord(parsed, lockPath),
      identity: { dev: opened.dev, ino: opened.ino }
    };
  } catch (error) {
    if (error instanceof ProfileLockError) throw error;
    throw new ProfileLockError(
      "PROFILE_LOCK_UNREADABLE",
      "Could not safely read profile lock " + lockPath + ": " + error.message,
      { lockPath, cause: error }
    );
  } finally {
    await handle?.close().catch(() => {});
  }
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameHost(owner, hostname) {
  return owner.hostname === hostname;
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && error.code === "ESRCH") return false;
    // EPERM and unexpected OS errors are treated as "possibly alive".
    // Refusing startup is safer than stealing a lock from a process we cannot inspect.
    return true;
  }
}

function describeExistingOwner(owner, lockPath, hostname) {
  if (!sameHost(owner, hostname)) {
    return new ProfileLockError(
      "PROFILE_LOCK_OWNER_UNKNOWN",
      "The browser profile is locked by host " + owner.hostname + " (PID " + owner.pid + "). Its liveness cannot be checked from this host, so the lock is not reclaimed automatically. Use the profile only on one host and resolve the owner there. Lock: " + lockPath,
      { lockPath, owner, recoveryCommand: recoveryCommand() }
    );
  }
  if (processIsAlive(owner.pid)) {
    return new ProfileLockError(
      "PROFILE_IN_USE",
      "Another Art Club bridge process (PID " + owner.pid + " on " + hostname + ") already owns this browser profile. Use one bridge process per ARTCLUB_PROFILE_DIR. Lock: " + lockPath,
      { lockPath, owner }
    );
  }
  return new ProfileLockError(
    "STALE_PROFILE_LOCK",
    "The profile lock belongs to a process that is no longer running (PID " + owner.pid + "). Startup is refused until an operator explicitly runs \"" + recoveryCommand() + "\" after verifying the old process is gone. Lock: " + lockPath,
    { lockPath, owner, recoveryCommand: recoveryCommand() }
  );
}

async function writeExclusiveFile(filePath, content) {
  const handle = await fs.open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
    return await handle.stat();
  } finally {
    await handle.close();
  }
}

async function removeOwnedFile(filePath, token, expectedIdentity) {
  try {
    const record = await readLockRecord(filePath);
    if (record.owner.token !== token ||
        (expectedIdentity && !sameIdentity(record.identity, expectedIdentity))) {
      throw new ProfileLockError(
        "PROFILE_LOCK_OWNERSHIP_LOST",
        "The lock file no longer belongs to this process. It was left untouched: " + filePath,
        { lockPath: filePath, owner: record.owner }
      );
    }
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error instanceof ProfileLockError && error.code === "PROFILE_LOCK_NOT_FOUND") return false;
    throw error;
  }
}

async function removeOwnedRecoveryMarker(filePath, token) {
  let handle;
  try {
    handle = await fs.open(filePath, "r");
    const text = await handle.readFile("utf8");
    const marker = JSON.parse(text);
    if (marker?.token !== token) return false;
    await handle.close();
    handle = null;
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function acquireProfileLock(profileDirectory, options = {}) {
  const canonicalDir = await canonicalProfileDirectory(profileDirectory);
  const lockPath = path.join(canonicalDir, LOCK_FILE);
  const recoveryPath = path.join(canonicalDir, RECOVERY_FILE);
  const hostname = options.hostname || os.hostname();
  const pid = options.pid || process.pid;
  await assertNoRecoveryMarker(recoveryPath, lockPath);

  const token = randomUUID();
  const owner = {
    version: LOCK_VERSION,
    token,
    pid,
    hostname,
    acquired_at: new Date().toISOString(),
    profile_dir: canonicalDir
  };
  const tempPath = path.join(canonicalDir, "." + LOCK_FILE + "." + token + ".tmp");
  let tempIdentity;

  try {
    tempIdentity = await writeExclusiveFile(tempPath, JSON.stringify(owner));
    try {
      // The lock target appears atomically and already contains a complete record.
      // A process never observes a partially written lock created by another process.
      await fs.link(tempPath, lockPath);
    } catch (error) {
      if (!error || error.code !== "EEXIST") {
        throw new ProfileLockError(
          "PROFILE_LOCK_ATOMIC_CREATE_UNAVAILABLE",
          "The filesystem could not atomically create the Art Club profile lock (" + (error?.message || error) + "). Refusing to run without cross-process protection.",
          { lockPath, cause: error }
        );
      }
      const existing = await readLockRecord(lockPath);
      throw describeExistingOwner(existing.owner, lockPath, hostname);
    }

    const current = await readLockRecord(lockPath);
    if (current.owner.token !== token) {
      throw new ProfileLockError(
        "PROFILE_LOCK_OWNERSHIP_LOST",
        "The newly created profile lock does not match this process. Refusing to launch Chromium.",
        { lockPath, owner: current.owner }
      );
    }

    let released = false;
    return {
      profileDirectory: canonicalDir,
      lockPath,
      owner,
      async release() {
        if (released) return false;
        const removed = await removeOwnedFile(lockPath, token, current.identity);
        released = true;
        return removed;
      }
    };
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

export async function recoverStaleProfileLock(profileDirectory, options = {}) {
  const canonicalDir = await canonicalProfileDirectory(profileDirectory);
  const lockPath = path.join(canonicalDir, LOCK_FILE);
  const recoveryPath = path.join(canonicalDir, RECOVERY_FILE);
  const hostname = options.hostname || os.hostname();
  const marker = {
    version: 1,
    token: randomUUID(),
    pid: options.pid || process.pid,
    hostname,
    started_at: new Date().toISOString()
  };

  try {
    await writeExclusiveFile(recoveryPath, JSON.stringify(marker));
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw new ProfileLockError(
        "PROFILE_LOCK_RECOVERY_IN_PROGRESS",
        "A profile-lock recovery marker already exists. It may be owned by an active or crashed recovery process. Verify no recovery command is running; if it is abandoned, remove " + recoveryPath + " manually. The lock itself was not changed.",
        { lockPath: recoveryPath, cause: error }
      );
    }
    throw new ProfileLockError(
      "PROFILE_LOCK_RECOVERY_UNAVAILABLE",
      "Could not create an exclusive stale-lock recovery marker: " + error.message,
      { lockPath: recoveryPath, cause: error }
    );
  }

  try {
    const first = await readLockRecord(lockPath);
    if (!sameHost(first.owner, hostname)) {
      throw describeExistingOwner(first.owner, lockPath, hostname);
    }
    if (processIsAlive(first.owner.pid)) {
      throw describeExistingOwner(first.owner, lockPath, hostname);
    }

    // Re-read after taking the recovery marker. Only remove the same dead owner
    // and same inode observed initially; a replaced lock is never reclaimed.
    const second = await readLockRecord(lockPath);
    if (second.owner.token !== first.owner.token ||
        !sameIdentity(second.identity, first.identity)) {
      throw new ProfileLockError(
        "PROFILE_LOCK_CHANGED",
        "The profile lock changed during stale-owner verification. Nothing was removed; inspect " + lockPath,
        { lockPath, owner: second.owner }
      );
    }
    if (!sameHost(second.owner, hostname) || processIsAlive(second.owner.pid)) {
      throw describeExistingOwner(second.owner, lockPath, hostname);
    }

    await fs.unlink(lockPath);
    return { recovered: true, profileDirectory: canonicalDir, previousOwner: second.owner };
  } finally {
    await removeOwnedRecoveryMarker(recoveryPath, marker.token);
  }
}
