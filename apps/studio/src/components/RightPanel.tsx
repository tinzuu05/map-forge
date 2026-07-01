import { useMemo, useState } from "react";
import type { ExportFormat, MapProject } from "../types";
import { downloadTextFile } from "../utils/download";
import { generateProjectJson, generateThreeJsCode, generateThreeTsCode } from "../exporters/generateThreeCode";
import type { Language } from "../i18n";
import { makeTranslator } from "../i18n";

function buildCode(project: MapProject, format: ExportFormat) {
  if (format === "json") return generateProjectJson(project);
  if (format === "js") return generateThreeJsCode(project);
  return generateThreeTsCode(project);
}

export default function RightPanel({ project, language, setLanguage }: { project: MapProject; language: Language; setLanguage: (language: Language) => void }) {
  const t = makeTranslator(language);
  const [format, setFormat] = useState<ExportFormat>("ts");
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLarge = project.shapes.length > 900;

  const code = useMemo(() => {
    if (isLarge && !showFullPreview) {
      return `// ${t("largeModel")}\n// Shapes: ${project.shapes.length}\n// Use Download to export the full ${format.toUpperCase()} file.`;
    }
    return buildCode(project, format);
  }, [project, format, isLarge, showFullPreview, t]);

  const filename = format === "json" ? "mapforge-project.json" : format === "js" ? "generatedMap.js" : "generatedMap.ts";

  const handleDownload = () => {
    const fullCode = buildCode(project, format);
    downloadTextFile(filename, fullCode, format === "json" ? "application/json" : "text/plain");
  };

  const handleCopy = async () => {
    const fullCode = buildCode(project, format);
    await navigator.clipboard.writeText(fullCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <aside className="panel right-panel">
      <div className="right-language-bar">
        <label className="language-select compact-language-select">
          <span>{t("language")}</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      <section className="section export-header">
        <h2>{t("exportTitle")}</h2>
        <label className="export-format-label">
          <span>{t("exportFormat")}</span>
          <select className="export-format-select" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            <option value="ts">{t("exportTs")}</option>
            <option value="js">{t("exportJs")}</option>
            <option value="json">{t("exportJson")}</option>
          </select>
        </label>
        {isLarge && <p className="hint warning">{t("largeModel")} {project.shapes.length} shapes.</p>}
        <div className="button-row export-buttons">
          <button className="action-button" type="button" onClick={handleCopy}>{t("copyFull")}</button>
          <button className="action-button" type="button" onClick={handleDownload}>{t("download")}</button>
          {isLarge && (
            <button className="action-button" type="button" onClick={() => setShowFullPreview((value) => !value)}>
              {showFullPreview ? t("hideFullPreview") : t("showFullPreview")}
            </button>
          )}
        </div>
        {copied && <div className="copy-toast" role="status">{t("copied")}</div>}
      </section>
      <pre className="code-preview"><code>{code}</code></pre>
    </aside>
  );
}
