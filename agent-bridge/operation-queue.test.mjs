import assert from "node:assert/strict";
import test from "node:test";

import {
  assertJsonByteLimit,
  BridgeOperationError,
  SerialOperationQueue
} from "./operation-queue.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test("executes queued operations in FIFO order", async () => {
  const queue = new SerialOperationQueue();
  const gate = deferred();
  const order = [];

  const first = queue.run(async () => {
    order.push("first:start");
    await gate.promise;
    order.push("first:end");
    return "first";
  }, { requestId: "request-1", toolName: "first", timeoutMs: 1_000 });

  const second = queue.run(async () => {
    order.push("second");
    return "second";
  }, { requestId: "request-2", toolName: "second", timeoutMs: 1_000 });

  await pause(5);
  assert.deepEqual(order, ["first:start"]);
  gate.resolve();
  assert.equal(await first, "first");
  assert.equal(await second, "second");
  assert.deepEqual(order, ["first:start", "first:end", "second"]);
});

test("removes a cancelled queued operation without skipping FIFO order", async () => {
  const queue = new SerialOperationQueue();
  const gate = deferred();
  const controller = new AbortController();
  let skippedTaskRan = false;
  const order = [];

  const first = queue.run(async () => {
    order.push("first:start");
    await gate.promise;
    order.push("first:end");
  }, { requestId: "first", timeoutMs: 1_000 });

  const cancelled = queue.run(() => {
    skippedTaskRan = true;
  }, {
    requestId: "cancelled",
    signal: controller.signal,
    timeoutMs: 1_000
  });

  const third = queue.run(() => {
    order.push("third");
    return "third";
  }, { requestId: "third", timeoutMs: 1_000 });

  controller.abort("user stopped waiting");
  await assert.rejects(cancelled, error =>
    error instanceof BridgeOperationError &&
    error.code === "OPERATION_CANCELLED" &&
    error.requestId === "cancelled" &&
    error.outcomeUncertain === false
  );

  assert.equal(skippedTaskRan, false);
  gate.resolve();
  await first;
  assert.equal(await third, "third");
  assert.deepEqual(order, ["first:start", "first:end", "third"]);
});

test("returns a timeout promptly but keeps the serial slot until the active task unwinds", async () => {
  const queue = new SerialOperationQueue();
  const gate = deferred();
  const started = [];
  let abortNotified = false;

  const timed = queue.run(() => {
    started.push("slow");
    return gate.promise;
  }, {
    requestId: "slow-request",
    toolName: "slow-tool",
    timeoutMs: 25,
    onAbort: error => {
      abortNotified = error.code === "OPERATION_TIMEOUT";
    }
  });

  const later = queue.run(() => {
    started.push("later");
    return "later";
  }, { requestId: "later-request", timeoutMs: 1_000 });

  await assert.rejects(timed, error =>
    error.code === "OPERATION_TIMEOUT" &&
    error.requestId === "slow-request" &&
    error.toolName === "slow-tool" &&
    error.outcomeUncertain === true
  );
  await pause(10);
  assert.equal(abortNotified, true);
  assert.deepEqual(started, ["slow"], "later work must remain fenced behind the active task");

  gate.resolve();
  assert.equal(await later, "later");
  assert.deepEqual(started, ["slow", "later"]);
});

test("a failed operation does not poison later queue work", async () => {
  const queue = new SerialOperationQueue();
  const failure = queue.run(async () => {
    throw new Error("simulated browser error");
  }, { requestId: "fails", timeoutMs: 1_000 });

  const recovery = queue.run(async () => "recovered", {
    requestId: "recovery", timeoutMs: 1_000
  });

  await assert.rejects(failure, /simulated browser error/);
  assert.equal(await recovery, "recovered");
  await queue.drain();
  assert.deepEqual(queue.getStats(), {
    active: 0, queued: 0, closed: false, maxPending: 64
  });
});

