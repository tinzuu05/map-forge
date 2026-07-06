import type { MapProject } from "../types";

export function generateProjectJson(project: MapProject) {
  return JSON.stringify({ ...project, imageUrl: null }, null, 2);
}

function buildExternalThreeCode(payload: string, isTypescript: boolean) {
  const projectType = isTypescript ? "typeof mapProject" : "";
  const sceneType = isTypescript ? ": THREE.Scene" : "";
  const groupReturnType = isTypescript ? ": THREE.Group" : "";
  const meshReturnType = isTypescript ? ": THREE.Mesh | null" : "";
  const vectorReturnType = isTypescript ? ": THREE.Vector3" : "";
  const vec2ReturnType = isTypescript ? ": THREE.Vector2" : "";
  const projectParamType = isTypescript ? `: ${projectType}` : "";
  const shapeParamType = isTypescript ? `: ${projectType}["shapes"][number]` : "";
  const pointParamType = isTypescript ? `: readonly (readonly [number, number])[]` : "";
  const holeCast = isTypescript ? " as readonly (readonly [number, number])[]" : "";
  const holesCast = isTypescript ? " as THREE.Path[]" : "";

  return `import * as THREE from "three";

export const mapProject = ${payload}${isTypescript ? " as const" : ""};

/**
 * Map Forge exported modules use the common Three.js floor-plan convention:
 *
 *   X / Z = floor plane
 *   Y     = height
 *
 * Use createMapForgeGroup() or createMapForgeScene() directly in external projects.
 * Do not rebuild merged polygon walls with your own ExtrudeGeometry logic unless
 * you duplicate the same coordinate conversion and rotateX(-Math.PI / 2) below.
 */
export const mapForgeAxisMode = "y-up-xz-plane";

export function imageToWorldPoint(project${projectParamType}, x${isTypescript ? ": number" : ""}, y${isTypescript ? ": number" : ""}, height = 0)${vectorReturnType} {
  return new THREE.Vector3(
    x - project.imageWidth / 2,
    height,
    y - project.imageHeight / 2
  );
}

function imageToShapePoint(project${projectParamType}, x${isTypescript ? ": number" : ""}, y${isTypescript ? ": number" : ""})${vec2ReturnType} {
  return new THREE.Vector2(
    x - project.imageWidth / 2,
    project.imageHeight / 2 - y
  );
}

function createShapePath(project${projectParamType}, points${pointParamType}) {
  const path = new THREE.Shape();

  points.forEach(([x, y], index) => {
    const p = imageToShapePoint(project, x, y);
    if (index === 0) path.moveTo(p.x, p.y);
    else path.lineTo(p.x, p.y);
  });

  path.closePath();
  return path;
}

export function createMapForgeBoxWall(project${projectParamType}, shape${shapeParamType})${meshReturnType} {
  if (!shape.box) return null;

  const wallHeight = shape.height * project.settings.extrusionScale;
  const geometry = new THREE.BoxGeometry(
    shape.box.width * 0.98,
    wallHeight,
    shape.box.height * 0.98
  );

  const material = new THREE.MeshStandardMaterial({
    color: shape.color,
    transparent: shape.opacity < 1,
    opacity: shape.opacity,
    roughness: 0.74,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(
    imageToWorldPoint(
      project,
      shape.box.x + shape.box.width / 2,
      shape.box.y + shape.box.height / 2,
      wallHeight / 2
    )
  );

  mesh.name = shape.name;
  mesh.userData = {
    id: shape.id,
    source: "Map Forge Studio",
    renderMode: "box",
    axisMode: mapForgeAxisMode,
  };

  return mesh;
}

export function createMapForgeExtrudeWall(project${projectParamType}, shape${shapeParamType})${meshReturnType} {
  if (!shape.points || shape.points.length < 3) return null;

  const wallHeight = shape.height * project.settings.extrusionScale;
  const outline = createShapePath(project, shape.points);

  outline.holes = (shape.holes || []).map((hole) => {
    const path = new THREE.Path();

    (hole${holeCast}).forEach(([x, y], index) => {
      const p = imageToShapePoint(project, x, y);
      if (index === 0) path.moveTo(p.x, p.y);
      else path.lineTo(p.x, p.y);
    });

    path.closePath();
    return path;
  })${holesCast};

  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: wallHeight,
    bevelEnabled: false,
  });

  // Critical for merged walls:
  // ExtrudeGeometry extrudes on +Z by default. Rotate it into +Y so merged
  // polygon walls use the same X/Z floor plane and Y height as box walls.
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: shape.color,
    transparent: shape.opacity < 1,
    opacity: shape.opacity,
    roughness: 0.74,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = shape.name;
  mesh.userData = {
    id: shape.id,
    source: "Map Forge Studio",
    renderMode: shape.renderMode || "extrude",
    axisMode: mapForgeAxisMode,
  };

  return mesh;
}

export function createMapForgePointMarker(project${projectParamType}, point${isTypescript ? `: ${projectType}["points"][number]` : ""}) {
  const geometry = new THREE.SphereGeometry(8, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color: point.color });
  const marker = new THREE.Mesh(geometry, material);

  marker.position.copy(imageToWorldPoint(project, point.x, point.y, point.z));
  marker.name = point.name;
  marker.userData = point;

  return marker;
}

export function createMapForgeGroup(project = mapProject)${groupReturnType} {
  const group = new THREE.Group();
  group.name = project.projectName;
  group.userData = {
    source: "Map Forge Studio",
    axisMode: mapForgeAxisMode,
  };

  project.shapes.forEach((shape) => {
    const mesh =
      shape.renderMode === "box" && shape.box
        ? createMapForgeBoxWall(project, shape)
        : createMapForgeExtrudeWall(project, shape);

    if (mesh) group.add(mesh);
  });

  project.points.forEach((point) => {
    group.add(createMapForgePointMarker(project, point));
  });

  return group;
}

export function createMapForgeScene(scene${sceneType}, project = mapProject)${groupReturnType} {
  scene.background = new THREE.Color(project.settings.background);

  const ambient = new THREE.AmbientLight(0xffffff, project.settings.ambientLight);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, project.settings.directionalLight);
  directional.position.set(300, 500, 600);
  scene.add(directional);

  const group = createMapForgeGroup(project);
  scene.add(group);

  return group;
}
`;
}

export function generateThreeTsCode(project: MapProject) {
  const payload = JSON.stringify({ ...project, imageUrl: null }, null, 2);
  return buildExternalThreeCode(payload, true);
}

export function generateThreeJsCode(project: MapProject) {
  const payload = JSON.stringify({ ...project, imageUrl: null }, null, 2);
  return buildExternalThreeCode(payload, false);
}
