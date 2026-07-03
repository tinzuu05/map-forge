import { memo, useEffect, useRef } from "react";
import L from "leaflet";
import type { MapProject, Point2D } from "../types";

interface LeafletPreviewProps {
  project: MapProject;
  selectedShapeIds: string[];
  onSelectedShapeIdsChange: (ids: string[]) => void;
  onShapeMove?: (shapeId: string, dx: number, dy: number) => void;
}

function LeafletPreviewComponent({ project, selectedShapeIds, onSelectedShapeIdsChange, onShapeMove }: LeafletPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectedShapeIdsRef = useRef(selectedShapeIds);

  useEffect(() => {
    selectedShapeIdsRef.current = selectedShapeIds;
  }, [selectedShapeIds]);

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
    const toImagePoint = (latlng: L.LatLng): Point2D => [
      Number(latlng.lng.toFixed(3)),
      Number((project.imageHeight - latlng.lat).toFixed(3)),
    ];
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
        interactive: true,
      })
        .bindTooltip(`${shape.name} / height: ${shape.height}`)
        .addTo(map);

      let dragStartLatLng: L.LatLng | null = null;
      let dragLastLatLng: L.LatLng | null = null;
      let hasDragged = false;

      const getEventLatLng = (event: L.LeafletMouseEvent) => event.latlng;

      polygon.on("mousedown", (event) => {
        if (!isSelected || !onShapeMove) return;
        L.DomEvent.stopPropagation(event);
        L.DomEvent.preventDefault(event);

        dragStartLatLng = getEventLatLng(event);
        dragLastLatLng = dragStartLatLng;
        hasDragged = false;
        map.dragging.disable();
        host.classList.add("is-dragging-wall");

        const onMouseMove = (moveEvent: L.LeafletMouseEvent) => {
          if (!dragLastLatLng) return;
          const nextLatLng = getEventLatLng(moveEvent);
          const lastImage = toImagePoint(dragLastLatLng);
          const nextImage = toImagePoint(nextLatLng);
          const dx = nextImage[0] - lastImage[0];
          const dy = nextImage[1] - lastImage[1];

          if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
            hasDragged = true;
            polygon.setLatLngs(
              polygon.getLatLngs().map((ringOrLatLngs) => {
                if (!Array.isArray(ringOrLatLngs)) return ringOrLatLngs;
                return (ringOrLatLngs as L.LatLng[]).map((latLng) => L.latLng(latLng.lat - dy, latLng.lng + dx));
              }) as any,
            );
            dragLastLatLng = nextLatLng;
          }
        };

        const onMouseUp = (upEvent: L.LeafletMouseEvent) => {
          map.off("mousemove", onMouseMove);
          map.off("mouseup", onMouseUp);
          map.dragging.enable();
          host.classList.remove("is-dragging-wall");

          if (!dragStartLatLng || !dragLastLatLng || !hasDragged) return;

          const startImage = toImagePoint(dragStartLatLng);
          const endImage = toImagePoint(dragLastLatLng);
          const dx = endImage[0] - startImage[0];
          const dy = endImage[1] - startImage[1];

          if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
            onShapeMove(shape.id, dx, dy);
          }

          dragStartLatLng = null;
          dragLastLatLng = null;
          L.DomEvent.stopPropagation(upEvent);
        };

        map.on("mousemove", onMouseMove);
        map.on("mouseup", onMouseUp);
      });

      polygon.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        if (hasDragged) return;

        const currentSelection = selectedShapeIdsRef.current;
        onSelectedShapeIdsChange(
          event.originalEvent.shiftKey || event.originalEvent.metaKey
            ? currentSelection.includes(shape.id)
              ? currentSelection.filter((id) => id !== shape.id)
              : [...currentSelection, shape.id]
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
  }, [project, selectedShapeIds, onSelectedShapeIdsChange, onShapeMove]);

  return <div ref={hostRef} className="leaflet-preview" />;
}

export default memo(LeafletPreviewComponent);
