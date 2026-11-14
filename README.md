# Art Club — One Pixel Studio

A browser-based pixel art editor. It is a static site: no build step, backend, account, API key, or external JavaScript dependency is required.

## Open the editor

Once GitHub Pages finishes its first deployment:

**https://faiev.github.io/ArtClub/**

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

A GitHub Actions workflow in `.github/workflows/pages.yml` deploys the static site whenever a commit is pushed to `main`.

If this is the first deployment, open **Settings → Pages** in this repository and set **Build and deployment → Source** to **GitHub Actions**. The workflow will then publish the site automatically. You can follow its progress in the **Actions** tab.

No build command or package installation is needed.
