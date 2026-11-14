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
      return Promise.reject(new BridgeOperationError(
        "SERVER_SHUTTING_DOWN",
        "The bridge is shutting down and no new operations are accepted.",
        { requestId, toolName }
      ));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new BridgeOperationError(
        "OPERATION_CANCELLED",
        "The client cancelled " + toolName + " before it entered the operation queue.",
        { requestId, toolName, cause: options.signal.reason }
      ));
    }
    if (this.#pending.length + (this.#active ? 1 : 0) >= this.#maxPending) {
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
          value => this.#settleCaller(operation, null, value),
          error => this.#settleCaller(operation, error)
        )
        .finally(() => {
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
}
