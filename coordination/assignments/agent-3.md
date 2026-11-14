# Assignment — Agent 3: Animation / export

## Current task
**AC-002 — Build sprite-sheet PNG and timing metadata exporter**

- State: `REVIEW`
- Branch: `agent/animation-export`
- PR: https://github.com/faiev/ArtClub/pull/3
- Files in the PR: `js/sprite-sheet-export.js`, `tests/sprite-sheet-export.test.js`, `ANIMATION_EXPORT.md`.
- PR description reports 10 exporter tests passing. Full repository/browser CI and real download verification are not reported yet.

Do not wire this into the UI or MCP bridge before the exporter is reviewed and accepted.

## Next assigned task
**AC-007 — Integrate sprite-sheet export into editor and agent workflows**

- State: `QUEUED`
- Dependencies: AC-002 accepted; AC-004 bridge/API changes reviewed and merged or an explicit interface contract approved.
- Start only after the coordinator updates this assignment to `READY`.

The integration must use the accepted exporter module rather than reimplementing composition or metadata. Provide UI controls for layout/margin/spacing, download PNG and JSON, and expose an equivalent structured operation through browser Agent API/MCP. Add browser and MCP tests. Coordinate file ownership before touching `index.html`, `js/agent-api.js`, or `agent-bridge/*`.
