import type { MapShape, Point2D } from "../types";

export interface LineDetectionOptions {
  /** Brightness threshold used by the zip reference algorithm. */
  threshold: number;
  /** Same as the reference zip `cellSize`: smaller = follows curved source lines more closely. */
  gridSize: number;
  /** Minimum connected cells kept as a wall component. */
  minRunCells: number;
  height: number;
  color: string;
  borderColor: string;
  opacity: number;
  maxImageSide: number;
  mode: "dark" | "light" | "auto";
  /** Extra local contrast amount. Kept so faint source lines become easier to capture. */
  adaptiveContrast: number;
  /** Sobel edge strength added to the cell coverage test. */
  edgeStrength: number;
  /** Minimum detected-line coverage in a cell. Similar to the zip reference coverage filter. */
  minCellCoverage: number;
  /** Expands the mask by N cells before voxel generation. */
  dilate: number;
  /** Helps ignore saturated graphics when looking for CAD-style pale lines. */
  preferLowSaturation: boolean;
  /** Floor-plan preset: pale linework on a colored fill. Ignores pale labels on dark empty background. */
  ignoreDarkBackground: boolean;
  /** Minimum average neighbourhood brightness for a pale pixel to be treated as linework. */
  minNeighbourBrightness: number;
  minComponentPixels?: number;
  simplifyTolerance?: number;
  smoothIterations?: number;
  maxShapes?: number;
  /** Crop percentage from each side, same idea as the uploaded reference zip. */
  cropMargin?: number;
  /** Use original sampled color from the uploaded floorplan instead of one fixed wall color. */
  useSourceColors?: boolean;
  /** Preprocess uploaded images into a high-contrast virtual line mask before 3D generation. */
  enhanceLinesBeforeDetect?: boolean;
  /** Local luminance contrast needed to treat a pixel as linework after preprocessing. */
  localContrastThreshold?: number;
  /** Local RGB distance needed to treat same-brightness colored linework as linework. */
  colorDifferenceThreshold?: number;
  /** Radius used to estimate local background color. Larger = better for broad colored fills. */
  backgroundSampleRadius?: number;
  /** Multiplies detected local contrast. Higher makes faint lines more visible. */
  contrastBoost?: number;
}


type CellColor = { r: number; g: number; b: number };
type CellSample = {
  coverage: number;
  brightness: number;
  saturation: number;
  color: CellColor;
};
type Component = {
  cells: { x: number; y: number; index: number }[];
  color: CellColor;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });
}

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}


type IntegralImages = {
  gray: Float64Array;
  r: Float64Array;
  g: Float64Array;
  b: Float64Array;
  width: number;
  height: number;
  stride: number;
};

function makeIntegralImages(pixels: Uint8ClampedArray, gray: Float32Array, width: number, height: number): IntegralImages {
  const stride = width + 1;
  const size = (width + 1) * (height + 1);
  const integralGray = new Float64Array(size);
  const integralR = new Float64Array(size);
  const integralG = new Float64Array(size);
  const integralB = new Float64Array(size);

  for (let y = 1; y <= height; y += 1) {
    let rowGray = 0;
    let rowR = 0;
    let rowG = 0;
    let rowB = 0;
    for (let x = 1; x <= width; x += 1) {
      const sourceIndex = (y - 1) * width + (x - 1);
      const p = sourceIndex * 4;
      rowGray += gray[sourceIndex];
      rowR += pixels[p];
      rowG += pixels[p + 1];
      rowB += pixels[p + 2];
      const target = y * stride + x;
      const above = (y - 1) * stride + x;
      integralGray[target] = integralGray[above] + rowGray;
      integralR[target] = integralR[above] + rowR;
      integralG[target] = integralG[above] + rowG;
      integralB[target] = integralB[above] + rowB;
    }
  }

  return { gray: integralGray, r: integralR, g: integralG, b: integralB, width, height, stride };
}

function boxAverage(sum: Float64Array, integral: IntegralImages, x: number, y: number, radius: number) {
  const x1 = clamp(x - radius, 0, integral.width - 1);
  const y1 = clamp(y - radius, 0, integral.height - 1);
  const x2 = clamp(x + radius, 0, integral.width - 1);
  const y2 = clamp(y + radius, 0, integral.height - 1);
  const stride = integral.stride;
  const ax = x1;
  const ay = y1;
  const bx = x2 + 1;
  const by = y2 + 1;
  const area = Math.max(1, (bx - ax) * (by - ay));
  const total = sum[by * stride + bx] - sum[ay * stride + bx] - sum[by * stride + ax] + sum[ay * stride + ax];
  return total / area;
}

