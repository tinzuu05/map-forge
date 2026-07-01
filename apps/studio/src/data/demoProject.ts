import type { MapProject } from "../types";

export const demoProject: MapProject = {
  projectName: "Map Forge Demo",
  imageUrl: null,
  imageName: null,
  imageWidth: 1200,
  imageHeight: 800,
  settings: {
    background: "#0e1726",
    groundColor: "#182235",
    showGrid: true,
    showImagePlane: true,
    imageOpacity: 0.5,
    ambientLight: 0.85,
    directionalLight: 1.2,
    cameraHeight: 920,
    extrusionScale: 1,
  },
  shapes: [
    {
      id: "area-a",
      name: "Lobby",
      color: "#8aa399",
      borderColor: "#e9f1ef",
      height: 46,
      opacity: 0.95,
      points: [[80, 80], [450, 80], [450, 310], [80, 310]],
    },
    {
      id: "area-b",
      name: "Control Room",
      color: "#a8b8d8",
      borderColor: "#ffffff",
      height: 90,
      opacity: 0.95,
      points: [[510, 90], [980, 90], [1060, 260], [930, 410], [510, 390]],
    },
    {
      id: "area-c",
      name: "Storage",
      color: "#d7b98e",
      borderColor: "#ffffff",
      height: 64,
      opacity: 0.92,
      points: [[135, 380], [425, 355], [520, 590], [170, 665]],
    },
  ],
  points: [
    { id: "pt-1", name: "Camera 01", type: "camera", x: 230, y: 180, z: 72, color: "#ffcc66" },
    { id: "pt-2", name: "Sensor A", type: "sensor", x: 730, y: 250, z: 116, color: "#66e3ff" },
    { id: "pt-3", name: "Door", type: "door", x: 340, y: 520, z: 82, color: "#ff8f8f" },
  ],
};
