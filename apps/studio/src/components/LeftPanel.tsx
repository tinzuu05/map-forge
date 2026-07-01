import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import type { MapPoint, MapProject, MapShape } from "../types";
import { demoProject } from "../data/demoProject";
import { safeJsonParse } from "../utils/download";
import { detectLineShapesFromImage, type LineDetectionOptions } from "../utils/lineDetection";
import type { LabelKey, Language } from "../i18n";
import { makeTranslator } from "../i18n";

interface Props {
  project: MapProject;
  setProject: (updater: (current: MapProject) => MapProject) => void;
  language: Language;
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

const defaultDetectOptions: LineDetectionOptions = {
  threshold: 158,
  gridSize: 4,
  minRunCells: 1,
  height: 70,
  color: "#f8e7e7",
  borderColor: "#ffffff",
  opacity: 0.98,
  maxImageSide: 1400,
  mode: "auto",
  adaptiveContrast: 28,
  edgeStrength: 42,
  minCellCoverage: 0.08,
  dilate: 1,
  preferLowSaturation: true,
  ignoreDarkBackground: true,
  minNeighbourBrightness: 72,
  minComponentPixels: 3,
  simplifyTolerance: 0,
  smoothIterations: 0,
  maxShapes: 8000,
  cropMargin: 0,
  useSourceColors: false,
  enhanceLinesBeforeDetect: true,
  localContrastThreshold: 18,
  colorDifferenceThreshold: 34,
  backgroundSampleRadius: 12,
  contrastBoost: 1.35,
};

type PresetId = "general" | "blueprint" | "hud" | "light" | "dark" | "cad";

const detectionPresets: Record<PresetId, Partial<LineDetectionOptions>> = {
  general: defaultDetectOptions,
  blueprint: {
    mode: "light",
    threshold: 145,
    localContrastThreshold: 14,
    colorDifferenceThreshold: 24,
    backgroundSampleRadius: 18,
    contrastBoost: 1.55,
    edgeStrength: 36,
    minCellCoverage: 0.05,
    preferLowSaturation: false,
    ignoreDarkBackground: false,
    minNeighbourBrightness: 0,
    dilate: 1,
    color: "#d8f3ff",
    borderColor: "#ffffff",
  },
  hud: {
    mode: "light",
    threshold: 120,
    localContrastThreshold: 12,
    colorDifferenceThreshold: 22,
    backgroundSampleRadius: 16,
    contrastBoost: 1.75,
    edgeStrength: 32,
    minCellCoverage: 0.04,
    preferLowSaturation: false,
    ignoreDarkBackground: false,
    minNeighbourBrightness: 0,
    dilate: 1,
    color: "#7cffd4",
    borderColor: "#d7fff2",
  },
  light: {
    mode: "dark",
    threshold: 150,
    localContrastThreshold: 16,
    colorDifferenceThreshold: 28,
    backgroundSampleRadius: 12,
    contrastBoost: 1.3,
    edgeStrength: 45,
    minCellCoverage: 0.08,
    preferLowSaturation: false,
    ignoreDarkBackground: false,
    minNeighbourBrightness: 0,
    dilate: 1,
    color: "#d8dde8",
    borderColor: "#ffffff",
  },
  dark: {
    mode: "light",
    threshold: 110,
    localContrastThreshold: 14,
    colorDifferenceThreshold: 30,
    backgroundSampleRadius: 14,
    contrastBoost: 1.55,
    edgeStrength: 38,
    minCellCoverage: 0.06,
    preferLowSaturation: false,
    ignoreDarkBackground: false,
    minNeighbourBrightness: 0,
    dilate: 1,
    color: "#f8fafc",
    borderColor: "#ffffff",
  },
  cad: {
    mode: "auto",
    threshold: 158,
    localContrastThreshold: 16,
    colorDifferenceThreshold: 30,
    backgroundSampleRadius: 14,
    contrastBoost: 1.45,
    edgeStrength: 42,
    minCellCoverage: 0.07,
    preferLowSaturation: true,
    ignoreDarkBackground: true,
    minNeighbourBrightness: 60,
    dilate: 1,
    color: "#f4e8e8",
    borderColor: "#ffffff",
  },
};


interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

function clampNumber(value: number, min?: number, max?: number) {
  if (!Number.isFinite(value)) return min ?? 0;
  if (typeof min === "number" && value < min) return min;
  if (typeof max === "number" && value > max) return max;
  return value;
}

function NumberField({ value, onChange, min, max, step = 1, className }: NumberFieldProps) {
  const update = (next: number) => onChange(clampNumber(next, min, max));
  return (
    <div className={`number-control ${className ?? ""}`.trim()}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => update(Number(e.target.value))}
      />
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="section collapsible" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

interface PointEditorProps {
  point: MapPoint;
  onCommit: (id: string, patch: Partial<MapPoint>) => void;
  onDelete: (id: string) => void;
  t: (key: LabelKey) => string;
}

function PointEditor({ point, onCommit, onDelete, t }: PointEditorProps) {
  const [draft, setDraft] = useState({
    name: point.name,
    type: point.type,
    x: String(point.x),
    y: String(point.y),
    z: String(point.z),
    color: point.color,
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft({
      name: point.name,
      type: point.type,
      x: String(point.x),
      y: String(point.y),
      z: String(point.z),
      color: point.color,
    });
    setDirty(false);
  }, [point.id, point.name, point.type, point.x, point.y, point.z, point.color]);

  const commit = () => {
    const x = Number(draft.x);
    const y = Number(draft.y);
    const z = Number(draft.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      alert(t("validNumber"));
      return;
    }
    onCommit(point.id, {
      name: draft.name.trim() || point.name,
      type: draft.type as MapPoint["type"],
      x,
      y,
      z,
      color: draft.color,
    });
    setDirty(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      commit();
    }
    if (event.key === "Escape") {
      setDraft({
        name: point.name,
        type: point.type,
        x: String(point.x),
        y: String(point.y),
        z: String(point.z),
        color: point.color,
      });
      setDirty(false);
    }
  };

  const setValue = (key: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  return (
    <div className="card point-card">
      <input value={draft.name} onChange={(e) => setValue("name", e.target.value)} onBlur={commit} onKeyDown={onKeyDown} />
      <div className="mini-grid four">
        <label>{t("pointType")}<select value={draft.type} onChange={(e) => setValue("type", e.target.value)} onBlur={commit} onKeyDown={onKeyDown}><option value="camera">camera</option><option value="sensor">sensor</option><option value="door">door</option><option value="custom">custom</option></select></label>
        <label>x<input type="number" inputMode="decimal" step="1" value={draft.x} onChange={(e) => setValue("x", e.target.value)} onBlur={commit} onKeyDown={onKeyDown} /></label>
        <label>y<input type="number" inputMode="decimal" step="1" value={draft.y} onChange={(e) => setValue("y", e.target.value)} onBlur={commit} onKeyDown={onKeyDown} /></label>
        <label>z<input type="number" inputMode="decimal" step="1" value={draft.z} onChange={(e) => setValue("z", e.target.value)} onBlur={commit} onKeyDown={onKeyDown} /></label>
        <label>{t("color")}<input type="color" value={draft.color} onChange={(e) => setValue("color", e.target.value)} onBlur={commit} /></label>
      </div>
      <div className="button-row">
        <button type="button" disabled={!dirty} onClick={commit}>{t("applyPoint")}</button>
        <button className="danger" type="button" onClick={() => onDelete(point.id)}>{t("deletePoint")}</button>
      </div>
      {dirty && <small>{t("editingHint")}</small>}
    </div>
  );
}

export default function LeftPanel({ project, setProject, language }: Props) {
  const t = makeTranslator(language);
  const [detecting, setDetecting] = useState(false);
  const [detectOptions, setDetectOptions] = useState<LineDetectionOptions>(defaultDetectOptions);
  const [preset, setPreset] = useState<PresetId>("general");
  const [areaQuery, setAreaQuery] = useState("");
  const [pointQuery, setPointQuery] = useState("");
  const [imageInputKey, setImageInputKey] = useState(0);
  const [jsonInputKey, setJsonInputKey] = useState(0);
  const [jsonFileName, setJsonFileName] = useState<string | null>(null);
  const lastObjectUrl = useRef<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const updateDetectOption = <K extends keyof LineDetectionOptions>(key: K, value: LineDetectionOptions[K]) => {
    setDetectOptions((current) => ({ ...current, [key]: value }));
  };

  const applyDetectionPreset = (id: PresetId) => {
    setPreset(id);
    setDetectOptions((current) => ({
      ...current,
      ...detectionPresets[id],
    }));
  };

  const restoreDetectDefaults = () => {
    setPreset("general");
    setDetectOptions(defaultDetectOptions);
  };

  const generate3DFromImageLines = async () => {
    if (!project.imageUrl) {
      alert(t("needImage"));
      return;
    }
    setDetecting(true);
    try {
      const detectedShapes = await detectLineShapesFromImage(project.imageUrl, detectOptions);
      setProject((current) => ({
        ...current,
        shapes: [
          ...current.shapes.filter((shape) => !shape.id.startsWith("auto-wall-")),
          ...detectedShapes,
        ],
      }));
      if (!detectedShapes.length) alert(t("noLines"));
    } catch (error) {
      console.error(error);
      alert(t("detectFail"));
    } finally {
      setDetecting(false);
    }
  };

  const clearAllShapes = () => {
    if (!project.shapes.length) return;
    const ok = window.confirm(t("confirmClear"));
    if (!ok) return;
    setProject((current) => ({ ...current, shapes: [] }));
  };

  const clearAutoWalls = () => {
    setProject((current) => ({
      ...current,
      shapes: current.shapes.filter((shape) => !shape.id.startsWith("auto-wall-")),
    }));
  };

  const updateSettings = <K extends keyof MapProject["settings"]>(key: K, value: MapProject["settings"][K]) => {
    setProject((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  };

  const updateShape = (id: string, patch: Partial<MapShape>) => {
    setProject((current) => ({
      ...current,
      shapes: current.shapes.map((shape) => (shape.id === id ? { ...shape, ...patch } : shape)),
    }));
  };

  const updatePoint = (id: string, patch: Partial<MapPoint>) => {
    setProject((current) => ({
      ...current,
      points: current.points.map((point) => (point.id === id ? { ...point, ...patch } : point)),
    }));
  };

  const onImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
    const url = URL.createObjectURL(file);
    lastObjectUrl.current = url;
    const img = new Image();
    img.onload = () => {
      setProject((current) => ({
        ...current,
        imageUrl: url,
        imageName: file.name,
        imageWidth: img.naturalWidth || current.imageWidth,
        imageHeight: img.naturalHeight || current.imageHeight,
      }));
    };
    img.src = url;
  };

  const removeUploadedImage = () => {
    if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
    lastObjectUrl.current = null;
    if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    setImageInputKey((value) => value + 1);
    setProject((current) => ({ ...current, imageUrl: null, imageName: null }));
  };

  const importProject = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setJsonFileName(file.name);
    file.text().then((text) => {
      const parsed = safeJsonParse<MapProject>(text);
      if (parsed) {
        setProject(() => ({ ...parsed, imageUrl: null, imageName: null }));
        setJsonInputKey((value) => value + 1);
      } else alert(t("jsonError"));
    });
  };

  const clearImageInput = () => {
    if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
    lastObjectUrl.current = null;
    if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    setImageInputKey((value) => value + 1);
  };

  const clearJsonInput = () => {
    if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
    setJsonFileName(null);
    setJsonInputKey((value) => value + 1);
  };

  const loadDemo = () => {
    clearImageInput();
    clearJsonInput();
    setProject(() => demoProject);
  };

  const resetProject = () => {
    if (window.confirm(t("resetConfirm"))) {
      clearImageInput();
      clearJsonInput();
      setProject(() => demoProject);
    }
  };

  const normalizedAreaQuery = areaQuery.trim().toLowerCase();
  const normalizedPointQuery = pointQuery.trim().toLowerCase();
  const autoWallCount = project.shapes.filter((shape) => shape.id.startsWith("auto-wall-")).length;

  const visibleShapes = useMemo(() => {
    return project.shapes
      .filter((shape) => !shape.id.startsWith("auto-wall-") || project.shapes.length <= 80)
      .filter((shape) => {
        if (!normalizedAreaQuery) return true;
        return `${shape.name} ${shape.id}`.toLowerCase().includes(normalizedAreaQuery);
      });
  }, [project.shapes, normalizedAreaQuery]);

  const visiblePoints = useMemo(() => {
    return project.points.filter((point) => {
      if (!normalizedPointQuery) return true;
      return `${point.name} ${point.id} ${point.type}`.toLowerCase().includes(normalizedPointQuery);
    });
  }, [project.points, normalizedPointQuery]);

  return (
    <aside className="panel left-panel">
      <div className="brand">
        <div className="brand-mark">MF</div>
        <div>
          <h1>Map Forge Studio</h1>
          <p>{t("brandSub")}</p>
        </div>
      </div>

      <CollapsibleSection title={t("project")}>
        <label>{t("projectName")}</label>
        <input value={project.projectName} onChange={(e) => setProject((c) => ({ ...c, projectName: e.target.value }))} />

        <div className="project-action-grid">
          <button className="project-action-card primary-card" type="button" onClick={loadDemo}>
            <span>{t("loadDemo")}</span>
            <small>{t("loadDemoHint")}</small>
          </button>
          <button className="project-action-card reset-card" type="button" onClick={resetProject}>
            <span>{t("resetProject")}</span>
            <small>{t("resetProjectHint")}</small>
          </button>
        </div>

        <label>{t("uploadPlan")}</label>
        <div className="file-upload-box">
          <input
            ref={imageFileInputRef}
            key={imageInputKey}
            className="visually-hidden-file"
            type="file"
            accept="image/*,.svg"
            onChange={onImageUpload}
          />
          <div className="upload-status compact">
            <small>{project.imageName || t("noImage")}</small>
            <div className="upload-actions">
              <button className="ghost" type="button" onClick={() => imageFileInputRef.current?.click()}>
                {project.imageUrl ? t("uploadAnother") : t("chooseFile")}
              </button>
              {project.imageUrl && <button className="ghost danger-light" type="button" onClick={removeUploadedImage}>{t("cancelImage")}</button>}
            </div>
          </div>
        </div>

        <label>{t("importJson")}</label>
        <div className="file-upload-box file-upload-box-json">
          <input
            ref={jsonFileInputRef}
            key={jsonInputKey}
            className="visually-hidden-file"
            type="file"
            accept="application/json"
            onChange={importProject}
          />
          <div className="upload-status compact">
            <small title={jsonFileName || t("noFileSelected")}>{jsonFileName || t("noFileSelected")}</small>
            <div className="upload-actions">
              <button className="ghost" type="button" onClick={() => jsonFileInputRef.current?.click()}>
                {t("chooseFile")}
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t("autoTitle")}>
        <div className="grid-two">
          <label className="primary-span">{t("applyPreset")}</label>
          <select className="primary-span" value={preset} onChange={(e) => applyDetectionPreset(e.target.value as PresetId)}>
            <option value="general">{t("presetGeneral")}</option>
            <option value="blueprint">{t("presetBlueprint")}</option>
            <option value="hud">{t("presetHud")}</option>
            <option value="light">{t("presetLight")}</option>
            <option value="dark">{t("presetDark")}</option>
            <option value="cad">{t("presetCad")}</option>
          </select>

          <label>{t("detectMode")}</label>
          <select value={detectOptions.mode} onChange={(e) => updateDetectOption("mode", e.target.value as LineDetectionOptions["mode"])}>
            <option value="auto">{t("modeAuto")}</option>
            <option value="dark">{t("modeDark")}</option>
            <option value="light">{t("modeLight")}</option>
          </select>

          <label className="primary-span"><input type="checkbox" checked={detectOptions.enhanceLinesBeforeDetect ?? true} onChange={(e) => updateDetectOption("enhanceLinesBeforeDetect", e.target.checked)} /> {t("preprocess")}</label>
          <label>{t("localContrast")}</label><NumberField min={1} max={120} value={detectOptions.localContrastThreshold ?? 18} onChange={(value) => updateDetectOption("localContrastThreshold", value)} />
          <label>{t("colorDifference")}</label><NumberField min={1} max={180} value={detectOptions.colorDifferenceThreshold ?? 34} onChange={(value) => updateDetectOption("colorDifferenceThreshold", value)} />
          <label>{t("sampleRadius")}</label><NumberField min={2} max={80} value={detectOptions.backgroundSampleRadius ?? 12} onChange={(value) => updateDetectOption("backgroundSampleRadius", value)} />
          <label>{t("contrastBoost")}</label><NumberField step={0.05} min={0.5} max={4} value={detectOptions.contrastBoost ?? 1.35} onChange={(value) => updateDetectOption("contrastBoost", value)} />
          <label>{t("threshold")} {detectOptions.threshold}</label><input type="range" min="0" max="255" step="1" value={detectOptions.threshold} onChange={(e) => updateDetectOption("threshold", Number(e.target.value))} />
          <label>{t("gridSize")}</label><NumberField min={1} max={40} value={detectOptions.gridSize} onChange={(value) => updateDetectOption("gridSize", value)} />
          <label>{t("coverage")}</label><NumberField step={0.01} min={0.01} max={1} value={detectOptions.minCellCoverage} onChange={(value) => updateDetectOption("minCellCoverage", value)} />
          <label>{t("crop")}</label><NumberField step={0.005} min={0} max={0.25} value={detectOptions.cropMargin ?? 0} onChange={(value) => updateDetectOption("cropMargin", value)} />
          <label>{t("edge")}</label><NumberField min={0} max={255} value={detectOptions.edgeStrength} onChange={(value) => updateDetectOption("edgeStrength", value)} />
          <label>{t("ignoreDark")}</label><input type="checkbox" checked={detectOptions.ignoreDarkBackground} onChange={(e) => updateDetectOption("ignoreDarkBackground", e.target.checked)} />
          <label>{t("minBrightness")}</label><NumberField min={0} max={255} value={detectOptions.minNeighbourBrightness} onChange={(value) => updateDetectOption("minNeighbourBrightness", value)} />
          <label>{t("dilate")}</label><NumberField min={0} max={8} value={detectOptions.dilate} onChange={(value) => updateDetectOption("dilate", value)} />
          <label>{t("minCells")}</label><NumberField min={1} max={10000} value={detectOptions.minComponentPixels ?? 3} onChange={(value) => updateDetectOption("minComponentPixels", value)} />
          <label>{t("maxShapes")}</label><NumberField min={1} max={20000} value={detectOptions.maxShapes ?? 8000} onChange={(value) => updateDetectOption("maxShapes", value)} />
          <label>{t("wallHeight")}</label><NumberField min={1} max={1000} value={detectOptions.height} onChange={(value) => updateDetectOption("height", value)} />
          <label>{t("wallColor")}</label><input type="color" value={detectOptions.color} onChange={(e) => updateDetectOption("color", e.target.value)} />
          <label>{t("borderColor")}</label><input type="color" value={detectOptions.borderColor} onChange={(e) => updateDetectOption("borderColor", e.target.value)} />
          <label className="primary-span"><input type="checkbox" checked={detectOptions.useSourceColors ?? false} onChange={(e) => updateDetectOption("useSourceColors", e.target.checked)} /> {t("sourceColors")}</label>
          <label className="primary-span"><input type="checkbox" checked={detectOptions.preferLowSaturation} onChange={(e) => updateDetectOption("preferLowSaturation", e.target.checked)} /> {t("lowSaturation")}</label>
          <button className="primary-span" type="button" onClick={restoreDetectDefaults}>{t("restoreDefaults")}</button>
          <button className="primary-span primary" type="button" disabled={detecting} onClick={generate3DFromImageLines}>{detecting ? t("detecting") : t("build3D")}</button>
          <button className="primary-span" type="button" onClick={clearAutoWalls}>{t("clearAuto")}</button>
          <button className="primary-span danger" type="button" onClick={clearAllShapes}>{t("clearAll")}</button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t("scene")}>
        <div className="grid-two">
          <label>{t("background")}</label><input type="color" value={project.settings.background} onChange={(e) => updateSettings("background", e.target.value)} />
          <label>{t("ground")}</label><input type="color" value={project.settings.groundColor} onChange={(e) => updateSettings("groundColor", e.target.value)} />
          <label>{t("imageOpacity")}</label><input type="range" min="0" max="1" step="0.05" value={project.settings.imageOpacity} onChange={(e) => updateSettings("imageOpacity", Number(e.target.value))} />
          <label>{t("heightScale")}</label><input type="range" min="0.2" max="3" step="0.1" value={project.settings.extrusionScale} onChange={(e) => updateSettings("extrusionScale", Number(e.target.value))} />
          <label className="primary-span"><input type="checkbox" checked={project.settings.showGrid} onChange={(e) => updateSettings("showGrid", e.target.checked)} /> {t("showGrid")}</label>
          <label className="primary-span"><input type="checkbox" checked={project.settings.showImagePlane} onChange={(e) => updateSettings("showImagePlane", e.target.checked)} /> {t("showImage")}</label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t("areas")}>
        <div className="list-toolbar">
          <input className="search-input" placeholder={t("searchAreas")} value={areaQuery} onChange={(e) => setAreaQuery(e.target.value)} />
          <div className="toolbar-actions">
            <button type="button" className="compact-button" onClick={() => setProject((c) => ({ ...c, shapes: [...c.shapes, { id: newId("area"), name: "New Area", color: "#93c5fd", borderColor: "#ffffff", height: 50, opacity: 0.95, points: [[100, 100], [260, 100], [260, 240], [100, 240]] }] }))}>{t("add")}</button>
            <button type="button" className="compact-button danger" onClick={clearAllShapes}>{t("clear")}</button>
          </div>
        </div>
        {autoWallCount > 80 && <small>{t("autoHidden")} ({autoWallCount})</small>}
        {visibleShapes.map((shape) => (
          <div className="card" key={shape.id}>
            <input value={shape.name} onChange={(e) => updateShape(shape.id, { name: e.target.value })} />
            <div className="mini-grid">
              <label>{t("color")}<input type="color" value={shape.color} onChange={(e) => updateShape(shape.id, { color: e.target.value })} /></label>
              <label>{t("border")}<input type="color" value={shape.borderColor} onChange={(e) => updateShape(shape.id, { borderColor: e.target.value })} /></label>
              <label>{t("height")}<NumberField min={1} max={2000} value={shape.height} onChange={(value) => updateShape(shape.id, { height: value })} /></label>
              <label>{t("opacity")}<NumberField step={0.05} min={0.1} max={1} value={shape.opacity} onChange={(value) => updateShape(shape.id, { opacity: value })} /></label>
            </div>
            <textarea value={JSON.stringify(shape.points)} onChange={(e) => updateShape(shape.id, { points: safeJsonParse(e.target.value) || shape.points })} />
            <button type="button" className="danger" onClick={() => setProject((c) => ({ ...c, shapes: c.shapes.filter((s) => s.id !== shape.id) }))}>{t("deleteArea")}</button>
          </div>
        ))}
      </CollapsibleSection>

      <CollapsibleSection title={t("points")}>
        <div className="list-toolbar">
          <input className="search-input" placeholder={t("searchPoints")} value={pointQuery} onChange={(e) => setPointQuery(e.target.value)} />
          <div className="toolbar-actions single">
            <button type="button" className="compact-button" onClick={() => setProject((c) => ({ ...c, points: [...c.points, { id: newId("pt"), name: "New Point", type: "custom", x: 120, y: 120, z: 80, color: "#fde68a" }] }))}>{t("add")}</button>
          </div>
        </div>
        <small>{t("pointHint")}</small>
        {visiblePoints.map((point) => (
          <PointEditor key={point.id} point={point} t={t} onCommit={updatePoint} onDelete={(id) => setProject((c) => ({ ...c, points: c.points.filter((p) => p.id !== id) }))} />
        ))}
      </CollapsibleSection>
    </aside>
  );
}
