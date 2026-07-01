# Architecture

Map Forge is organized as a monorepo.

## apps/studio

The full interactive product.

## packages/core

Stable data models and algorithms:

- `MapProject`
- `MapShape`
- `MapPoint`
- line detection
- coordinate conversions

## packages/three

Renderer for turning a `MapProject` into a Three.js `Group`.

## packages/leaflet

Coordinate conversion helpers for `CRS.Simple` style maps.

## packages/react

Convenience exports for React projects. More reusable UI components can be moved here later.