function localBackground(integral: IntegralImages, x: number, y: number, radius: number) {
  return {
    gray: boxAverage(integral.gray, integral, x, y, radius),
    r: boxAverage(integral.r, integral, x, y, radius),
    g: boxAverage(integral.g, integral, x, y, radius),
    b: boxAverage(integral.b, integral, x, y, radius),
  };
}

function makeGrayAndColor(pixels: Uint8ClampedArray, width: number, height: number) {
  const gray = new Float32Array(width * height);
  const sat = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const p = i * 4;
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      gray[i] = r * 0.299 + g * 0.587 + b * 0.114;
      sat[i] = saturation(r, g, b);
    }
  }
  return { gray, sat };
}

function localMeanGray(gray: Float32Array, width: number, height: number, x: number, y: number, radius = 4) {
  let total = 0;
  let count = 0;
  for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
      total += gray[yy * width + xx];
      count += 1;
    }
  }
  return count ? total / count : 0;
}

function sobelAt(gray: Float32Array, width: number, height: number, x: number, y: number) {
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return 0;
  const i = y * width + x;
  const gx =
    -gray[i - width - 1] + gray[i - width + 1] +
    -2 * gray[i - 1] + 2 * gray[i + 1] +
    -gray[i + width - 1] + gray[i + width + 1];
  const gy =
    -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] +
    gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
  return Math.hypot(gx, gy);
}

function sampleCell(
  pixels: Uint8ClampedArray,
  gray: Float32Array,
  sat: Float32Array,
  integral: IntegralImages,
  imageWidth: number,
  imageHeight: number,
  startX: number,
  startY: number,
  size: number,
  options: LineDetectionOptions,
): CellSample {
  let filled = 0;
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let filledColorCount = 0;

  const endY = Math.min(imageHeight, startY + size);
  const endX = Math.min(imageWidth, startX + size);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = y * imageWidth + x;
      const p = index * 4;
      const pr = pixels[p];
      const pg = pixels[p + 1];
      const pb = pixels[p + 2];
      const brightness = gray[index];
      const edge = sobelAt(gray, imageWidth, imageHeight, x, y);
      const radius = clamp(Math.round(options.backgroundSampleRadius ?? 11), 2, 80);
      const background = localBackground(integral, x, y, radius);
      const localBoost = options.adaptiveContrast;
      const lowSat = sat[index] < (options.preferLowSaturation ? 0.34 : 0.65);
      const neighbourBrightness = options.ignoreDarkBackground ? background.gray : 255;
      const onUsableFloorArea = neighbourBrightness >= (options.minNeighbourBrightness || 0);

      const colorDistance = Math.hypot(pr - background.r, pg - background.g, pb - background.b);
      const luminanceContrast = Math.abs(brightness - background.gray) * (options.contrastBoost ?? 1);
      const localContrastLine =
        luminanceContrast >= (options.localContrastThreshold ?? 18) ||
        colorDistance >= (options.colorDifferenceThreshold ?? 34);

      // Dark mode is useful for black linework on white drawings.
      const darkLine = brightness < options.threshold || (options.enhanceLinesBeforeDetect && brightness < background.gray - (options.localContrastThreshold ?? 18));

      // Light mode is useful for pale CAD lines on a colored fill.
      const directLightLine = brightness > options.threshold && (!options.preferLowSaturation || lowSat);
      const edgeAssistedLightLine =
        edge > options.edgeStrength * 5 &&
        brightness > clamp(options.threshold - localBoost, 0, 255) &&
        (!options.preferLowSaturation || lowSat);
      const enhancedLightLine =
        options.enhanceLinesBeforeDetect &&
        brightness > background.gray + (options.localContrastThreshold ?? 18) &&
        (!options.preferLowSaturation || lowSat || colorDistance > (options.colorDifferenceThreshold ?? 34));
      const lightLine = onUsableFloorArea && (directLightLine || edgeAssistedLightLine || enhancedLightLine);

      // Auto mode first makes a virtual high-contrast line mask from the uploaded image.
      // This is more stable when users change the source map colors, because it compares
      // each pixel with its local background instead of assuming white lines or black lines.
      const autoLine =
        options.enhanceLinesBeforeDetect &&
        onUsableFloorArea &&
        localContrastLine &&
        (edge > options.edgeStrength || luminanceContrast > (options.localContrastThreshold ?? 18) * 1.35 || colorDistance > (options.colorDifferenceThreshold ?? 34) * 1.2);

      const isLine = options.mode === "auto" ? autoLine : options.mode === "dark" ? darkLine : lightLine;

      total += 1;
      if (isLine) {
        filled += 1;
        r += pr;
        g += pg;
        b += pb;
        filledColorCount += 1;
      }
    }
  }

  const divisor = Math.max(filledColorCount, 1);
  const color = { r: r / divisor, g: g / divisor, b: b / divisor };
  return {
    coverage: total ? filled / total : 0,
    brightness: (color.r + color.g + color.b) / 3,
    saturation: saturation(color.r, color.g, color.b),
    color,
  };
}

