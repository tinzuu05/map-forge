import { useEffect, useState } from "react";
import { demoProject } from "./data/demoProject";
import type { MapProject } from "./types";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import ThreePreview from "./three/ThreePreview";
import LeafletPreview from "./leaflet/LeafletPreview";
import type { Language } from "./i18n";
import { makeTranslator } from "./i18n";

export default function App() {
  const [project, setProjectState] = useState<MapProject>(demoProject);
  const [view, setView] = useState<"three" | "leaflet">("three");
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("mapforge-language") as Language) || "zh-TW");
  const t = makeTranslator(language);

  useEffect(() => {
    localStorage.setItem("mapforge-language", language);
    document.documentElement.lang = language;
  }, [language]);

  const setProject = (updater: (current: MapProject) => MapProject) => {
    setProjectState((current) => updater(current));
  };

  const getShapeBounds = (shape: MapProject["shapes"][number]) => {
    if (shape.box) {
      return {
        minX: shape.box.x,
        minY: shape.box.y,
        maxX: shape.box.x + shape.box.width,
        maxY: shape.box.y + shape.box.height,
      };
    }
    const xs = shape.points.map(([x]) => x);
    const ys = shape.points.map(([, y]) => y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  };

  const areBoundsConnected = (
    a: ReturnType<typeof getShapeBounds>,
    b: ReturnType<typeof getShapeBounds>,
  ) => {
    const tolerance = 0.75;
    const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
    const nearOrOverlappingX = overlapX >= -tolerance;
    const nearOrOverlappingY = overlapY >= -tolerance;

    // Connected means rectangles overlap or share an edge.
    // Corner-only contact is intentionally ignored.
    return nearOrOverlappingX && nearOrOverlappingY && (overlapX > tolerance || overlapY > tolerance);
  };

  const areSelectedWallsConnected = (shapes: MapProject["shapes"]) => {
    if (shapes.length <= 1) return false;
    const bounds = shapes.map(getShapeBounds);
    const visited = new Set<number>([0]);
    const stack = [0];

    while (stack.length) {
      const index = stack.pop()!;
      bounds.forEach((candidate, candidateIndex) => {
        if (visited.has(candidateIndex)) return;
        if (areBoundsConnected(bounds[index], candidate)) {
          visited.add(candidateIndex);
          stack.push(candidateIndex);
        }
      });
    }

    return visited.size === shapes.length;
  };

  const simplifyOrthogonalLoop = (loop: [number, number][]) => {
    if (loop.length <= 3) return loop;
    const cleaned = loop.filter((point, index) => {
      const prev = loop[(index - 1 + loop.length) % loop.length];
      return Math.abs(prev[0] - point[0]) > 0.001 || Math.abs(prev[1] - point[1]) > 0.001;
    });
    return cleaned.filter((point, index) => {
      const prev = cleaned[(index - 1 + cleaned.length) % cleaned.length];
      const next = cleaned[(index + 1) % cleaned.length];
      const sameX = Math.abs(prev[0] - point[0]) < 0.001 && Math.abs(point[0] - next[0]) < 0.001;
      const sameY = Math.abs(prev[1] - point[1]) < 0.001 && Math.abs(point[1] - next[1]) < 0.001;
      return !(sameX || sameY);
    });
  };

  const polygonArea = (points: [number, number][]) => {
    let area = 0;
    points.forEach(([x1, y1], index) => {
      const [x2, y2] = points[(index + 1) % points.length];
      area += x1 * y2 - x2 * y1;
    });
    return area / 2;
  };

  const buildUnionPolygonFromSelectedWalls = (shapes: MapProject["shapes"]) => {
    const rects = shapes.map(getShapeBounds).filter((rect) => rect.maxX > rect.minX && rect.maxY > rect.minY);
    if (!rects.length) return null;

    const round = (value: number) => Number(value.toFixed(3));
    const xs = Array.from(new Set(rects.flatMap((rect) => [round(rect.minX), round(rect.maxX)]))).sort((a, b) => a - b);
    const ys = Array.from(new Set(rects.flatMap((rect) => [round(rect.minY), round(rect.maxY)]))).sort((a, b) => a - b);
    if (xs.length < 2 || ys.length < 2) return null;

    const filled = new Set<string>();
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      for (let yi = 0; yi < ys.length - 1; yi += 1) {
        const cx = (xs[xi] + xs[xi + 1]) / 2;
        const cy = (ys[yi] + ys[yi + 1]) / 2;
        if (rects.some((rect) => cx >= rect.minX - 0.001 && cx <= rect.maxX + 0.001 && cy >= rect.minY - 0.001 && cy <= rect.maxY + 0.001)) {
          filled.add(`${xi},${yi}`);
        }
      }
    }

    const hasCell = (xi: number, yi: number) => filled.has(`${xi},${yi}`);
    const edgeMap = new Map<string, [number, number][]>();
    const addEdge = (from: [number, number], to: [number, number]) => {
      const key = `${from[0]},${from[1]}`;
      const list = edgeMap.get(key) ?? [];
      list.push(to);
      edgeMap.set(key, list);
    };

    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      for (let yi = 0; yi < ys.length - 1; yi += 1) {
        if (!hasCell(xi, yi)) continue;
        const x1 = xs[xi];
        const x2 = xs[xi + 1];
        const y1 = ys[yi];
        const y2 = ys[yi + 1];

        if (!hasCell(xi, yi - 1)) addEdge([x1, y1], [x2, y1]);
        if (!hasCell(xi + 1, yi)) addEdge([x2, y1], [x2, y2]);
        if (!hasCell(xi, yi + 1)) addEdge([x2, y2], [x1, y2]);
        if (!hasCell(xi - 1, yi)) addEdge([x1, y2], [x1, y1]);
      }
    }

    const loops: [number, number][][] = [];
    const popNext = (from: [number, number]) => {
      const key = `${from[0]},${from[1]}`;
      const list = edgeMap.get(key);
      if (!list?.length) return null;
      const next = list.shift()!;
      if (!list.length) edgeMap.delete(key);
      return next;
    };

    while (edgeMap.size) {
      const firstKey = edgeMap.keys().next().value as string;
      const start = firstKey.split(",").map(Number) as [number, number];
      const loop: [number, number][] = [start];
      let current = start;
      let guard = 0;

      while (guard < 20000) {
        guard += 1;
        const next = popNext(current);
        if (!next) break;
        if (Math.abs(next[0] - start[0]) < 0.001 && Math.abs(next[1] - start[1]) < 0.001) break;
        loop.push(next);
        current = next;
      }

      const simplified = simplifyOrthogonalLoop(loop.map(([x, y]) => [round(x), round(y)]));
      if (simplified.length >= 4) loops.push(simplified);
    }

    if (!loops.length) return null;
    const sortedLoops = loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
    const outer = sortedLoops[0];
    const holes = sortedLoops.slice(1).filter((loop) => Math.abs(polygonArea(loop)) > 1);

    return { outer, holes };
  };

  const mergeSelectedWalls = () => {
    const selected = project.shapes.filter((shape) => selectedShapeIds.includes(shape.id));
    if (selected.length < 2) {
      window.alert(t("mergeNeedsTwo"));
      return;
    }

    if (!areSelectedWallsConnected(selected)) {
      window.alert(t("mergeNeedsConnected"));
      return;
    }

    const polygon = buildUnionPolygonFromSelectedWalls(selected);
    if (!polygon) {
      window.alert(t("mergePolygonFail"));
      return;
    }

    const first = selected[0];
    const mergedId = `merged-wall-${crypto.randomUUID().slice(0, 8)}`;
    const mergedShape = {
      ...first,
      id: mergedId,
      name: `${t("mergedWall")} ${new Date().toLocaleTimeString()}`,
      height: Math.max(...selected.map((shape) => shape.height || first.height || 70)),
      opacity: Math.max(...selected.map((shape) => shape.opacity ?? first.opacity ?? 0.98)),
      points: polygon.outer as MapProject["shapes"][number]["points"],
      holes: polygon.holes.length ? (polygon.holes as MapProject["shapes"][number]["holes"]) : undefined,
      renderMode: "extrude" as const,
      box: undefined,
    };

    setProjectState((current) => ({
      ...current,
      shapes: [
        ...current.shapes.filter((shape) => !selectedShapeIds.includes(shape.id)),
        mergedShape,
      ],
    }));
    setSelectedShapeIds([mergedId]);
  };

  const deleteSelectedWalls = () => {
    if (!selectedShapeIds.length) return;
    setProjectState((current) => ({
      ...current,
      shapes: current.shapes.filter((shape) => !selectedShapeIds.includes(shape.id)),
    }));
    setSelectedShapeIds([]);
  };

  useEffect(() => {
    setSelectedShapeIds((ids) => ids.filter((id) => project.shapes.some((shape) => shape.id === id)));
  }, [project.shapes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const isTyping = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      if (isTyping) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedShapeIds.length > 0) {
        event.preventDefault();
        deleteSelectedWalls();
      }
      if (event.key === "Escape" && selectedShapeIds.length > 0) {
        event.preventDefault();
        setSelectedShapeIds([]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedShapeIds]);

  return (
    <div className="app-shell">
      <LeftPanel project={project} setProject={setProject} language={language} selectedShapeIds={selectedShapeIds} setSelectedShapeIds={setSelectedShapeIds} onMergeSelectedWalls={mergeSelectedWalls} />
      <main className="workspace">
        <header className={`workspace-header ${selectedShapeIds.length > 0 ? "has-selection" : "no-selection"}`}>
          <div className="workspace-title-block">
            <h2>{project.projectName}</h2>
            <p>
              {project.imageWidth} × {project.imageHeight} · {project.shapes.length} {t("areasCount")} · {project.points.length} {t("pointsCount")}
              {selectedShapeIds.length > 0 ? ` · ${t("selected")} ${selectedShapeIds.length} ${t("walls")}` : ""}
            </p>
          </div>
          <div className="workspace-view-switch">
            <div className="segmented view-segmented" aria-label="Preview mode">
              <button className={view === "three" ? "active" : ""} onClick={() => setView("three")}>{t("threePreview")}</button>
              <button className={view === "leaflet" ? "active" : ""} onClick={() => setView("leaflet")}>{t("flatPreview")}</button>
            </div>
          </div>
          {selectedShapeIds.length > 0 && (
            <div className="selected-wall-actions" aria-label="Selected wall actions">
              {selectedShapeIds.length > 1 && <button type="button" onClick={mergeSelectedWalls}>{t("mergeSelected")}</button>}
              <button type="button" onClick={() => setSelectedShapeIds([])}>{t("deselect")}</button>
              <button type="button" className="danger" onClick={deleteSelectedWalls}>{t("deleteSelected")}</button>
            </div>
          )}
        </header>
        <div className="preview-stage">
          {view === "three" ? (
            <ThreePreview project={project} selectedShapeIds={selectedShapeIds} onSelectedShapeIdsChange={setSelectedShapeIds} language={language} />
          ) : (
            <LeafletPreview project={project} selectedShapeIds={selectedShapeIds} onSelectedShapeIdsChange={setSelectedShapeIds} />
          )}
        </div>
      </main>
      <RightPanel project={project} language={language} setLanguage={setLanguage} />
    </div>
  );
}
