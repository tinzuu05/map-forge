# Contributing to Map Forge

Thank you for considering contributing.

## Development

```bash
npm install
npm run dev
```

## Project structure

- `apps/studio`: full web app
- `packages/core`: data types, coordinate helpers, image line detection
- `packages/three`: Three.js renderer helpers
- `packages/leaflet`: Leaflet coordinate helpers
- `packages/react`: React convenience exports
- `examples/html-css-js`: plain JavaScript example

## Pull request guidelines

- Keep public APIs typed and documented.
- Avoid adding backend dependencies unless necessary.
- Keep generated files and `node_modules` out of commits.
- Be honest about image-detection limitations.
