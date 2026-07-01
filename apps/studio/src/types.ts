export type Point2D = [number, number];

export type ExportFormat = "ts" | "js" | "json";

export interface MapShape {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  height: number;
  opacity: number;
  points: Point2D[];
  holes?: Point2D[][];
  /** box = zip reference style: one detected cell becomes one 3D box. */
  renderMode?: "extrude" | "box";
  box?: { x: number; y: number; width: number; height: number };
}

export interface MapPoint {
  id: string;
  name: string;
  type: "camera" | "sensor" | "door" | "custom";
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface SceneSettings {
  background: string;
  groundColor: string;
  showGrid: boolean;
  showImagePlane: boolean;
  imageOpacity: number;
  ambientLight: number;
  directionalLight: number;
  cameraHeight: number;
  extrusionScale: number;
}

export interface MapProject {
  projectName: string;
  imageUrl: string | null;
  imageName: string | null;
  imageWidth: number;
  imageHeight: number;
  shapes: MapShape[];
  points: MapPoint[];
  settings: SceneSettings;
}
