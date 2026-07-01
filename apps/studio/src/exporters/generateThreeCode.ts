import type { MapProject } from "../types";

export function generateProjectJson(project: MapProject) {
  return JSON.stringify({ ...project, imageUrl: null }, null, 2);
}

export function generateThreeTsCode(project: MapProject) {
  const payload = JSON.stringify({ ...project, imageUrl: null }, null, 2);
  return `import * as THREE from "three";

export const mapProject = ${payload} as const;

function toThreePoint(x: number, y: number, imageHeight: number) {
  return new THREE.Vector2(x - mapProject.imageWidth / 2, imageHeight / 2 - y);
}

export function createMapForgeScene(scene: THREE.Scene) {
  scene.background = new THREE.Color(mapProject.settings.background);

  const ambient = new THREE.AmbientLight(0xffffff, mapProject.settings.ambientLight);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, mapProject.settings.directionalLight);
  directional.position.set(300, 500, 600);
  scene.add(directional);

  const group = new THREE.Group();
  group.name = mapProject.projectName;

  mapProject.shapes.forEach((area) => {
    const material = new THREE.MeshStandardMaterial({
      color: area.color,
      transparent: area.opacity < 1,
      opacity: area.opacity,
      roughness: 0.74,
      metalness: 0.08,
    });

    if (area.renderMode === "box" && area.box) {
      const wallHeight = area.height * mapProject.settings.extrusionScale;
      const geometry = new THREE.BoxGeometry(area.box.width * 0.98, wallHeight, area.box.height * 0.98);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        area.box.x + area.box.width / 2 - mapProject.imageWidth / 2,
        wallHeight / 2,
        area.box.y + area.box.height / 2 - mapProject.imageHeight / 2,
      );
      mesh.name = area.name;
      mesh.userData = { id: area.id, source: "Map Forge Studio", renderMode: "box" };
      group.add(mesh);
      return;
    }

    const shape = new THREE.Shape();
    area.points.forEach(([x, y], index) => {
      const p = toThreePoint(x, y, mapProject.imageHeight);
      if (index === 0) shape.moveTo(p.x, p.y);
      else shape.lineTo(p.x, p.y);
    });

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: area.height * mapProject.settings.extrusionScale,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = area.name;
    mesh.userData = { id: area.id, source: "Map Forge Studio" };
    group.add(mesh);
  });

  mapProject.points.forEach((point) => {
    const geometry = new THREE.SphereGeometry(8, 24, 24);
    const material = new THREE.MeshStandardMaterial({ color: point.color });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(
      point.x - mapProject.imageWidth / 2,
      point.z,
      point.y - mapProject.imageHeight / 2,
    );
    marker.name = point.name;
    marker.userData = point;
    group.add(marker);
  });

  scene.add(group);
  return group;
}
`;
}

export function generateThreeJsCode(project: MapProject) {
  return generateThreeTsCode(project)
    .replace(" as const", "")
    .replace(/: number/g, "")
    .replace(/: THREE.Scene/g, "")
    .replace(/import \* as THREE from "three";/, 'import * as THREE from "three";');
}
