import { useEffect, useRef } from "react";
import L from "leaflet";
import type { MapProject, Point2D } from "../types";

interface LeafletPreviewProps {
  project: MapProject;
  selectedShapeIds: string[];
  onSelectedShapeIdsChange: (ids: string[]) => void;
}

export default function LeafletPreview({ project, selectedShapeIds, onSelectedShapeIdsChange }: LeafletPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    host.innerHTML = "";

    const map = L.map(host, {
      crs: L.CRS.Simple,
      minZoom: -4,
      zoomControl: true,
      attributionControl: false,
    });

    const selectedSet = new Set(selectedShapeIds);
    const toLeafletPoint = ([x, y]: Point2D): [number, number] => [project.imageHeight - y, x];
    const toLeafletMarker = (x: number, y: number): [number, number] => [project.imageHeight - y, x];
    const bounds: L.LatLngBoundsExpression = [[0, 0], [project.imageHeight, project.imageWidth]];

    if (project.imageUrl) {
      L.imageOverlay(project.imageUrl, bounds, { opacity: 0.86 }).addTo(map);
    } else {
      L.rectangle(bounds, {
        color: "#64748b",
        weight: 1,
        fillColor: "#111827",
        fillOpacity: 0.6,
      }).addTo(map);
    }

    project.shapes.forEach((shape) => {
      const outer = shape.points.map(toLeafletPoint);
      const holes = shape.holes?.map((hole) => hole.map(toLeafletPoint)) || [];
      const isSelected = selectedSet.has(shape.id);

      const polygon = L.polygon([outer, ...holes], {
        color: isSelected ? "#facc15" : shape.borderColor,
        fillColor: isSelected ? "#facc15" : shape.color,
        fillOpacity: isSelected ? 0.75 : Math.min(shape.opacity, 0.55),
        weight: isSelected ? 4 : 2,
      })
        .bindTooltip(`${shape.name} / height: ${shape.height}`)
        .addTo(map);

      polygon.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectedShapeIdsChange(
          event.originalEvent.shiftKey || event.originalEvent.metaKey
            ? selectedShapeIds.includes(shape.id)
              ? selectedShapeIds.filter((id) => id !== shape.id)
              : [...selectedShapeIds, shape.id]
            : [shape.id],
        );
      });
    });

    project.points.forEach((point) => {
      L.circleMarker(toLeafletMarker(point.x, point.y), {
        radius: 7,
        color: point.color,
        fillColor: point.color,
        fillOpacity: 0.85,
      })
        .bindPopup(`<strong>${point.name}</strong><br/>x:${point.x}, y:${point.y}, z:${point.z}`)
        .addTo(map);
    });

    map.on("click", () => onSelectedShapeIdsChange([]));
    map.fitBounds(bounds);

    const invalidate = () => map.invalidateSize();
    const timeoutId = window.setTimeout(invalidate, 0);
    const resizeObserver = new ResizeObserver(invalidate);
    resizeObserver.observe(host);

    return () => {
      window.clearTimeout(timeoutId);
      resizeObserver.disconnect();
      map.remove();
    };
  }, [project, selectedShapeIds, onSelectedShapeIdsChange]);

  return <div ref={hostRef} className="leaflet-preview" />;
}
