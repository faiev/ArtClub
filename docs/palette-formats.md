# Palette file formats

The dependency-free module in js/palette-formats.js imports and exports GIMP GPL, JASC-PAL 0100, and the One Pixel Studio JSON palette format. It supports CommonJS and exposes a browser global named ArtClubPaletteFormats. This task adds no UI controls or editor wiring.

## Format behavior

- GPL preserves palette names, optional Columns metadata, color names, order, and duplicate entries. Legacy GPL files without a Name line are accepted.
- JASC-PAL preserves RGB values, order, and duplicates. The format has no palette-name or color-name fields, so those values cannot be preserved in PAL files.
- JSON preserves palette names, color names, order, and duplicates. The version 1 schema uses format identifier one-pixel-studio-palette and color entries with a hex value and optional name.

All parsed colors become uppercase #RRGGBB. Three-digit JSON HEX is expanded. RGB channels are validated as decimal integers from 0 through 255; values are never clamped.

## API

The module provides parseGPL, exportGPL, parseJASCPAL, exportJASCPAL, parseJSON, exportJSON, parse, detectFormat, export, and normalizePalette. The unified parse method accepts an optional format name (gpl, jasc-pal, pal, or json). Export methods accept either a string array of HEX colors or an object with name and colors fields.

Parser results contain ok, palette, errors, and warnings. Failed parses return a null palette. Each diagnostic includes a stable code, a human-readable message, and a 1-based source line; JSON schema errors also include a path when available. Export validation throws an Error instead of silently dropping malformed values.

## Limits and validation

- Input files are limited to 1 MiB of UTF-8 data.
- Palettes contain 1–4096 colors. The JASC-PAL limit is a defensive application bound.
- GPL requires the GIMP Palette header; optional Name and Columns metadata are validated. Blank lines and hash comments are ignored.
- JASC-PAL requires the JASC-PAL header, version 0100, a valid declared count, and exactly that many RGB rows. Trailing blank lines are allowed.
- JSON rejects unknown top-level fields, unknown color fields, malformed color entries, unsupported versions, and invalid HEX strings.

## Integration boundary

The current editor stores palette colors as HEX strings. Parse results return structured color objects so future UI work can retain names. File pickers, downloads, palette mutation, and editor integration are intentionally outside AC-017 and require a separate coordinator assignment and file lock.
