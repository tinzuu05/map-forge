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
      <LeftPanel project={project} setProject={setProject} language={language} />
      <main className="workspace">
        <header className="workspace-header">
          <div>
            <h2>{project.projectName}</h2>
            <p>
              {project.imageWidth} × {project.imageHeight} · {project.shapes.length} {t("areasCount")} · {project.points.length} {t("pointsCount")}
              {selectedShapeIds.length > 0 ? ` · ${t("selected")} ${selectedShapeIds.length} ${t("walls")}` : ""}
            </p>
          </div>
          <div className="workspace-actions">
            {selectedShapeIds.length > 0 && (
              <>
                <button type="button" onClick={() => setSelectedShapeIds([])}>{t("deselect")}</button>
                <button type="button" className="danger" onClick={deleteSelectedWalls}>{t("deleteSelected")}</button>
              </>
            )}
            <div className="segmented">
              <button className={view === "three" ? "active" : ""} onClick={() => setView("three")}>{t("threePreview")}</button>
              <button className={view === "leaflet" ? "active" : ""} onClick={() => setView("leaflet")}>{t("flatPreview")}</button>
            </div>
          </div>
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
