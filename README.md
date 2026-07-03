# Map Forge

Map Forge is an open-source browser toolkit for converting 2D floor plans into approximate 3D wall models, exporting reusable Three.js code, and keeping points compatible with Leaflet-style 2D coordinates.

> Status: `v0.1.0-alpha`. This project is useful for prototypes, indoor maps, IoT/camera/sensor visualization, and digital-twin demos. It does not guarantee perfect BIM/CAD reconstruction from arbitrary JPG images.

## v0.1.4

Added selected wall editing and connected wall merge:

- Select generated 3D walls in the 3D or flat preview.
- Edit selected walls individually after generation, including wall height, color, and opacity.
- Batch-edit selected wall height and color.
- Merge multiple selected walls into one wall only when the selected walls are connected.
- Non-connected selected walls are blocked from merging.


## v0.1.3 update

- Added drag-and-drop upload for floor plan images.
- Added a Neon blueprint / dark thin lines preset for thin cyan linework on dark backgrounds.
- Tuned HUD preset and default line coverage thresholds for anti-aliased thin lines.


## v0.1.5 update

- Merged selected connected walls now become an orthogonal polygon outline instead of a single bounding rectangle.
- Selected wall height/color editing now uses draft inputs and Apply buttons to avoid preview lag while typing.
- Added group height editing for multi-selected walls.
- Merge is still restricted to connected wall blocks.

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


## v0.1.6

- Fixed responsive layout overflow in the center preview header.
- Grouped selected-wall actions separately from the preview switcher.
- Improved tablet/mobile wrapping for the top-right controls in the preview area.

## v0.1.7

- Fixed responsive preview header overflow.
- Prevented project title text from being truncated in the middle preview panel.
- Moved the code export panel below preview on medium-width screens to avoid cutting/squeezing the 3D canvas.
- Improved long select/control layout in the left settings panel.


## Changelog


### v0.1.15

- Added Undo / Redo history for wall and project edits.
- Added header buttons for returning to the previous or next edit state.
- Added keyboard shortcuts: Cmd/Ctrl+Z for undo and Cmd/Ctrl+Shift+Z for redo.



### v0.1.14

- Fixed the preset/apply-mode control in the left panel.
- Preset selection now spans the full panel width instead of being squeezed into the two-column label/input layout.
- Prevented long preset text from rendering vertically.



### v0.1.13

- Fixed checkbox rows in the left panel so they no longer use the same ratio as normal label/input rows.
- Checkbox options now render as full-width rows with a compact checkbox and readable label text.



### v0.1.12

- Fixed the left panel settings layout by targeting `.grid-two`, which is the actual layout used by Auto Detection and Scene settings.
- Restored true label-left / input-right alignment on desktop widths.
- Kept mobile stacked fallback for narrow screens.



### v0.1.11

- Restored the left panel control layout to a left-label / right-input style on desktop widths.
- Kept responsive stacked controls only for narrow mobile layouts.
- Added overflow-safe select styling for long English option labels.



### v0.1.10

- Kept the `3D Preview / Flat Preview` switch in a stable top-right header position.
- Moved selected-wall actions into a separate responsive row below the title row.
- Reduced header movement when selecting and deselecting walls.



### v0.1.9

- Fixed the preview header taking too much vertical space when no wall is selected.
- Added compact and expanded preview header states.
- The header stays compact by default and only expands when selected wall actions are visible.



### v0.1.8

- Fixed responsive overflow in the center preview header.
- Removed fixed preview header row height so selected-wall actions no longer get clipped.
- Improved selected-wall action wrapping on tablet and narrow desktop widths.
