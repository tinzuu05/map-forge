import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MapProject, MapShape } from "../types";
import type { Language } from "../i18n";

function toVector2(x: number, y: number, width: number, height: number) {
  return new THREE.Vector2(x - width / 2, height / 2 - y);
}

function makeShapeMesh(area: MapShape, project: MapProject, selectedShapeIds: string[]) {
  const isSelected = selectedShapeIds.includes(area.id);
  const material = new THREE.MeshStandardMaterial({
    color: isSelected ? "#facc15" : area.color,
    transparent: area.opacity < 1,
    opacity: isSelected ? Math.max(area.opacity, 0.98) : area.opacity,
    roughness: 0.72,
    metalness: 0.04,
    emissive: isSelected ? "#7c2d12" : "#000000",
    emissiveIntensity: isSelected ? 0.35 : 0,
  });

  const shape = new THREE.Shape();
  area.points.forEach(([x, y], index) => {
    const p = toVector2(x, y, project.imageWidth, project.imageHeight);
    if (index === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  });

  area.holes?.forEach((holePoints) => {
    const hole = new THREE.Path();
    holePoints.forEach(([x, y], index) => {
      const p = toVector2(x, y, project.imageWidth, project.imageHeight);
      if (index === 0) hole.moveTo(p.x, p.y);
      else hole.lineTo(p.x, p.y);
    });
    shape.holes.push(hole);
  });

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: area.height * project.settings.extrusionScale,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = area.name;
  mesh.userData.shapeId = area.id;
  mesh.userData.selectable = true;
  return mesh;
}

function addBoxShapesAsInstancedMeshes(
  scene: THREE.Scene,
  boxAreas: MapShape[],
  project: MapProject,
  selectedShapeIds: string[],
) {
  const selectedSet = new Set(selectedShapeIds);
  const groups = new Map<string, MapShape[]>();

  boxAreas.forEach((area) => {
    if (!area.box) return;
    const key = `${area.color}|${area.opacity}|${area.height}|${area.box.width}|${area.box.height}`;
    const list = groups.get(key) ?? [];
    list.push(area);
    groups.set(key, list);
  });

  const matrix = new THREE.Matrix4();
  groups.forEach((areas) => {
    const first = areas[0];
    if (!first.box) return;
    const wallHeight = first.height * project.settings.extrusionScale;
    const geometry = new THREE.BoxGeometry(first.box.width * 0.98, wallHeight, first.box.height * 0.98);
    const material = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      transparent: first.opacity < 1,
      opacity: first.opacity,
      roughness: 0.72,
      metalness: 0.04,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, areas.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `MapForge selectable walls (${areas.length})`;
    mesh.userData.selectable = true;
    mesh.userData.shapeIds = areas.map((area) => area.id);

    const normalColor = new THREE.Color(first.color);
    const selectedColor = new THREE.Color("#facc15");

    areas.forEach((area, index) => {
      if (!area.box) return;
      matrix.makeTranslation(
        area.box.x + area.box.width / 2 - project.imageWidth / 2,
        wallHeight / 2,
        area.box.y + area.box.height / 2 - project.imageHeight / 2,
      );
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, selectedSet.has(area.id) ? selectedColor : normalColor);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  });
}

interface ThreePreviewProps {
  project: MapProject;
  selectedShapeIds: string[];
  onSelectedShapeIdsChange: (ids: string[]) => void;
  language: Language;
}

export default function ThreePreview({ project, selectedShapeIds, onSelectedShapeIdsChange, language }: ThreePreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cameraStateRef = useRef<{
    position: [number, number, number];
    target: [number, number, number];
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = host.clientWidth || 900;
    const height = host.clientHeight || 700;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(project.settings.background);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    const mapSize = Math.max(project.imageWidth, project.imageHeight, 600);
    const previousCameraState = cameraStateRef.current;

    if (previousCameraState) {
      camera.position.set(...previousCameraState.position);
      camera.lookAt(...previousCameraState.target);
    } else {
      camera.position.set(mapSize * 0.55, project.settings.cameraHeight || mapSize * 0.85, mapSize * 0.85);
      camera.lookAt(0, 0, 0);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = project.shapes.length < 1200;
    host.innerHTML = "";
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    if (previousCameraState) {
      controls.target.set(...previousCameraState.target);
    } else {
      controls.target.set(0, 0, 0);
    }
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, project.settings.ambientLight));
    const dir = new THREE.DirectionalLight(0xffffff, project.settings.directionalLight);
    dir.position.set(400, 700, 600);
    dir.castShadow = project.shapes.length < 1200;
    scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(project.imageWidth, project.imageHeight),
      new THREE.MeshStandardMaterial({ color: project.settings.groundColor, roughness: 0.8 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = project.shapes.length < 1200;
    ground.name = "Ground";
    scene.add(ground);

    if (project.settings.showGrid) {
      const grid = new THREE.GridHelper(Math.max(project.imageWidth, project.imageHeight), 24, 0x8090a0, 0x344052);
      grid.position.y = 0;
      scene.add(grid);
    }

    if (project.imageUrl && project.settings.showImagePlane) {
      const texture = new THREE.TextureLoader().load(project.imageUrl);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(project.imageWidth, project.imageHeight),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: project.settings.imageOpacity }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = 1;
      plane.name = "Image plane";
      scene.add(plane);
    }

    const boxAreas = project.shapes.filter((area) => area.renderMode === "box" && area.box);
    const shapeAreas = project.shapes.filter((area) => !(area.renderMode === "box" && area.box));
    addBoxShapesAsInstancedMeshes(scene, boxAreas, project, selectedShapeIds);
    shapeAreas.forEach((area) => scene.add(makeShapeMesh(area, project, selectedShapeIds)));

    project.points.forEach((point) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(10, 16, 16),
        new THREE.MeshStandardMaterial({ color: point.color, emissive: point.color, emissiveIntensity: 0.25 }),
      );
      marker.position.set(point.x - project.imageWidth / 2, point.z, point.y - project.imageHeight / 2);
      marker.name = point.name;
      scene.add(marker);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const pickShapeId = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        const object = hit.object as THREE.Object3D & { instanceId?: number };
        const shapeIds = object.userData.shapeIds as string[] | undefined;
        if (shapeIds && hit.instanceId !== undefined && shapeIds[hit.instanceId]) {
          return shapeIds[hit.instanceId];
        }
        const shapeId = object.userData.shapeId as string | undefined;
        if (shapeId) return shapeId;
      }
      return null;
    };

    let pointerDown: { x: number; y: number; shiftKey: boolean; metaKey: boolean } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerDown = { x: event.clientX, y: event.clientY, shiftKey: event.shiftKey, metaKey: event.metaKey };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown || event.button !== 0) return;
      const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      const wasClick = distance < 5;
      const modifiers = { shiftKey: pointerDown.shiftKey || event.shiftKey, metaKey: pointerDown.metaKey || event.metaKey };
      pointerDown = null;
      if (!wasClick) return;

      const shapeId = pickShapeId(event);
      if (!shapeId) {
        if (!modifiers.shiftKey && !modifiers.metaKey) onSelectedShapeIdsChange([]);
        return;
      }
      onSelectedShapeIdsChange(
        modifiers.shiftKey || modifiers.metaKey
          ? selectedShapeIds.includes(shapeId)
            ? selectedShapeIds.filter((id) => id !== shapeId)
            : [...selectedShapeIds, shapeId]
          : [shapeId],
      );
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let animationId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = host.clientWidth || width;
      const nextHeight = host.clientHeight || height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    });
    resizeObserver.observe(host);

    return () => {
      cameraStateRef.current = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      };
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose?.();
      });
      renderer.dispose();
      host.innerHTML = "";
    };
  }, [project, selectedShapeIds, onSelectedShapeIdsChange]);

  return (
    <div className="three-preview-wrap">
      <div ref={hostRef} className="three-preview selectable" />
      <div className="selection-help">
{language === "en" ? "Drag to rotate, scroll to zoom, right-drag to pan. Click walls to select. Shift / ⌘ enables multi-select. Delete removes selected walls." : "拖曳滑鼠可旋轉，滾輪縮放，右鍵平移。單擊牆體選取，Shift / ⌘ 可多選，Delete 刪除。"}
      </div>
    </div>
  );
}
