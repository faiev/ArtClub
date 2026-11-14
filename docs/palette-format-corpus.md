# Palette interoperability corpus

The AC-072 corpus tests the palette format module on fixture files plus deterministic generated data. It is intentionally separate from the parser implementation so each fixture represents an input sample rather than a test-generated expectation.

## Fixture inventory

- GPL: named palette with comments, legacy header without Name/Columns, and a UTF-8 BOM + CRLF sample.
- JASC-PAL: version 0100 with CRLF/trailing blanks, truncated declared entries, extra entries, out-of-range channel and zero count.
- JSON: named colors with duplicate values, unknown top-level/color properties, unsupported version and malformed HEX.

The fixtures cover comments, BOM/newline variations, names, duplicates, malformed headers/rows, invalid channels and strict JSON schema handling. Very large inputs are generated in the test rather than stored as a 1 MiB binary-ish text fixture.

## Test strategy

`tests/palette-formats-corpus.test.js` runs fixture parsing, expected diagnostic code checks, format detection, export/import round trips and documented JASC-PAL metadata loss. Seeded LCG generators make property-style cases reproducible; the fixed seeds and bounded loop count ensure the suite has no nondeterministic network, time or random dependencies.

The corpus includes a maximum-supported 4,096-entry JASC-PAL file and generated over-limit input. It asserts preserved order and duplicate values instead of only checking parser success.

Run with:

- `node --check js/palette-formats.js`
- `node --check tests/palette-formats-corpus.test.js`
- `node --test tests/palette-formats-corpus.test.js`
- `node --test tests/palette-formats.test.js tests/palette-formats-corpus.test.js`

Run the repository-wide Node/Chromium/MCP workflow after rebasing the stack onto the latest main/AC-017 head. This phase does not modify UI/API files or the palette parser itself.
