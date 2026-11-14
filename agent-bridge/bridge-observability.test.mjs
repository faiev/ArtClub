import assert from "node:assert/strict";
import test from "node:test";

import { BridgeDiagnostics } from "./bridge-observability.mjs";

test("tracks initial connection and successful reconnect transitions", () => {
  let clock = new Date("2026-11-15T00:00:00.000Z");
  const diagnostics = new BridgeDiagnostics({ now: () => clock });

  assert.equal(diagnostics.snapshot().connection.state, "starting");
  assert.equal(diagnostics.beginConnection(), false);
  diagnostics.connectionSucceeded(false);
  assert.equal(diagnostics.snapshot().connection.state, "connected");

  clock = new Date("2026-11-15T00:00:01.000Z");
  assert.equal(diagnostics.beginConnection(), true);
  diagnostics.connectionSucceeded(true);
  const snapshot = diagnostics.snapshot({ active: 1, queued: 0 });

  assert.equal(snapshot.connection.reconnect_attempts, 1);
  assert.equal(snapshot.connection.reconnect_successes, 1);
  assert.equal(snapshot.connection.successes, 2);
  assert.equal(snapshot.connection.last_connected_at, "2026-11-15T00:00:01.000Z");
  assert.equal(snapshot.queue.active, 1);
});

test("redacts paths and URLs from failed connection diagnostics", () => {
  const diagnostics = new BridgeDiagnostics();
  diagnostics.beginConnection();
  diagnostics.connectionFailed(new Error(
    "Could not open /home/alice/.artclub-agent-browser at https://user:secret@example.test/private"
  ));

  const snapshot = diagnostics.snapshot();
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.connection.state, "failed");
  assert.match(snapshot.connection.last_error, /\[local path\]/);
  assert.match(snapshot.connection.last_error, /\[URL\]/);
  assert.equal(serialized.includes("/home/alice"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("example.test"), false);
});

test("records browser lifecycle events with bounded counters", () => {
  const diagnostics = new BridgeDiagnostics();
  diagnostics.beginConnection();
  diagnostics.connectionSucceeded(false);
  diagnostics.recordBrowserEvent("page_close", "Editor page closed.");
  diagnostics.recordBrowserEvent("page_crash", "Editor page crashed.");
  diagnostics.recordBrowserEvent("page_error", "Editor script error.");
  diagnostics.recordBrowserEvent("page_navigation", "Editor navigated away.");
  diagnostics.recordBrowserEvent("context_close", "Browser context closed.");
  diagnostics.recordBrowserEvent("browser_disconnect", "Browser process disconnected.");

  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.connection.state, "disconnected");
  assert.deepEqual(snapshot.browser, {
    page_closes: 1,
    page_crashes: 1,
    page_errors: 1,
    page_navigations: 1,
    context_closes: 1,
    browser_disconnects: 1
  });
  assert.equal(snapshot.last_event.type, "browser_disconnect");
  assert.equal(snapshot.last_event.message, "Browser process disconnected.");
});

test("intentional shutdown state survives close events", () => {
  const diagnostics = new BridgeDiagnostics();
  diagnostics.beginConnection();
  diagnostics.connectionSucceeded(false);
  diagnostics.beginShutdown();
  diagnostics.recordBrowserEvent("context_close", "Browser context closed.");
  assert.equal(diagnostics.snapshot().connection.state, "shutting_down");
  diagnostics.markClosed();
  assert.equal(diagnostics.snapshot().connection.state, "closed");
});
