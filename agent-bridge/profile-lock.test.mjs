import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireProfileLock,
  ProfileLockError,
  recoverStaleProfileLock
} from "./profile-lock.mjs";

const MODULE_URL = new URL("./profile-lock.mjs", import.meta.url).href;

async function makeProfile() {
  return fs.mkdtemp(path.join(os.tmpdir(), "artclub-profile-lock-"));
}

function lockPath(profile) {
  return path.join(profile, ".artclub-agent.lock");
}

async function writeOwner(profile, overrides = {}) {
  const owner = {
    version: 1,
    token: "test-owner-token-" + Math.random().toString(16).slice(2),
    pid: 2_000_000_000,
    hostname: os.hostname(),
    acquired_at: new Date().toISOString(),
    profile_dir: await fs.realpath(profile),
    ...overrides
  };
  await fs.writeFile(lockPath(profile), JSON.stringify(owner), { mode: 0o600, flag: "wx" });
  return owner;
}

async function waitForLine(stream) {
  let buffered = "";
  for await (const chunk of stream) {
    buffered += chunk.toString();
    const newline = buffered.indexOf("\n");
    if (newline !== -1) return buffered.slice(0, newline);
  }
  throw new Error("Child process exited before sending its ready line.");
}

function childCode(mode) {
  return `
    import { acquireProfileLock } from ${JSON.stringify(MODULE_URL)};
    const profile = process.argv[1];
    const mode = ${JSON.stringify(mode)};
    try {
      const lock = await acquireProfileLock(profile);
      console.log("LOCKED");
      if (mode === "hold") {
        process.stdin.resume();
        process.stdin.once("end", async () => {
          await lock.release();
          process.exit(0);
        });
      } else {
        await lock.release();
        process.exit(0);
      }
    } catch (error) {
      console.log(JSON.stringify({ code: error.code, message: error.message }));
      process.exitCode = 17;
    }
  `;
}

test("only one competing child process can own a profile at a time", async t => {
  const profile = await makeProfile();
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const first = spawn(process.execPath, ["--input-type=module", "-e", childCode("hold"), profile], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  t.after(() => {
    if (!first.killed) first.kill("SIGKILL");
  });
  assert.equal(await waitForLine(first.stdout), "LOCKED");

  const second = spawn(process.execPath, ["--input-type=module", "-e", childCode("once"), profile], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  const secondLine = await waitForLine(second.stdout);
  const [code] = await once(second, "close");
  assert.equal(code, 17);
  assert.equal(JSON.parse(secondLine).code, "PROFILE_IN_USE");

  first.stdin.end();
  const [firstCode] = await once(first, "close");
  assert.equal(firstCode, 0);

  const afterRelease = await acquireProfileLock(profile);
  assert.equal(afterRelease.owner.pid, process.pid);
  await afterRelease.release();
});

test("stale same-host owner is never stolen automatically but explicit recovery permits startup", async t => {
  const profile = await makeProfile();
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const staleOwner = await writeOwner(profile);

  await assert.rejects(
    acquireProfileLock(profile),
    error => error instanceof ProfileLockError &&
      error.code === "STALE_PROFILE_LOCK" &&
      error.owner.token === staleOwner.token &&
      /--recover-stale-profile-lock/.test(error.message)
  );

  const recovered = await recoverStaleProfileLock(profile);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.previousOwner.token, staleOwner.token);

  const lock = await acquireProfileLock(profile);
  await lock.release();
});

test("SIGKILL child leaves a stale lock that explicit recovery can clear", async t => {
  const profile = await makeProfile();
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const child = spawn(process.execPath, ["--input-type=module", "-e", childCode("hold"), profile], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  assert.equal(await waitForLine(child.stdout), "LOCKED");
  const pid = child.pid;
  child.kill("SIGKILL");
  const [code, signal] = await once(child, "close");
  assert.equal(signal, "SIGKILL");
  assert.notEqual(code, 0);

  await assert.rejects(acquireProfileLock(profile), error =>
    error.code === "STALE_PROFILE_LOCK" && error.owner.pid === pid
  );
  const recovered = await recoverStaleProfileLock(profile);
  assert.equal(recovered.recovered, true);
  const lock = await acquireProfileLock(profile);
  await lock.release();
});

test("foreign-host owner fails closed and cannot be reclaimed", async t => {
  const profile = await makeProfile();
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const owner = await writeOwner(profile, { hostname: "different-host.example" });

  await assert.rejects(acquireProfileLock(profile), error =>
    error.code === "PROFILE_LOCK_OWNER_UNKNOWN" && error.owner.token === owner.token
  );
  await assert.rejects(recoverStaleProfileLock(profile), error =>
    error.code === "PROFILE_LOCK_OWNER_UNKNOWN"
  );
  assert.equal((await fs.readFile(lockPath(profile), "utf8")).includes(owner.token), true);
});

test("malformed lock data fails closed", async t => {
  const profile = await makeProfile();
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  await fs.writeFile(lockPath(profile), "{ not json", { flag: "wx" });

  await assert.rejects(acquireProfileLock(profile), error =>
    error.code === "PROFILE_LOCK_UNREADABLE"
  );
  await assert.rejects(recoverStaleProfileLock(profile), error =>
    error.code === "PROFILE_LOCK_UNREADABLE"
  );
});

test("symlink lock path is rejected without following it", async t => {
  const profile = await makeProfile();
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const external = path.join(profile, "external-owner.json");
  await fs.writeFile(external, JSON.stringify({
    version: 1,
    token: "external-token-123456",
    pid: 2_000_000_000,
    hostname: os.hostname(),
    acquired_at: new Date().toISOString(),
    profile_dir: profile
  }));
  await fs.symlink(external, lockPath(profile));

  await assert.rejects(acquireProfileLock(profile), error =>
    error.code === "PROFILE_LOCK_UNSAFE_PATH"
  );
  await assert.rejects(recoverStaleProfileLock(profile), error =>
    error.code === "PROFILE_LOCK_UNSAFE_PATH"
  );
});

test("abandoned recovery marker blocks acquisition and requires explicit operator cleanup", async t => {
  const profile = await makeProfile();
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  await writeOwner(profile);
  const markerPath = lockPath(profile) + ".recovery";
  await fs.writeFile(markerPath, JSON.stringify({ pid: 99999 }), { flag: "wx" });

  await assert.rejects(acquireProfileLock(profile), error =>
    error.code === "PROFILE_LOCK_RECOVERY_IN_PROGRESS" &&
    /remove .*\.recovery manually/.test(error.message)
  );
  await assert.rejects(recoverStaleProfileLock(profile), error =>
    error.code === "PROFILE_LOCK_RECOVERY_IN_PROGRESS"
  );
  await fs.unlink(markerPath);
  const recovered = await recoverStaleProfileLock(profile);
  assert.equal(recovered.recovered, true);
});

test("release verifies the original token and inode before unlinking", async t => {
  const profile = await makeProfile();
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const lock = await acquireProfileLock(profile);
  const replacement = {
    ...lock.owner,
    token: "replacement-lock-owner-token",
    pid: 2_000_000_001
  };
  const temp = path.join(profile, "replacement.tmp");
  await fs.writeFile(temp, JSON.stringify(replacement), { flag: "wx" });
  await fs.rename(temp, lockPath(profile));

  await assert.rejects(lock.release(), error =>
    error.code === "PROFILE_LOCK_OWNERSHIP_LOST"
  );
  assert.equal((await fs.readFile(lockPath(profile), "utf8")).includes(replacement.token), true);
});
