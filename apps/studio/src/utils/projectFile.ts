import type { MapProject } from "../types";
import { downloadTextFile, safeJsonParse } from "./download";

const PROJECT_FILE_FORMAT = "map-forge-project";
const PROJECT_FILE_VERSION = "0.1.17";

interface ProjectFilePayload {
  format: typeof PROJECT_FILE_FORMAT;
  version: string;
  savedAt: string;
  project: MapProject;
}

function slugifyFilename(value: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿\-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return safe || "mapforge-project";
}

function dateStamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image data."));
    reader.readAsDataURL(blob);
  });
}

async function normaliseImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:")) return imageUrl;
  if (imageUrl.startsWith("blob:")) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch (error) {
      console.warn("Could not embed blob image in project file.", error);
      return null;
    }
  }
  return imageUrl;
}

export function isMapProject(value: unknown): value is MapProject {
  const project = value as Partial<MapProject> | null;
  return Boolean(
    project &&
    typeof project === "object" &&
    typeof project.projectName === "string" &&
    Array.isArray(project.shapes) &&
    Array.isArray(project.points) &&
    project.settings &&
    typeof project.settings === "object"
  );
}

export async function createProjectFilePayload(project: MapProject): Promise<ProjectFilePayload> {
  const imageUrl = await normaliseImageUrl(project.imageUrl);
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    project: {
      ...project,
      imageUrl,
    },
  };
}

export async function downloadProjectFile(project: MapProject) {
  const payload = await createProjectFilePayload(project);
  const filename = `${slugifyFilename(project.projectName)}-${dateStamp()}.mapforge.json`;
  downloadTextFile(filename, JSON.stringify(payload, null, 2), "application/json");
}

export function parseProjectFile(text: string): MapProject | null {
  const parsed = safeJsonParse<unknown>(text);
  if (!parsed || typeof parsed !== "object") return null;

  const maybePayload = parsed as Partial<ProjectFilePayload>;
  if (maybePayload.format === PROJECT_FILE_FORMAT && isMapProject(maybePayload.project)) {
    return maybePayload.project;
  }

  if (isMapProject(parsed)) return parsed;
  return null;
}

export async function readProjectFile(file: File) {
  const text = await file.text();
  return parseProjectFile(text);
}
