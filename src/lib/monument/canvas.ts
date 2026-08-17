export type MonumentCanvasGeometry = {
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  capacity: number;
};

export type MonumentPlot = {
  position: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** One-screen logical wall. Configurable. Not a public scarcity claim. */
export const DEFAULT_CANVAS_WIDTH = 1440;
export const DEFAULT_CANVAS_HEIGHT = 900;
export const DEFAULT_CELL_WIDTH = 280;
export const DEFAULT_CELL_HEIGHT = 160;

/** Must match public.monument_plot. */
const PLOT_MIX = 747796405n;
const PLOT_SALT_X = 17n;
const PLOT_SALT_Y = 41n;
const U32 = 4294967295n;

function positiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

export function monumentCanvasFrom(input: {
  width?: number | null;
  height?: number | null;
  cellWidth?: number | null;
  cellHeight?: number | null;
  capacity?: number | null;
} = {}): MonumentCanvasGeometry {
  const cellWidth = input.cellWidth && input.cellWidth > 0 ? input.cellWidth : DEFAULT_CELL_WIDTH;
  const cellHeight = input.cellHeight && input.cellHeight > 0 ? input.cellHeight : DEFAULT_CELL_HEIGHT;
  const width = input.width && input.width > 0 ? input.width : DEFAULT_CANVAS_WIDTH;
  const height = input.height && input.height > 0 ? input.height : DEFAULT_CANVAS_HEIGHT;
  const columns = Math.max(1, Math.floor(width / cellWidth));
  const rows = Math.max(1, Math.floor(height / cellHeight));
  const physical = columns * rows;
  const capacity =
    input.capacity && input.capacity > 0 ? Math.min(input.capacity, physical) : physical;
  return {
    width,
    height,
    cellWidth,
    cellHeight,
    columns,
    rows,
    capacity,
  };
}

export function monumentCanvasFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): MonumentCanvasGeometry {
  return monumentCanvasFrom({
    width: positiveInt(env.MONUMENT_CANVAS_WIDTH, DEFAULT_CANVAS_WIDTH),
    height: positiveInt(env.MONUMENT_CANVAS_HEIGHT, DEFAULT_CANVAS_HEIGHT),
    cellWidth: positiveInt(env.MONUMENT_CELL_WIDTH, DEFAULT_CELL_WIDTH),
    cellHeight: positiveInt(env.MONUMENT_CELL_HEIGHT, DEFAULT_CELL_HEIGHT),
    capacity: env.MONUMENT_CAPACITY ? positiveInt(env.MONUMENT_CAPACITY, 0) || null : null,
  });
}

function plotOffset(position: number, span: number, salt: bigint): number {
  if (span < 1) return 0;
  const mixed = (BigInt(position) * PLOT_MIX + salt) & U32;
  return Number(mixed % BigInt(span + 1));
}

export function plotForPosition(position: number, canvas: MonumentCanvasGeometry): MonumentPlot {
  if (!Number.isInteger(position) || position < 1) {
    throw new Error("Monument position must be a positive integer.");
  }
  if (position > canvas.capacity) {
    throw new Error("Monument canvas is full.");
  }
  const spanX = Math.max(0, canvas.width - canvas.cellWidth);
  const spanY = Math.max(0, canvas.height - canvas.cellHeight);
  return {
    position,
    x: plotOffset(position, spanX, PLOT_SALT_X),
    y: plotOffset(position, spanY, PLOT_SALT_Y),
    width: canvas.cellWidth,
    height: canvas.cellHeight,
  };
}
