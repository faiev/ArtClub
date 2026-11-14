import { randomUUID } from "node:crypto";

export class BridgeOperationError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "BridgeOperationError";
    this.code = code;
    this.toolName = options.toolName || "unknown";
    this.requestId = options.requestId || randomUUID();
    this.outcomeUncertain = Boolean(options.outcomeUncertain);
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export function jsonByteLength(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value === undefined ? null : value);
  } catch (error) {
    throw new BridgeOperationError(
      "INVALID_PAYLOAD",
      "The tool payload could not be serialized as JSON.",
      { cause: error }
    );
  }
  if (typeof serialized !== "string") {
    throw new BridgeOperationError(
      "INVALID_PAYLOAD",
      "The tool payload is not JSON serializable."
    );
  }
  return Buffer.byteLength(serialized, "utf8");
}

export function assertJsonByteLimit(value, maxBytes, options = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }
  const bytes = jsonByteLength(value);
  if (bytes > maxBytes) {
    const label = options.label || "Tool payload";
    const code = options.code || "PAYLOAD_TOO_LARGE";
    throw new BridgeOperationError(
      code,
      label + " is " + bytes + " bytes; the configured limit is " + maxBytes + " bytes.",
      options
    );
  }
  return bytes;
}

export class SerialOperationQueue {
  #pending = [];
  #active = null;
  #closed = false;
  #maxPending;
  #idleWaiters = [];
  #metrics = {
    accepted: 0, completed: 0, failed: 0, cancelled: 0, timedOut: 0,
    rejectedFull: 0, rejectedClosed: 0, totalQueueWaitMs: 0,
    totalExecutionMs: 0, maxObservedOutstanding: 0,
    lastRequestId: null, lastActivityAt: null
  };

  constructor(options = {}) {
    this.#maxPending = options.maxPending ?? 64;
    if (!Number.isSafeInteger(this.#maxPending) || this.#maxPending < 1) {
      throw new TypeError("maxPending must be a positive safe integer.");
    }
  }

  run(task, options = {}) {
    if (typeof task !== "function") {
      return Promise.reject(new TypeError("An operation task function is required."));
    }
    const requestId = options.requestId || randomUUID();
    const toolName = options.toolName || "unknown";
    const timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
      return Promise.reject(new TypeError("timeoutMs must be a positive safe integer."));
    }
    if (this.#closed) {
      this.#metrics.rejectedClosed += 1;
      this.#metrics.lastRequestId = requestId;
      this.#metrics.lastActivityAt = Date.now();
      return Promise.reject(new BridgeOperationError(
        "SERVER_SHUTTING_DOWN",
        "The bridge is shutting down and no new operations are accepted.",
        { requestId, toolName }
      ));
    }
    if (options.signal?.aborted) {
      this.#metrics.cancelled += 1;
      this.#metrics.lastRequestId = requestId;
      this.#metrics.lastActivityAt = Date.now();
      return Promise.reject(new BridgeOperationError(
        "OPERATION_CANCELLED",
        "The client cancelled " + toolName + " before it entered the operation queue.",
        { requestId, toolName, cause: options.signal.reason }
      ));
    }
    if (this.#pending.length + (this.#active ? 1 : 0) >= this.#maxPending) {
      this.#metrics.rejectedFull += 1;
      this.#metrics.lastRequestId = requestId;
      this.#metrics.lastActivityAt = Date.now();
      return Promise.reject(new BridgeOperationError(
        "QUEUE_FULL",
        "The bridge operation queue is full; retry after an earlier request finishes.",
        { requestId, toolName }
      ));
    }

    let resolveCaller;
    let rejectCaller;
    const callerPromise = new Promise((resolve, reject) => {
      resolveCaller = resolve;
      rejectCaller = reject;
    });
    const operation = {
      task,
      requestId,
      toolName,
      timeoutMs,
      onAbort: options.onAbort,
      controller: new AbortController(),
      externalSignal: options.signal,
      externalAbortListener: null,
      timer: null,
      started: false,
      finished: false,
      callerSettled: false,
      abortError: null,
      enqueuedAt: Date.now(),
      startedAt: null,
      resolveCaller,
      rejectCaller
    };

    operation.externalAbortListener = () => {
      const reason = operation.externalSignal?.reason;
      const detail = reason instanceof Error ? reason.message : String(reason || "Client cancelled the request.");
      this.#abort(operation, "OPERATION_CANCELLED", "Client cancelled " + toolName + ": " + detail, reason);
    };
    operation.externalSignal?.addEventListener("abort", operation.externalAbortListener, { once: true });

    operation.timer = setTimeout(() => {
      this.#abort(
        operation,
        "OPERATION_TIMEOUT",
        toolName + " exceeded its " + timeoutMs + " ms deadline. " +
          (operation.started
            ? "The browser operation may already have taken effect; later operations remain fenced until it stops. Read status before retrying."
            : "The request expired before execution and was removed from the queue.")
      );
    }, timeoutMs);

    this.#pending.push(operation);
    this.#metrics.accepted += 1;
    this.#metrics.lastRequestId = requestId;
    this.#metrics.lastActivityAt = Date.now();
    this.#metrics.maxObservedOutstanding = Math.max(
      this.#metrics.maxObservedOutstanding,
      this.#pending.length + (this.#active ? 1 : 0)
    );
    this.#pump();
    return callerPromise;
  }

  #settleCaller(operation, error, value) {
    if (operation.callerSettled) return;
    operation.callerSettled = true;
    if (error) operation.rejectCaller(error);
    else operation.resolveCaller(value);
  }

  #cleanup(operation) {
    if (operation.timer) clearTimeout(operation.timer);
    operation.timer = null;
    operation.externalSignal?.removeEventListener("abort", operation.externalAbortListener);
    operation.externalAbortListener = null;
  }

  #abort(operation, code, message, cause) {
    if (operation.finished || operation.abortError) return;
    const error = new BridgeOperationError(code, message, {
      requestId: operation.requestId,
      toolName: operation.toolName,
      outcomeUncertain: operation.started,
      cause
    });
    operation.abortError = error;
    if (code === "OPERATION_TIMEOUT") this.#metrics.timedOut += 1;
    else this.#metrics.cancelled += 1;
    this.#metrics.lastRequestId = operation.requestId;
    this.#metrics.lastActivityAt = Date.now();
    if (!operation.started) {
      this.#metrics.totalQueueWaitMs += Math.max(0, Date.now() - operation.enqueuedAt);
    }
    operation.controller.abort(error);

    if (operation.started) {
      if (typeof operation.onAbort === "function") {
        Promise.resolve()
          .then(() => operation.onAbort(error))
          .catch(() => {});
      }
      // The caller's deadline is bounded, but the serial slot is not released
      // until the underlying task has actually unwound.
      this.#settleCaller(operation, error);
      return;
    }

    const index = this.#pending.indexOf(operation);
    if (index !== -1) this.#pending.splice(index, 1);
    operation.finished = true;
    this.#cleanup(operation);
    this.#settleCaller(operation, error);
    this.#notifyIdle();
    this.#pump();
  }

  #pump() {
    if (this.#closed || this.#active) {
      this.#notifyIdle();
      return;
    }

    while (this.#pending.length > 0) {
      const operation = this.#pending.shift();
      if (operation.finished || operation.abortError) continue;

      this.#active = operation;
      operation.started = true;
      operation.startedAt = Date.now();
      this.#metrics.totalQueueWaitMs += Math.max(0, operation.startedAt - operation.enqueuedAt);
      this.#metrics.lastRequestId = operation.requestId;
      this.#metrics.lastActivityAt = operation.startedAt;

      Promise.resolve()
        .then(() => {
          if (operation.controller.signal.aborted) {
            throw operation.abortError || operation.controller.signal.reason;
          }
          return operation.task({
            requestId: operation.requestId,
            toolName: operation.toolName,
            signal: operation.controller.signal
          });
        })
        .then(
          value => {
            if (!operation.abortError) this.#metrics.completed += 1;
            this.#settleCaller(operation, null, value);
          },
          error => {
            if (!operation.abortError) this.#metrics.failed += 1;
            this.#settleCaller(operation, error);
          }
        )
        .finally(() => {
          if (operation.startedAt !== null) {
            this.#metrics.totalExecutionMs += Math.max(0, Date.now() - operation.startedAt);
          }
          this.#metrics.lastActivityAt = Date.now();
          operation.finished = true;
          this.#cleanup(operation);
          if (this.#active === operation) this.#active = null;
          this.#notifyIdle();
          this.#pump();
        });
      break;
    }

    this.#notifyIdle();
  }

  #notifyIdle() {
    if (this.#active || this.#pending.length > 0) return;
    const waiters = this.#idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }

  drain() {
    if (!this.#active && this.#pending.length === 0) return Promise.resolve();
    return new Promise(resolve => this.#idleWaiters.push(resolve));
  }

  async close(options = {}) {
    if (this.#closed) return this.drain();
    this.#closed = true;
    const reason = options.reason || "The bridge is shutting down.";
    for (const operation of [...this.#pending]) {
      this.#abort(operation, "SERVER_SHUTTING_DOWN", reason);
    }
    if (this.#active) {
      this.#abort(this.#active, "SERVER_SHUTTING_DOWN", reason);
    }
    await this.drain();
  }

  getStats() {
    return {
      active: this.#active ? 1 : 0,
      queued: this.#pending.length,
      closed: this.#closed,
      maxPending: this.#maxPending
    };
  }

  getMetrics() {
    const stats = this.getStats();
    return {
      active: stats.active,
      queued: stats.queued,
      closed: stats.closed,
      max_pending: stats.maxPending,
      active_request_id: this.#active?.requestId || null,
      accepted: this.#metrics.accepted,
      completed: this.#metrics.completed,
      failed: this.#metrics.failed,
      cancelled: this.#metrics.cancelled,
      timed_out: this.#metrics.timedOut,
      rejected_full: this.#metrics.rejectedFull,
      rejected_closed: this.#metrics.rejectedClosed,
      total_queue_wait_ms: this.#metrics.totalQueueWaitMs,
      total_execution_ms: this.#metrics.totalExecutionMs,
      max_observed_outstanding: this.#metrics.maxObservedOutstanding,
      last_request_id: this.#metrics.lastRequestId,
      last_activity_at: this.#metrics.lastActivityAt === null
        ? null
        : new Date(this.#metrics.lastActivityAt).toISOString()
    };
  }
}
