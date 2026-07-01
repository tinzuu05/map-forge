import * as THREE from "three";
import type { MapPoint, MapProject, MapShape } from "@map-forge/core";
import { imageToCenteredThreePoint } from "@map-forge/core";

export interface ThreeMapOptions {
  includeGround?: boolean;
  includePoints?: boolean;
}

function makeVector(project: MapProject, x: number, y: number, z = 0) {
  const p = imageToCenteredThreePoint(project.imageWidth, project.imageHeight, x, y, z);
  return new THREE.Vector3(p.x, p.y, p.z);
}

function createBoxWall(project: MapProject, shape: MapShape) {
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const depth = Math.max(1, maxY - minY);
  const height = Math.max(1, shape.height || 40);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: shape.color, transparent: true, opacity: shape.opacity ?? 1 })
  );
  mesh.position.copy(makeVector(project, (minX + maxX) / 2, (minY + maxY) / 2, height / 2));
  mesh.name = shape.name || shape.id;
  mesh.userData = { kind: "shape", shapeId: shape.id };
  return mesh;
}

function createExtrudedShape(project: MapProject, shape: MapShape) {
  if (shape.points.length < 3) return null;
  const threeShape = new THREE.Shape();
  shape.points.forEach(([x, y], index) => {
    const px = x - project.imageWidth / 2;
    const py = y - project.imageHeight / 2;
    if (index === 0) threeShape.moveTo(px, py);
    else threeShape.lineTo(px, py);
  });
  threeShape.closePath();
  const geometry = new THREE.ExtrudeGeometry(threeShape, { depth: shape.height || 40, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: shape.color, transparent: true, opacity: shape.opacity ?? 1 }));
  mesh.name = shape.name || shape.id;
  mesh.userData = { kind: "shape", shapeId: shape.id };
  return mesh;
}

function createPoint(project: MapProject, point: MapPoint) {
  const group = new THREE.Group();
  const color = point.color || "#ffcc66";
  const z = point.z ?? 80;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(8, 24, 24),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 })
  );
  sphere.position.copy(makeVector(project, point.x, point.y, z));
  sphere.name = point.name || point.id;
  sphere.userData = { kind: "point", point };
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([makeVector(project, point.x, point.y, 0), makeVector(project, point.x, point.y, z)]),
    new THREE.LineBasicMaterial({ color })
  );
  group.add(line, sphere);
  return group;
}

export function createThreeMap(project: MapProject, options: ThreeMapOptions = {}) {
  const group = new THREE.Group();
  group.name = project.projectName || "Map Forge Map";

  if (options.includeGround !== false) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(project.imageWidth, project.imageHeight),
      new THREE.MeshStandardMaterial({ color: project.settings?.groundColor || "#1f2937", side: THREE.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.name = "ground";
    group.add(ground);
  }

  for (const shape of project.shapes || []) {
    const mesh = shape.renderMode === "box" ? createBoxWall(project, shape) : createExtrudedShape(project, shape);
    if (mesh) group.add(mesh);
  }

  if (options.includePoints !== false) {
    for (const point of project.points || []) group.add(createPoint(project, point));
  }

  return group;
}
