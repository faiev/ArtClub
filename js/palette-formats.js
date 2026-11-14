/*!
 * One Pixel Studio — palette file interoperability.
 * Dependency-free parsers and exporters for GPL, JASC-PAL and the app's JSON format.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPaletteFormats = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const JSON_FORMAT = "one-pixel-studio-palette";
  const JSON_VERSION = 1;
  const MAX_FILE_BYTES = 1024 * 1024;
  const MAX_COLORS = 4096;
  const MAX_JASC_COLORS = MAX_COLORS;
  const MAX_PALETTE_NAME = 256;
  const MAX_COLOR_NAME = 256;
  const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

  function utf8ByteLength(value) {
    let bytes = 0;
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code <= 0x7f) bytes += 1;
      else if (code <= 0x7ff) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
        const next = value.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          bytes += 4;
          i += 1;
        } else bytes += 3;
      } else bytes += 3;
    }
    return bytes;
  }

  function stripBOM(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  function lineAtIndex(text, index) {
    let line = 1;
    const end = Math.max(0, Math.min(index, text.length));
    for (let i = 0; i < end; i += 1) if (text.charCodeAt(i) === 10) line += 1;
    return line;
  }

  function lineOfKey(text, key, occurrence) {
    const escaped = key.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/[{}]/g, "\\$&");
    const re = new RegExp('"' + escaped + '"\\s*:', "g");
    let match;
    let seen = 0;
    while ((match = re.exec(text))) {
      if (seen === (occurrence || 0)) return lineAtIndex(text, match.index);
      seen += 1;
    }
    return 1;
  }

  function result(palette, errors, warnings) {
    return {
      ok: errors.length === 0,
      palette: errors.length === 0 ? palette : null,
      errors: errors,
      warnings: warnings || []
    };
  }

  function diagnostic(code, message, line, path) {
    const item = { code: code, message: message, line: Number.isInteger(line) && line > 0 ? line : 1 };
    if (path) item.path = path;
    return item;
  }

  function checkInput(text, format) {
    if (typeof text !== "string") {
      return { text: "", errors: [diagnostic("invalid-input", "Palette input must be text.", 1)] };
    }
    if (utf8ByteLength(text) > MAX_FILE_BYTES) {
      return { text: "", errors: [diagnostic("file-too-large", "Palette file exceeds the 1 MiB size limit.", 1)] };
    }
    return { text: stripBOM(text), errors: [], format: format };
  }

  function normalizeHex(value) {
    if (typeof value !== "string") return null;
    const match = value.trim().match(HEX_RE);
    if (!match) return null;
    let hex = match[1].toUpperCase();
    if (hex.length === 3) hex = hex.split("").map(function (part) { return part + part; }).join("");
    return "#" + hex;
  }

  function normalizePalette(input) {
    const errors = [];
    if (Array.isArray(input)) input = { colors: input };
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Palette must be an object with a colors array.");
    }
    const name = input.name === undefined ? "Untitled palette" : input.name;
    if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_PALETTE_NAME || /[\r\n]/.test(name)) {
      errors.push("Palette name must be 1–" + MAX_PALETTE_NAME + " characters on one line.");
    }
    if (!Array.isArray(input.colors)) errors.push("Palette colors must be an array.");
    const colors = [];
    if (Array.isArray(input.colors)) {
      if (input.colors.length < 1) errors.push("Palette must contain at least one color.");
      if (input.colors.length > MAX_COLORS) errors.push("Palette exceeds the " + MAX_COLORS + " color limit.");
      const colorCount = Math.min(input.colors.length, MAX_COLORS);
      for (let index = 0; index < colorCount; index += 1) {
        // Indexed own-slot checks are required: forEach skips sparse array holes.
        if (!Object.prototype.hasOwnProperty.call(input.colors, index)) {
          errors.push("Palette color " + (index + 1) + " is missing; sparse palette arrays are not allowed.");
          continue;
        }
        const entry = input.colors[index];
        if (entry === undefined) {
          errors.push("Color " + (index + 1) + " must not be undefined.");
          continue;
        }
        const value = typeof entry === "string" ? { hex: entry } : entry;
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          errors.push("Color " + (index + 1) + " must be a HEX string or color object.");
          continue;
        }
        const hex = normalizeHex(value.hex);
        if (!hex) errors.push("Color " + (index + 1) + " must contain a valid 3- or 6-digit HEX value.");
        const color = {};
        if (hex) color.hex = hex;
        if (value.name !== undefined) {
          if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > MAX_COLOR_NAME || /[\r\n]/.test(value.name)) {
            errors.push("Color " + (index + 1) + " name must be 1–" + MAX_COLOR_NAME + " characters on one line.");
          } else color.name = value.name.trim();
        }
        if (hex) colors.push(color);

      }
    }
    let columns;
    if (input.columns !== undefined) {
      if (!Number.isInteger(input.columns) || input.columns < 0 || input.columns > 255) {
        errors.push("Palette columns must be an integer from 0 to 255.");
      } else columns = input.columns;
    }
    if (errors.length) throw new Error(errors.join(" "));
    const palette = { name: name.trim(), colors: colors };
    if (columns !== undefined) palette.columns = columns;
    return palette;
  }

  function rgbToHex(red, green, blue) {
    return "#" + [red, green, blue].map(function (channel) {
      return channel.toString(16).padStart(2, "0");
    }).join("").toUpperCase();
  }

  function hexToRgb(hex) {
    const value = normalizeHex(hex).slice(1);
    return [0, 2, 4].map(function (offset) { return parseInt(value.slice(offset, offset + 2), 16); });
  }

  function parseGPL(input) {
    const checked = checkInput(input, "gpl");
    if (checked.errors.length) return result(null, checked.errors);
    const text = checked.text;
    const lines = text.split(/\r\n|\n|\r/);
    const errors = [];
    if (lines[0] !== "GIMP Palette") {
      errors.push(diagnostic("invalid-header", 'GPL file must start with "GIMP Palette".', 1));
      return result(null, errors);
    }

    let name = "Untitled palette";
    let columns;
    let bodyStart = 1;
    if (lines[1] && lines[1].startsWith("Name: ")) {
      name = lines[1].slice(6).trim();
      bodyStart = 2;
      if (!name) errors.push(diagnostic("empty-name", "Palette name cannot be empty.", 2));
      if (name.length > MAX_PALETTE_NAME) errors.push(diagnostic("name-too-long", "Palette name exceeds " + MAX_PALETTE_NAME + " characters.", 2));
      if (lines[2] && lines[2].startsWith("Columns: ")) {
        const rawColumns = lines[2].slice(9).trim();
        if (!/^\d+$/.test(rawColumns) || Number(rawColumns) > 255) {
          errors.push(diagnostic("invalid-columns", "Columns must be an integer from 0 to 255.", 3));
        } else columns = Number(rawColumns);
        bodyStart = 3;
      }
    }

    const colors = [];
    for (let index = bodyStart; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;
      if (line === "" || line.startsWith("#")) continue;
      const match = line.match(/^\s*([+-]?\d+)\s+([+-]?\d+)\s+([+-]?\d+)(?:\s+(.*?))?\s*$/);
      if (!match) {
        errors.push(diagnostic("invalid-color-line", "Expected red green blue followed by an optional color name.", lineNumber));
        continue;
      }
      const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
      if (channels.some(function (value) { return !Number.isSafeInteger(value) || value < 0 || value > 255; })) {
        errors.push(diagnostic("channel-out-of-range", "RGB channels must be integers from 0 to 255; values are never clamped.", lineNumber));
        continue;
      }
      if (colors.length >= MAX_COLORS) {
        errors.push(diagnostic("too-many-colors", "GPL palette exceeds the " + MAX_COLORS + " color limit.", lineNumber));
        break;
      }
      const color = { hex: rgbToHex(channels[0], channels[1], channels[2]) };
      const colorName = match[4] === undefined ? "" : match[4].trim();
      if (colorName.length > MAX_COLOR_NAME) {
        errors.push(diagnostic("color-name-too-long", "Color name exceeds " + MAX_COLOR_NAME + " characters.", lineNumber));
        continue;
      }
      if (colorName) color.name = colorName;
      colors.push(color);
    }
    if (!colors.length && !errors.length) errors.push(diagnostic("empty-palette", "GPL palette must contain at least one color.", bodyStart + 1));
    if (errors.length) return result(null, errors);
    const palette = { name: name, colors: colors };
    if (columns !== undefined) palette.columns = columns;
    return result(palette, []);
  }

  function exportGPL(input) {
    const palette = normalizePalette(input);
    const columns = palette.columns === undefined ? 0 : palette.columns;
    const lines = ["GIMP Palette", "Name: " + palette.name, "Columns: " + columns, ""];
    palette.colors.forEach(function (color) {
      const rgb = hexToRgb(color.hex);
      lines.push(rgb.join(" ") + (color.name ? " " + color.name : ""));
    });
    return lines.join("\n") + "\n";
  }

  function parseJASCPAL(input) {
    const checked = checkInput(input, "jasc-pal");
    if (checked.errors.length) return result(null, checked.errors);
    const lines = checked.text.split(/\r\n|\n|\r/);
    const errors = [];
    if (lines[0] !== "JASC-PAL") errors.push(diagnostic("invalid-header", 'JASC-PAL file must start with "JASC-PAL".', 1));
    if (lines[1] !== "0100") errors.push(diagnostic("unsupported-version", 'JASC-PAL version must be "0100".', 2));
    if (errors.length) return result(null, errors);
    if (!/^\d+$/.test(lines[2] || "")) {
      return result(null, [diagnostic("invalid-count", "The third line must contain the decimal color count.", 3)]);
    }
    const count = Number(lines[2]);
    if (!Number.isSafeInteger(count) || count < 1 || count > MAX_JASC_COLORS) {
      return result(null, [diagnostic("invalid-count", "JASC-PAL color count must be from 1 to " + MAX_JASC_COLORS + ".", 3)]);
    }

    const colors = [];
    for (let colorIndex = 0; colorIndex < count; colorIndex += 1) {
      const lineIndex = colorIndex + 3;
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;
      if (line === undefined || !line.trim()) {
        errors.push(diagnostic("truncated-palette", "Palette ended before all " + count + " color entries were read.", lineNumber));
        break;
      }
      const channels = line.trim().split(/\s+/);
      if (channels.length !== 3 || channels.some(function (part) { return !/^\d+$/.test(part); })) {
        errors.push(diagnostic("invalid-color-line", "Each JASC-PAL color line must contain exactly three decimal RGB channels.", lineNumber));
        continue;
      }
      const rgb = channels.map(Number);
      if (rgb.some(function (value) { return !Number.isSafeInteger(value) || value < 0 || value > 255; })) {
        errors.push(diagnostic("channel-out-of-range", "RGB channels must be integers from 0 to 255; values are never clamped.", lineNumber));
        continue;
      }
      colors.push({ hex: rgbToHex(rgb[0], rgb[1], rgb[2]) });
    }

    for (let extra = count + 3; extra < lines.length; extra += 1) {
      if (lines[extra].trim()) {
        errors.push(diagnostic("unexpected-content", "JASC-PAL contains more color rows than its declared count.", extra + 1));
        break;
      }
    }
    if (errors.length) return result(null, errors);
    return result({ name: "Untitled palette", colors: colors }, []);
  }

  function exportJASCPAL(input) {
    const palette = normalizePalette(input);
    if (palette.colors.length > MAX_JASC_COLORS) {
      throw new Error("JASC-PAL supports at most " + MAX_JASC_COLORS + " colors.");
    }
    const lines = ["JASC-PAL", "0100", String(palette.colors.length)];
    palette.colors.forEach(function (color) { lines.push(hexToRgb(color.hex).join(" ")); });
    return lines.join("\r\n") + "\r\n";
  }

  function jsonParseError(text, error) {
    const message = error && error.message ? error.message : "Invalid JSON.";
    const position = message.match(/position\s+(\d+)/i);
    let line = 1;
    if (position) line = lineAtIndex(text, Number(position[1]));
    else {
      const lineColumn = message.match(/line\s+(\d+)/i);
      const unexpectedToken = message.match(/Unexpected token ['\"]([^'\"]+)['\"]/i);
      if (lineColumn) line = Number(lineColumn[1]);
      else if (/Unexpected end/i.test(message)) line = lineAtIndex(text, text.length);
      else if (unexpectedToken && unexpectedToken[1].length === 1) {
        const tokenPosition = text.lastIndexOf(unexpectedToken[1]);
        if (tokenPosition >= 0) line = lineAtIndex(text, tokenPosition);
      }
    }
    return diagnostic("invalid-json", "Palette JSON could not be parsed: " + message, line);
  }

  function parseJSONPalette(input) {
    const checked = checkInput(input, "json");
    if (checked.errors.length) return result(null, checked.errors);
    let data;
    try { data = JSON.parse(checked.text); }
    catch (error) { return result(null, [jsonParseError(checked.text, error)]); }

    const text = checked.text;
    const errors = [];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      errors.push(diagnostic("invalid-json-shape", "Palette JSON must contain an object.", 1));
      return result(null, errors);
    }
    Object.keys(data).forEach(function (key) {
      if (["format", "version", "name", "colors"].indexOf(key) === -1) {
        errors.push(diagnostic("unsupported-property", 'Unknown top-level property "' + key + '".', lineOfKey(text, key), key));
      }
    });
    if (data.format !== JSON_FORMAT) errors.push(diagnostic("invalid-format", 'JSON palette format must be "' + JSON_FORMAT + '".', lineOfKey(text, "format"), "format"));
    if (data.version !== JSON_VERSION) errors.push(diagnostic("unsupported-version", "JSON palette version must be " + JSON_VERSION + ".", lineOfKey(text, "version"), "version"));
    if (typeof data.name !== "string" || !data.name.trim() || data.name.trim().length > MAX_PALETTE_NAME || /[\r\n]/.test(data.name)) {
      errors.push(diagnostic("invalid-name", "JSON palette name must be 1–" + MAX_PALETTE_NAME + " characters on one line.", lineOfKey(text, "name"), "name"));
    }
    if (!Array.isArray(data.colors)) {
      errors.push(diagnostic("invalid-colors", "JSON palette colors must be an array.", lineOfKey(text, "colors"), "colors"));
      return result(null, errors);
    }
    if (data.colors.length < 1 || data.colors.length > MAX_COLORS) {
      errors.push(diagnostic("invalid-count", "JSON palette must contain 1–" + MAX_COLORS + " colors.", lineOfKey(text, "colors"), "colors"));
    }
    const colors = [];
    data.colors.forEach(function (entry, index) {
      const line = lineOfKey(text, "hex", index);
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(diagnostic("invalid-color", "Color entry must be an object with a HEX field.", line, "colors[" + index + "]"));
        return;
      }
      Object.keys(entry).forEach(function (key) {
        if (["hex", "name"].indexOf(key) === -1) {
          errors.push(diagnostic("unsupported-property", 'Unknown color property "' + key + '".', line, "colors[" + index + "]." + key));
        }
      });
      const hex = normalizeHex(entry.hex);
      if (!hex) {
        errors.push(diagnostic("invalid-hex", "Color entry must contain a valid 3- or 6-digit HEX value.", line, "colors[" + index + "].hex"));
        return;
      }
      const color = { hex: hex };
      if (entry.name !== undefined) {
        if (typeof entry.name !== "string" || !entry.name.trim() || entry.name.trim().length > MAX_COLOR_NAME || /[\r\n]/.test(entry.name)) {
          errors.push(diagnostic("invalid-color-name", "Color name must be 1–" + MAX_COLOR_NAME + " characters on one line.", lineOfKey(text, "name", index + 1), "colors[" + index + "].name"));
        } else color.name = entry.name.trim();
      }
      colors.push(color);
    });
    if (errors.length) return result(null, errors);
    return result({ name: data.name.trim(), colors: colors }, []);
  }

  function exportJSONPalette(input) {
    const palette = normalizePalette(input);
    return JSON.stringify({
      format: JSON_FORMAT,
      version: JSON_VERSION,
      name: palette.name,
      colors: palette.colors.map(function (color) {
        const entry = { hex: color.hex };
        if (color.name) entry.name = color.name;
        return entry;
      })
    }, null, 2) + "\n";
  }

  function canonicalFormat(format) {
    const value = String(format || "").toLowerCase().replace(/^\./, "");
    if (value === "gpl") return "gpl";
    if (value === "pal" || value === "jasc" || value === "jasc-pal") return "jasc-pal";
    if (value === "json") return "json";
    return null;
  }

  function detectFormat(input) {
    if (typeof input !== "string") return null;
    const text = stripBOM(input).trimStart();
    if (text.startsWith("GIMP Palette\n") || text === "GIMP Palette" || /^GIMP Palette\r/.test(text)) return "gpl";
    if (text.startsWith("JASC-PAL\n") || text.startsWith("JASC-PAL\r") || text === "JASC-PAL") return "jasc-pal";
    if (text.charAt(0) === "{") return "json";
    return null;
  }

  function parse(input, format) {
    const selected = canonicalFormat(format) || (!format ? detectFormat(input) : null);
    if (selected === "gpl") return parseGPL(input);
    if (selected === "jasc-pal") return parseJASCPAL(input);
    if (selected === "json") return parseJSONPalette(input);
    return result(null, [diagnostic("unknown-format", "Choose GPL, JASC-PAL (.pal) or One Pixel Studio JSON format.", 1)]);
  }

  function exportPalette(input, format) {
    const selected = canonicalFormat(format);
    if (selected === "gpl") return exportGPL(input);
    if (selected === "jasc-pal") return exportJASCPAL(input);
    if (selected === "json") return exportJSONPalette(input);
    throw new Error("Choose an export format: gpl, jasc-pal or json.");
  }

  return Object.freeze({
    JSON_FORMAT: JSON_FORMAT,
    JSON_VERSION: JSON_VERSION,
    MAX_FILE_BYTES: MAX_FILE_BYTES,
    MAX_COLORS: MAX_COLORS,
    MAX_JASC_COLORS: MAX_JASC_COLORS,
    parseGPL: parseGPL,
    exportGPL: exportGPL,
    parseJASCPAL: parseJASCPAL,
    exportJASCPAL: exportJASCPAL,
    parseJSON: parseJSONPalette,
    exportJSON: exportJSONPalette,
    parse: parse,
    detectFormat: detectFormat,
    export: exportPalette,
    normalizePalette: normalizePalette
  });
});
