import type { MapProject, MapShape, MapPoint, Point2D } from "@map-forge/core";
import { imagePointToLeaflet, leafletPointToImage } from "@map-forge/core";

export { imagePointToLeaflet, leafletPointToImage };

export function shapeToLeafletLatLngs(project: MapProject, shape: MapShape): [number, number][] {
  return shape.points.map((point: Point2D) => imagePointToLeaflet(project.imageHeight, point));
}

export function pointToLeafletLatLng(project: MapProject, point: MapPoint): [number, number] {
  return imagePointToLeaflet(project.imageHeight, [point.x, point.y]);
}

export function getSimpleImageBounds(project: MapProject): [[number, number], [number, number]] {
  return [[0, 0], [project.imageHeight, project.imageWidth]];
}
