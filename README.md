# Map Forge

Map Forge is an open-source browser toolkit for converting 2D floor plans into approximate 3D wall models, exporting reusable Three.js code, and keeping points compatible with Leaflet-style 2D coordinates.

> Status: `v0.1.0-alpha`. This project is useful for prototypes, indoor maps, IoT/camera/sensor visualization, and digital-twin demos. It does not guarantee perfect BIM/CAD reconstruction from arbitrary JPG images.

## v0.1.3 update

- Added drag-and-drop upload for floor plan images.
- Added a Neon blueprint / dark thin lines preset for thin cyan linework on dark backgrounds.
- Tuned HUD preset and default line coverage thresholds for anti-aliased thin lines.

## Clean install note

This release does not include `node_modules`, `.npmrc`, or `package-lock.json`.
If npm tries to fetch from an internal registry or hangs, run:

```bash
rm -rf node_modules package-lock.json
npm config set registry https://registry.npmjs.org/
npm install --no-audit --no-fund
npm run dev
```

## What is included?

```txt
map-forge/
├─ apps/
│  └─ studio/              # Full Map Forge Studio web app
├─ packages/
│  ├─ core/                # Types, coordinate helpers, image line detection
│  ├─ three/               # Three.js renderer helpers
│  ├─ leaflet/             # Leaflet CRS.Simple coordinate helpers
│  └─ react/               # React convenience exports
├─ examples/
│  └─ html-css-js/         # Plain HTML/CSS/JS usage example
├─ README.md
├─ LICENSE
└─ package.json
```

## Two product layers

### 1. Map Forge Studio

A complete Web App for users:

- Upload a 2D floor plan image
- Enhance and detect 2D lines
- Generate approximate 3D walls
- Preview in Three.js
- Preview points in a Leaflet-compatible 2D map
- Add/edit/delete areas and points
- Export JSON / JavaScript / TypeScript
- Bilingual UI: Traditional Chinese and English
- Responsive layout

### 2. Map Forge SDK

Reusable packages for developers:

```bash
npm install @map-forge/core @map-forge/three @map-forge/leaflet
```

In this alpha monorepo, packages are local workspaces. They are structured so you can publish them to npm later.

## Quick start

```bash
cd map-forge-monorepo-v0.1.0
npm install
npm run dev
```

This starts the Studio app from `apps/studio`.

## Build

```bash
npm run build
```

## Plain HTML example

```bash
cd examples/html-css-js
python3 -m http.server 5173
```

Open:

```txt
http://localhost:5173
```

## Recommended GitHub repo name

```txt
map-forge
```

## Best source images

For best results, use:

- Clean high-contrast floor plans
- SVG or CAD-exported images
- Images with clear wall/line edges
- Avoid low-resolution screenshots when possible

## License

MIT


## npm install note

This release uses `file:` links for local packages instead of the `workspace:*` protocol, so it works with standard npm installs more reliably. Run commands from the repository root:

```bash
npm install
npm run dev
```

If you previously installed an older version and saw `EUNSUPPORTEDPROTOCOL workspace:*`, delete the old folder or run:

```bash
rm -rf node_modules package-lock.json
npm install
```
