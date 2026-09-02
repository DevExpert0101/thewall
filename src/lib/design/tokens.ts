export const THEME_IDS = ["carbon", "navy", "atelier", "paper", "swiss"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "carbon";

export type ThemeColors = {
  void: string;
  ink: string;
  stone: string;
  raised: string;
  ash: string;
  mist: string;
  paper: string;
  bronze: string;
  ember: string;
  flame: string;
  blood: string;
};

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  line: string;
  scheme: "dark" | "light";
  colors: ThemeColors;
};

/**
 * Monument palettes. Surfaces stay material; chroma is punctuation only.
 * Warm black / ink / clay / parchment / gallery — not SaaS gray or costume gold.
 */
export const themes: Record<ThemeId, ThemeDefinition> = {
  carbon: {
    id: "carbon",
    label: "Carbon",
    line: "Warm black, ivory",
    scheme: "dark",
    colors: {
      void: "#090807",
      ink: "#100f0d",
      stone: "#161513",
      raised: "#201e1b",
      ash: "#8f887e",
      mist: "#d4cdc3",
      paper: "#f4efe6",
      bronze: "#a89f90",
      ember: "#c4b4a0",
      flame: "#e8ddd0",
      blood: "#8f3a36",
    },
  },
  navy: {
    id: "navy",
    label: "Navy",
    line: "Printer's ink, oxblood",
    scheme: "dark",
    colors: {
      void: "#0c0d12",
      ink: "#12141b",
      stone: "#171920",
      raised: "#22252e",
      ash: "#8b8e98",
      mist: "#c8cad1",
      paper: "#f2efe8",
      bronze: "#b8b0a4",
      ember: "#8a3d42",
      flame: "#b0545a",
      blood: "#7a3034",
    },
  },
  atelier: {
    id: "atelier",
    label: "Atelier",
    line: "Taupe, clay, rust",
    scheme: "dark",
    colors: {
      void: "#14110e",
      ink: "#1c1814",
      stone: "#241f1a",
      raised: "#2e2822",
      ash: "#8e857a",
      mist: "#d2c8bc",
      paper: "#f3ece3",
      bronze: "#8a6f4e",
      ember: "#8b4e32",
      flame: "#a86240",
      blood: "#7a3530",
    },
  },
  paper: {
    id: "paper",
    label: "Paper",
    line: "Parchment, charcoal",
    scheme: "light",
    colors: {
      void: "#f3f0e6",
      ink: "#ebe6d8",
      stone: "#fffef2",
      raised: "#f4ecdd",
      ash: "#666666",
      mist: "#333333",
      paper: "#252525",
      bronze: "#8a5a28",
      ember: "#252525",
      flame: "#111111",
      blood: "#7a3030",
    },
  },
  swiss: {
    id: "swiss",
    label: "Swiss",
    line: "Gallery gray, signal red",
    scheme: "light",
    colors: {
      void: "#e8e6e1",
      ink: "#dddcd7",
      stone: "#f3f2ef",
      raised: "#ffffff",
      ash: "#5a5854",
      mist: "#2a2926",
      paper: "#0e0e0d",
      bronze: "#0e0e0d",
      ember: "#b41e2d",
      flame: "#d12536",
      blood: "#8f1a26",
    },
  },
};

export const LIGHT_THEME_IDS = THEME_IDS.filter((id) => themes[id].scheme === "light");

/** Default brand palette for OG images, certificates, and metadata. */
export const colors = themes[DEFAULT_THEME].colors;

export const fonts = {
  display: 'var(--font-instrument), "Iowan Old Style", Palatino, Georgia, "Times New Roman", serif',
  monument: 'var(--font-cinzel), var(--font-instrument), Palatino, Georgia, serif',
  hand: '"Segoe Script", "Bradley Hand", cursive',
  hands: [
    '"Segoe Script", cursive',
    '"Bradley Hand", cursive',
    '"Segoe Script", cursive',
    '"Bradley Hand", cursive',
    '"Segoe Script", cursive',
    '"Bradley Hand", cursive',
  ],
  sans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
} as const;

export const motion = {
  tickMs: 200,
  messageInMs: 480,
  emberMs: 320,
  monumentMs: 800,
} as const;
