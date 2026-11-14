import { sanitizeToolErrorMessage } from "./security-utils.mjs";

const COUNTERS = Object.freeze({
  page_close: "page_closes",
  page_crash: "page_crashes",
  page_error: "page_errors",
  page_navigation: "page_navigations",
  context_close: "context_closes",
  browser_disconnect: "browser_disconnects"
});

export class BridgeDiagnostics {
  #state = "starting";
  #everConnected = false;
  #now;
  #connection = {
    attempts: 0,
    successes: 0,
    failures: 0,
    reconnect_attempts: 0,
    reconnect_successes: 0,
    reconnect_failures: 0,
    last_connected_at: null,
    last_error: null
  };
  #browser = {
    page_closes: 0,
    page_crashes: 0,
    page_errors: 0,
    page_navigations: 0,
    context_closes: 0,
    browser_disconnects: 0
  };
  #lastEvent = null;

  constructor(options = {}) {
    this.#now = typeof options.now === "function" ? options.now : () => new Date();
  }

  #timestamp() {
    const value = this.#now();
    return (value instanceof Date ? value : new Date(value)).toISOString();
  }

  #event(type, message) {
    this.#lastEvent = {
      type,
      occurred_at: this.#timestamp(),
      message: sanitizeToolErrorMessage(message || "Bridge lifecycle event.", 400)
    };
  }

  beginConnection() {
    const reconnecting = this.#everConnected;
    this.#state = reconnecting ? "reconnecting" : "connecting";
    this.#connection.attempts += 1;
    if (reconnecting) this.#connection.reconnect_attempts += 1;
    this.#event("connection_attempt", reconnecting
      ? "The bridge is reconnecting to the local editor."
      : "The bridge is connecting to the local editor.");
    return reconnecting;
  }

  connectionSucceeded(reconnecting = false) {
    this.#state = "connected";
    this.#everConnected = true;
    this.#connection.successes += 1;
    if (reconnecting) this.#connection.reconnect_successes += 1;
    this.#connection.last_connected_at = this.#timestamp();
    this.#connection.last_error = null;
    this.#event(reconnecting ? "reconnect_success" : "connection_success",
      reconnecting ? "The bridge restored its editor connection." : "The bridge connected to the editor.");
  }

  connectionFailed(error, reconnecting = false) {
    this.#state = this.#everConnected ? "disconnected" : "failed";
    this.#connection.failures += 1;
    if (reconnecting) this.#connection.reconnect_failures += 1;
    const raw = error && typeof error.message === "string"
      ? error.message
      : String(error || "Unknown connection error.");
    this.#connection.last_error = sanitizeToolErrorMessage(raw, 400);
    this.#event("connection_failure", this.#connection.last_error);
  }

  recordBrowserEvent(type, message) {
    const counter = COUNTERS[type];
    if (!counter) throw new TypeError("Unsupported bridge lifecycle event: " + type);
    this.#browser[counter] += 1;
    this.#event(type, message);
    if (!["shutting_down", "closed"].includes(this.#state) &&
        ["page_close", "page_crash", "page_navigation", "context_close", "browser_disconnect"].includes(type)) {
      this.#state = "disconnected";
    }
  }

  beginShutdown() {
    this.#state = "shutting_down";
    this.#event("shutdown_started", "The bridge is shutting down.");
  }

  markClosed() {
    this.#state = "closed";
    this.#event("shutdown_complete", "The bridge shut down cleanly.");
  }

  snapshot(queueMetrics = {}) {
    return {
      schema_version: 1,
      connection: {
        state: this.#state,
        connected: this.#state === "connected",
        ...this.#connection
      },
      browser: { ...this.#browser },
      queue: { ...queueMetrics },
      last_event: this.#lastEvent ? { ...this.#lastEvent } : null
    };
  }
}
