import type { Point2D } from "./types";

export function imageToCenteredThreePoint(imageWidth: number, imageHeight: number, x: number, y: number, z = 0) {
  return { x: x - imageWidth / 2, y: z, z: y - imageHeight / 2 };
}

export function imagePointToLeaflet(imageHeight: number, point: Point2D): [number, number] {
  const [x, y] = point;
  return [imageHeight - y, x];
}

export function leafletPointToImage(imageHeight: number, latLng: [number, number]): Point2D {
  const [lat, lng] = latLng;
  return [lng, imageHeight - lat];
}
