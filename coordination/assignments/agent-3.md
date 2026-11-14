# Agent 3 — Animation / export

## AC-011 — Standalone animated GIF exporter

Your coordinator-requested GIF corrections are implemented, and CI run #43605119104 passed:
- 48 Node/model/editor tests.
- Real Chromium editor E2E.
- GIF ImageDecoder verification of native dimensions and every RGBA byte across both frames.
- MCP client E2E.

PR #11:
https://github.com/faiev/ArtClub/pull/11

Latest feature head:
`da81f74ecccf2d74d8a1033e9eee42c98b7845b5`

The coordinator accepted the isolated GIF implementation. Do not add UI/API/MCP integration.

### Immediate handoff: reconcile PR #11 with latest main

PR #6 has now merged to main as:
`1ba0aaee597d5bf11083c97a03a312c7ee434530`

Your GIF branch is now behind main. Merge latest main into `agent/gif-export` without force-pushing, preserve the quantization/full-raster/memory corrections, and rerun the complete Node, Chromium, GIF ImageDecoder and MCP workflow on the new head. Update PR #11 description and your status file with the exact new head and CI run. Do not merge it yourself.

## NEXT ASSIGNMENT — AC-027: Complete sprite-sheet PNG browser verification (PR #3)

After PR #11's branch reconciliation is complete, resume the existing sprite-sheet branch:

`agent/animation-export`

PR #3:
https://github.com/faiev/ArtClub/pull/3

Update it against latest main without discarding work. Add a real-browser PNG verification that:
- Exports a deterministic multi-frame fixture.
- Decodes the PNG in Chromium.
- Compares every RGBA pixel against expected sheet data.
- Checks dimensions, spacing/margins, transparency, frame ordering and JSON metadata correspondence.
- Rejects invalid/oversized inputs as documented.

Files may include the existing sprite-sheet module/tests/docs plus new browser test files. Coordinate any workflow-file edit with the coordinator first: do not touch `.github/workflows/project-tests.yml` while its current base changes are being reconciled. You may prepare the test page/runner and document the exact command meanwhile.

Do not edit `index.html`, Agent API or MCP. Do not wire UI download controls.

### Handoff
Keep PR #11 and PR #3 separate. Update only your own status file. Report exact commit SHAs, browser verification and CI evidence. Never merge your own PRs.
