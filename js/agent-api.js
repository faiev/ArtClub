/*!
 * One Pixel Studio — Agent API
 * Stable browser API for local automation and AI-agent integrations.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubAgentAPI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROTOCOL_VERSION = 1;

  function requireAdapter(adapter) {
    const required = [
      "getStatus", "getCanvas", "getPixel", "execute",
      "undo", "redo", "save", "exportProject", "importProject"
    ];
    const missing = required.filter(function (name) {
      return !adapter || typeof adapter[name] !== "function";
    });
    if (missing.length) {
      throw new Error("Agent API adapter is missing: " + missing.join(", "));
    }
  }

  function create(adapter) {
    requireAdapter(adapter);

    function executeOne(command, options) {
      return adapter.execute([command], options || {});
    }

    return Object.freeze({
      protocol: "one-pixel-studio-agent",
      protocol_version: PROTOCOL_VERSION,
      get_status: function () {
        return adapter.getStatus();
      },
      get_canvas: function (options) {
        return adapter.getCanvas(options || {});
      },
      get_palette: function () {
        return adapter.getStatus().palette;
      },
      get_pixel: function (coordinates) {
        return adapter.getPixel(coordinates || {});
      },
      execute: function (request) {
        request = request || {};
        return adapter.execute(request.commands, request);
      },
      draw_pixel: function (args) {
        return executeOne(Object.assign({ type: "draw_pixel" }, args || {}), args || {});
      },
      draw_line: function (args) {
        return executeOne(Object.assign({ type: "draw_line" }, args || {}), args || {});
      },
      draw_rectangle: function (args) {
        return executeOne(Object.assign({ type: "draw_rectangle" }, args || {}), args || {});
      },
      fill: function (args) {
        return executeOne(Object.assign({ type: "fill" }, args || {}), args || {});
      },
      erase_pixel: function (args) {
        return executeOne(Object.assign({ type: "erase_pixel" }, args || {}), args || {});
      },
      erase_rectangle: function (args) {
        return executeOne(Object.assign({ type: "erase_rectangle" }, args || {}), args || {});
      },
      clear_canvas: function (options) {
        return executeOne({ type: "clear_canvas" }, options || {});
      },
      set_color: function (args) {
        return executeOne(Object.assign({ type: "set_color" }, args || {}), args || {});
      },
      undo: function () {
        return adapter.undo();
      },
      redo: function () {
        return adapter.redo();
      },
      save: function () {
        return adapter.save();
      },
      export_project: function () {
        return adapter.exportProject();
      },
      import_project: function (payload) {
        return adapter.importProject(payload);
      }
    });
  }

  return Object.freeze({
    PROTOCOL_VERSION: PROTOCOL_VERSION,
    create: create
  });
});
