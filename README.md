# Art Club — One Pixel Studio

A browser-based pixel art editor. It is a static site: no build step, backend, account, API key, or external JavaScript dependency is required.

## Open the editor

**[Launch One Pixel Studio](https://faiev.github.io/ArtClub/)**

## Features

- Exact pixel grid with brush, eraser, flood fill, eyedropper, line, outlined/filled rectangle, and outlined/filled ellipse tools
- Square and rectangular canvas presets, plus custom width and height from 1 to 512 pixels per side
- Custom color palette
- Undo and redo
- Import an image and convert it to the current pixel grid
- Export transparent PNG at native size or 16× scale, crisp SVG, and portable JSON project files
- Multiple local projects in an IndexedDB library, with autosave and one previous-version recovery copy per project
- Versioned editable project format (v2), with automatic migration from earlier single-canvas project files

## AI-agent access

One Pixel Studio exposes a versioned browser Agent API, so browser-connected agents can issue exact pixel operations instead of clicking screen coordinates. A local MCP bridge exposes drawing, inspection, undo/redo, project-library and PNG-preview tools to compatible AI clients.

- [Agent API reference](AGENT_API.md)
- [Local MCP bridge setup](agent-bridge/README.md)

The MCP bridge is optional. It opens a dedicated Chromium profile and connects over local stdio; the static Pages site does not host an MCP server.

## Privacy

Artwork stays in the browser profile. The editor itself does not upload images or project data to a server. Local projects are tied to that browser and device; export a JSON project to back up or move your work. When using a hosted AI model through an MCP client, the client may send canvas data or tool results to that model provider.

## Deployment

This repository is hosted with GitHub Pages from the `main` branch and repository root (`/(root)`). GitHub automatically republishes the static site when changes are pushed to `main`.

To check or change this setting, open **Settings → Pages → Build and deployment** and select **Deploy from a branch**, branch `main`, folder `/(root)`.

No build command or package installation is needed.

## Product roadmap

See [FEATURES.md](FEATURES.md) for the full product specification, current capability audit, prioritized feature backlog, user workflows, acceptance criteria and implementation milestones.

## Developer checks

Run the model and editor-interaction tests with Node.js 24 or later:

```bash
node --test tests/*.test.js
node --check agent-bridge/server.mjs
```

For the real Chromium end-to-end suite, install the optional bridge dependencies and browser:

```bash
cd agent-bridge
npm install
npx playwright install chromium
npm run test:e2e
```

The GitHub Actions workflow runs both the unit/interaction checks and the Chromium end-to-end suite.

The current editor UI still exposes one layer and one frame. The document model already stores layer/frame/cel structure to support future work; this does not mean layer or animation editing is available yet. The browser Agent API currently targets the active visible cel.