function dilateMask(mask: Uint8Array, cols: number, rows: number, iterations: number) {
  let current = mask;
  for (let i = 0; i < iterations; i += 1) {
    const next = new Uint8Array(current);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const index = y * cols + x;
        if (current[index]) continue;
        let found = false;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(rows - 1, y + 1); yy += 1) {
          for (let xx = Math.max(0, x - 1); xx <= Math.min(cols - 1, x + 1); xx += 1) {
            if (current[yy * cols + xx]) found = true;
          }
        }
        if (found) next[index] = 1;
      }
    }
    current = next;
  }
  return current;
}

function findComponents(mask: Uint8Array, colors: CellColor[], cols: number, rows: number, minCells: number): Component[] {
  const visited = new Uint8Array(mask.length);
  const components: Component[] = [];
  const queue: number[] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    queue.length = 0;
    queue.push(start);
    visited[start] = 1;

    const cells: Component["cells"] = [];
    let r = 0;
    let g = 0;
    let b = 0;

    while (queue.length) {
      const current = queue.pop() as number;
      const x = current % cols;
      const y = Math.floor(current / cols);
      cells.push({ x, y, index: current });

      const color = colors[current] || { r: 245, g: 245, b: 245 };
      r += color.r;
      g += color.g;
      b += color.b;

      const neighbours = [current - 1, current + 1, current - cols, current + cols];
      for (const next of neighbours) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        const nx = next % cols;
        const ny = Math.floor(next / cols);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }

    if (cells.length < minCells) continue;
    components.push({
      cells,
      color: {
        r: Math.round(r / cells.length),
        g: Math.round(g / cells.length),
        b: Math.round(b / cells.length),
      },
    });
  }

  return components.sort((a, b) => b.cells.length - a.cells.length);
}

function componentToMergedRects(component: Component, cols: number) {
  const cellSet = new Set(component.cells.map((cell) => cell.index));
  const used = new Set<number>();
  const sorted = component.cells.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rects: { x: number; y: number; w: number; h: number }[] = [];

  for (const start of sorted) {
    const startIndex = start.y * cols + start.x;
    if (used.has(startIndex)) continue;

    let w = 1;
    while (cellSet.has(start.y * cols + start.x + w) && !used.has(start.y * cols + start.x + w)) {
      w += 1;
    }

    let h = 1;
    let canGrow = true;
    while (canGrow) {
      const nextY = start.y + h;
      for (let dx = 0; dx < w; dx += 1) {
        const index = nextY * cols + start.x + dx;
        if (!cellSet.has(index) || used.has(index)) {
          canGrow = false;
          break;
        }
      }
      if (canGrow) h += 1;
    }

    for (let yy = start.y; yy < start.y + h; yy += 1) {
      for (let xx = start.x; xx < start.x + w; xx += 1) {
        used.add(yy * cols + xx);
      }
    }

    rects.push({ x: start.x, y: start.y, w, h });
  }

  return rects;
}

const yieldToBrowser = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const rgbToHex = (color: CellColor) => {
  const r = clamp(Math.round(color.r), 0, 255).toString(16).padStart(2, "0");
  const g = clamp(Math.round(color.g), 0, 255).toString(16).padStart(2, "0");
  const b = clamp(Math.round(color.b), 0, 255).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
};

