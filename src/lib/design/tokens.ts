export const THEME_IDS = ["limestone", "obsidian", "patina", "midnight", "marble"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "limestone";

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

export const themes: Record<ThemeId, ThemeDefinition> = {
  limestone: {
    id: "limestone",
    label: "Limestone",
    line: "Warm night, antique gold",
    scheme: "dark",
    colors: {
      void: "#08080a",
      ink: "#111114",
      stone: "#1a1a1e",
      raised: "#24242a",
      ash: "#9b9285",
      mist: "#d8d0c4",
      paper: "#f6f1e7",
      bronze: "#c6a36c",
      ember: "#c85c2a",
      flame: "#e39256",
      blood: "#b3473c",
    },
  },
  obsidian: {
    id: "obsidian",
    label: "Obsidian",
    line: "Cold black, silver, ice",
    scheme: "dark",
    colors: {
      void: "#07080a",
      ink: "#0c0e12",
      stone: "#14171d",
      raised: "#1d222b",
      ash: "#8b919c",
      mist: "#c9ced6",
      paper: "#eef1f6",
      bronze: "#b7c0cc",
      ember: "#6e8cff",
      flame: "#a8c0ff",
      blood: "#c45c5c",
    },
  },
  patina: {
    id: "patina",
    label: "Patina",
    line: "Forest night, oxidized copper",
    scheme: "dark",
    colors: {
      void: "#070908",
      ink: "#0c110f",
      stone: "#141a17",
      raised: "#1c2620",
      ash: "#879388",
      mist: "#c5d0c6",
      paper: "#e8f0e9",
      bronze: "#8fb89a",
      ember: "#3d8a6a",
      flame: "#6fb894",
      blood: "#b3473c",
    },
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    line: "Indigo vault, candle gold",
    scheme: "dark",
    colors: {
      void: "#07080f",
      ink: "#0c0e18",
      stone: "#141628",
      raised: "#1c2040",
      ash: "#8a8eaa",
      mist: "#c6c9dc",
      paper: "#eceef8",
      bronze: "#c9b06a",
      ember: "#6b7cff",
      flame: "#9aa6ff",
      blood: "#c45c6e",
    },
  },
  marble: {
    id: "marble",
    label: "Marble",
    line: "Day stone, ink on ivory",
    scheme: "light",
    colors: {
      void: "#f3eee4",
      ink: "#e8e0d2",
      stone: "#ddd4c4",
      raised: "#d2c6b3",
      ash: "#6f675c",
      mist: "#4a443c",
      paper: "#1c1814",
      bronze: "#8a6d32",
      ember: "#b44a1c",
      flame: "#c86a32",
      blood: "#9c3530",
    },
  },
};

/** Default brand palette for OG images, certificates, and metadata. */
export const colors = themes[DEFAULT_THEME].colors;

export const fonts = {
  display: 'var(--font-instrument), ui-serif, Georgia, "Times New Roman", serif',
  sans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
} as const;

export const motion = {
  tickMs: 180,
  messageInMs: 420,
  emberMs: 280,
  monumentMs: 720,
} as const;
