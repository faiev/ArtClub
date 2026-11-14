# Art Club — One Pixel Studio

A browser-based pixel art editor. It is a static site: no build step, backend, account, API key, or external JavaScript dependency is required.

## Open the editor

**[Launch One Pixel Studio](https://faiev.github.io/ArtClub/)**

## Features

- Exact pixel grid with brush, eraser, flood fill, eyedropper, line, and rectangle tools
- 16×16, 24×24, 32×32, 48×48, and 64×64 canvas sizes
- Custom color palette
- Undo and redo
- Import an image and convert it to the current pixel grid
- Export transparent PNG at native size or 16× scale, crisp SVG, and portable JSON project files
- Automatic local save in the current browser

## Privacy

Artwork stays in your browser. The editor does not upload images or project data to a server. Local save is tied to the browser and device; export a JSON project to back up or move your work.

## Deployment

This repository is hosted with GitHub Pages from the `main` branch and repository root (`/(root)`). GitHub automatically republishes the static site when changes are pushed to `main`.

To check or change this setting, open **Settings → Pages → Build and deployment** and select **Deploy from a branch**, branch `main`, folder `/(root)`.

No build command or package installation is needed.

## Product roadmap

See [FEATURES.md](FEATURES.md) for the full product specification, current capability audit, prioritized feature backlog, user workflows, acceptance criteria and implementation milestones.
