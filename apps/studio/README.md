# Map Forge Studio

Open-source 2D floor-plan to Three.js 3D map studio.

## Features

- Upload a 2D floor plan image.
- Convert detected 2D linework into 3D wall boxes.
- Presets for General, Blueprint, HUD, Light, Dark, and CAD-style maps.
- Bilingual UI: Traditional Chinese and English.
- Collapsible left-side panels.
- Search for 3D areas and Leaflet / 3D points.
- Remove uploaded floor-plan images.
- Select generated walls in 3D or flat preview and delete them.
- Export TypeScript, JavaScript, or JSON.
- Copy feedback and downloadable export files.

## Getting started

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

## Build

```bash
npm run build
```

## Project structure

```txt
src/
  components/     UI panels
  data/           demo project data
  exporters/      Three.js / JSON export generation
  leaflet/        flat preview using Leaflet CRS.Simple
  three/          Three.js 3D preview
  utils/          image detection and download helpers
  i18n.ts         Traditional Chinese / English labels
```

## Open-source notes

This project intentionally avoids server-side dependencies. The uploaded image is processed in the browser. Exported code can be reused in other Three.js projects.

## License

MIT


## v2.2 updates

- Language switch moved to the top of the left panel.
- Added 3D camera angle buttons: Top, Front, Side, Iso.
- Reset project now clears the native file input so a new image can be uploaded immediately.
- Larger collapsible section controls.
- Auto 2D Lines, Scene, 3D Areas, and 3D Points now use localized labels.
- Numeric settings use number inputs with dedicated + / - stepper buttons.


## v2.3 Fixes

- Moved language selector to the top-right of the right panel.
- Removed angle-switch buttons. 3D view now relies on native Three.js OrbitControls: drag to rotate, scroll to zoom, right-drag to pan.
- Wall selection is now click-only, so dragging on walls no longer blocks camera rotation.


## v2.4 updates

- Removed custom +/- buttons beside numeric inputs; native number controls remain.
- Made collapsible section toggles larger and borderless.
- Preserves the user camera angle when selecting walls in the 3D preview.



## v2.4.2

- Fixed English UI translations for Auto 2D Lines, Scene, and 3D Areas.
- Reworked floor plan upload filename layout to avoid vertical wrapping.
- Replaced native JSON file input with a localized custom file picker.


## v2.5 Responsive preview update

- The central Three.js / flat preview workspace now resizes across desktop, tablet, and mobile layouts.
- Desktop keeps the three-column studio layout.
- Tablet and mobile switch to a single-column flow: settings, preview, then code export.
- Three.js and Leaflet previews observe their container size and update the renderer/map automatically.


## v2.6 Mobile / Tablet RWD Fix

- Fixed tablet-to-phone layout overflow.
- Middle preview now stacks correctly between settings and export panels.
- Three.js and Leaflet preview containers keep a stable responsive height.
- Mobile toolbars, upload actions, search rows, and export buttons now wrap into single-column layout.
- Prevented horizontal scrolling caused by panels, code preview, buttons, and segmented controls.


## v2.7

- Updated Leaflet zoom controls to a dark HUD style with hover, active, and disabled states.