test("enforces the outstanding-operation bound", async () => {
  const queue = new SerialOperationQueue({ maxPending: 1 });
  const gate = deferred();
  const active = queue.run(() => gate.promise, {
    requestId: "active", timeoutMs: 1_000
  });

  await pause(5);
  await assert.rejects(
    queue.run(() => "overflow", { requestId: "overflow", timeoutMs: 1_000 }),
    error => error.code === "QUEUE_FULL" && error.requestId === "overflow"
  );

  gate.resolve();
  await active;
});

test("shutdown cancels queued work and waits for the active task to clean up", async () => {
  const queue = new SerialOperationQueue();
  let activeSignal;
  let abortCallbackRan = false;
  let queuedTaskRan = false;

  const active = queue.run(({ signal }) => new Promise(resolve => {
    activeSignal = signal;
    signal.addEventListener("abort", () => {
      setTimeout(() => resolve("cleaned"), 5);
    }, { once: true });
  }), {
    requestId: "active",
    timeoutMs: 1_000,
    onAbort: () => { abortCallbackRan = true; }
  });

  const queued = queue.run(() => { queuedTaskRan = true; }, {
    requestId: "queued", timeoutMs: 1_000
  });

  await pause(5);
  const closing = queue.close({ reason: "test shutdown" });
  await assert.rejects(active, error => error.code === "SERVER_SHUTTING_DOWN");
  await assert.rejects(queued, error => error.code === "SERVER_SHUTTING_DOWN");
  await closing;

  assert.equal(activeSignal.aborted, true);
  assert.equal(abortCallbackRan, true);
  assert.equal(queuedTaskRan, false);
  assert.deepEqual(queue.getStats(), {
    active: 0, queued: 0, closed: true, maxPending: 64
  });
});

test("tracks queue outcomes and request correlation", async () => {
  const queue = new SerialOperationQueue({ maxPending: 2 });
  const gate = deferred();
  const controller = new AbortController();

  const active = queue.run(() => gate.promise, {
    requestId: "metric-active", timeoutMs: 1_000
  });
  await pause(5);
  const cancelled = queue.run(() => "must not run", {
    requestId: "metric-cancelled", signal: controller.signal, timeoutMs: 1_000
  });
  await assert.rejects(
    queue.run(() => "overflow", { requestId: "metric-overflow", timeoutMs: 1_000 }),
    error => error.code === "QUEUE_FULL"
  );
  controller.abort("metrics test");
  await assert.rejects(cancelled, error => error.code === "OPERATION_CANCELLED");
  gate.resolve("active result");
  assert.equal(await active, "active result");
  await assert.rejects(
    queue.run(() => { throw new Error("metric failure"); }, {
      requestId: "metric-failed", timeoutMs: 1_000
    }),
    /metric failure/
  );

  const metrics = queue.getMetrics();
  assert.equal(metrics.accepted, 3);
  assert.equal(metrics.completed, 1);
  assert.equal(metrics.failed, 1);
  assert.equal(metrics.cancelled, 1);
  assert.equal(metrics.timed_out, 0);
  assert.equal(metrics.rejected_full, 1);
  assert.equal(metrics.rejected_closed, 0);
  assert.equal(metrics.max_observed_outstanding, 2);
  assert.equal(metrics.last_request_id, "metric-failed");
  assert.equal(metrics.active_request_id, null);
  assert.ok(metrics.total_queue_wait_ms >= 0);
  assert.ok(metrics.total_execution_ms >= 0);
});

test("measures JSON payload limits in UTF-8 bytes", () => {
  const value = { text: "🖼️" };
  const expected = Buffer.byteLength(JSON.stringify(value), "utf8");
  assert.equal(assertJsonByteLimit(value, expected), expected);
  assert.throws(
    () => assertJsonByteLimit(value, expected - 1, {
      code: "INPUT_TOO_LARGE",
      label: "Tool input",
      toolName: "test",
      requestId: "bytes"
    }),
    error => error.code === "INPUT_TOO_LARGE" && error.requestId === "bytes"
  );
  assert.throws(() => assertJsonByteLimit({ value: 1 }, 0), /maxBytes/);
});
