# Import staging and recovery semantics

## AC-059 — Candidate-only import validation

`js/import-staging.js` stages project and decoded-image import candidates without writing to the live project or storage. It is dependency-free aside from the existing `ArtClubProject` model. It exposes browser global `ArtClubImportStaging` and a CommonJS export.

### Project import

`stageProjectImport(input, options?)` accepts a project object, JSON string or UTF-8 byte input.

The staging sequence is:

1. Validate the options and enforce the byte ceiling before parsing string/byte inputs.
2. Parse the candidate without touching the current project.
3. Check canvas dimensions, collection bounds, dense array slots, cel dimensions, explicit `null`/HEX pixel entries, and the aggregate cel-pixel budget.
4. Run the canonical project-model validator and deserialize/migrate only after preflight passes.
5. Return a deeply frozen detached candidate and a `replace-project` commit description. No partial commit object is returned on failure.

Default limits: 32 MiB source bytes; 512 × 512 canvas; 32 layers; 256 frames; 256 palette colors; 16,777,216 aggregate cel-pixel slots. The project validator's sparse-skipping `.some()` behavior is not trusted for pixel density; staging checks own array slots with indexed loops first.

Legacy single-canvas projects are migrated by the existing project model and receive a `LEGACY_PROJECT_MIGRATED` warning. Missing optional project metadata receives a warning.

### Image import

`stageImageImport({width, height, rgba, sourceBytes?}, {palette, targetWidth?, targetHeight?, alphaThreshold?, maxBytes?})` accepts decoded RGBA byte data as a dense array or byte typed array.

It checks source and decoded byte counts, source/target dimensions, pixel budget, palette validity, RGBA length and every byte value before quantization. It uses deterministic nearest-palette RGB mapping and nearest-neighbor contain fitting. Pixels below the alpha threshold and letterbox padding are returned as explicit `null`.

The staged commit contains a frozen row-major pixel array and its target dimensions. Warnings report transparency, palette quantization and image resizing; errors return diagnostics and `commit: null`.

Default image limits: 8 MiB source/decoded bytes, 512 × 512 pixels, alpha threshold 32. The caller may lower per-import `maxBytes` but cannot raise the hard ceiling.

### Rollback and immutability contract

Both APIs are pure candidate operations. They do not call storage, mutate the source candidate, alter the existing project, or publish a live state. A failure always returns `ok: false`, a diagnostic list and `commit: null`. The coordinator-owned integration layer must keep the current project unchanged until staging succeeds and a later authorized commit succeeds. Persist failure after such a commit must restore the prior snapshot; this module deliberately does not implement or call persistence.