function makeVoxelShape(
  id: string,
  name: string,
  x: number,
  y: number,
  size: number,
  color: string,
  options: LineDetectionOptions,
): MapShape {
  const points: Point2D[] = [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ];
  return {
    id,
    name,
    color,
    borderColor: options.borderColor,
    height: options.height,
    opacity: options.opacity,
    points,
    renderMode: "box",
    box: { x, y, width: size, height: size },
  };
}

export async function detectLineShapesFromImage(imageUrl: string, options: LineDetectionOptions): Promise<MapShape[]> {
  const img = await loadImage(imageUrl);
  const rawWidth = img.naturalWidth;
  const rawHeight = img.naturalHeight;
  const scale = Math.min(1, options.maxImageSide / Math.max(rawWidth, rawHeight));
  const width = Math.max(1, Math.round(rawWidth * scale));
  const height = Math.max(1, Math.round(rawHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { gray, sat } = makeGrayAndColor(imageData.data, width, height);
  const integral = makeIntegralImages(imageData.data, gray, width, height);

  const cropMargin = clamp(options.cropMargin ?? 0.01, 0, 0.35);
  const marginX = Math.floor(width * cropMargin);
  const marginY = Math.floor(height * cropMargin);
  const crop = {
    x: marginX,
    y: marginY,
    w: width - marginX * 2,
    h: height - marginY * 2,
  };

  const cellSize = clamp(Math.round(options.gridSize || 4), 1, 64);
  const cols = Math.max(1, Math.floor(crop.w / cellSize));
  const rows = Math.max(1, Math.floor(crop.h / cellSize));
  const mask = new Uint8Array(cols * rows);
  const colors: CellColor[] = new Array(cols * rows);

  for (let gy = 0; gy < rows; gy += 1) {
    if (gy % 24 === 0) await yieldToBrowser();
    for (let gx = 0; gx < cols; gx += 1) {
      const sample = sampleCell(
        imageData.data,
        gray,
        sat,
        integral,
        width,
        height,
        crop.x + gx * cellSize,
        crop.y + gy * cellSize,
        cellSize,
        options,
      );
      const index = gy * cols + gx;
      colors[index] = sample.color;

      const isDarkText = sample.saturation < 0.08 && sample.brightness < 70;
      const enoughCoverage = sample.coverage >= clamp(options.minCellCoverage || 0.12, 0.001, 1);
      mask[index] = enoughCoverage && !isDarkText ? 1 : 0;
    }
  }

  const expanded = dilateMask(mask, cols, rows, clamp(Math.round(options.dilate || 0), 0, 8));
  const minCells = Math.max(1, Math.round(options.minComponentPixels ?? options.minRunCells ?? 8));
  const components = findComponents(expanded, colors, cols, rows, minCells);

  const sourceScaleX = rawWidth / width;
  const sourceScaleY = rawHeight / height;
  const shapes: MapShape[] = [];
  const maxShapes = options.maxShapes ?? 3500;

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    if (componentIndex % 8 === 0) await yieldToBrowser();
    const component = components[componentIndex];
    const componentColor = options.useSourceColors ? rgbToHex(component.color) : options.color;
    const rects = componentToMergedRects(component, cols);

    for (const rect of rects) {
      if (shapes.length >= maxShapes) return shapes;
      const x = (crop.x + rect.x * cellSize) * sourceScaleX;
      const y = (crop.y + rect.y * cellSize) * sourceScaleY;
      const widthBox = rect.w * cellSize * sourceScaleX;
      const heightBox = rect.h * cellSize * sourceScaleY;
      const color = options.useSourceColors ? componentColor : options.color;
      const shape = makeVoxelShape(
        `auto-wall-${componentIndex}-${rect.x}-${rect.y}-${rect.w}x${rect.h}`,
        `Merged Wall ${componentIndex + 1}`,
        Number(x.toFixed(3)),
        Number(y.toFixed(3)),
        Math.max(sourceScaleX, sourceScaleY) * cellSize,
        color,
        options,
      );
      shape.points = [
        [Number(x.toFixed(3)), Number(y.toFixed(3))],
        [Number((x + widthBox).toFixed(3)), Number(y.toFixed(3))],
        [Number((x + widthBox).toFixed(3)), Number((y + heightBox).toFixed(3))],
        [Number(x.toFixed(3)), Number((y + heightBox).toFixed(3))],
      ];
      shape.box = {
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3)),
        width: Number(widthBox.toFixed(3)),
        height: Number(heightBox.toFixed(3)),
      };
      shapes.push(shape);
    }
  }

  return shapes;
}
