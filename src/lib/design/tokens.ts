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
      void: "#0a0a0c",
      ink: "#131316",
      stone: "#1a1a1e",
      raised: "#25252b",
      ash: "#a3998d",
      mist: "#d5cec3",
      paper: "#f3eee6",
      bronze: "#c4a36b",
      ember: "#c0562a",
      flame: "#de8b4c",
      blood: "#b3473c",
    },
  },
  obsidian: {
    id: "obsidian",
    label: "Obsidian",
    line: "Cold black, silver, ice",
    scheme: "dark",
    colors: {
      void: "#08090c",
      ink: "#0e1015",
      stone: "#161920",
      raised: "#1f242e",
      ash: "#9399a4",
      mist: "#cdd2d9",
      paper: "#eef1f5",
      bronze: "#b4bdc9",
      ember: "#6a86f0",
      flame: "#a3baff",
      blood: "#c45c5c",
    },
  },
  patina: {
    id: "patina",
    label: "Patina",
    line: "Forest night, oxidized copper",
    scheme: "dark",
    colors: {
      void: "#080a09",
      ink: "#0e1311",
      stone: "#161c19",
      raised: "#1e2721",
      ash: "#8e9a8f",
      mist: "#c8d1c8",
      paper: "#e8efe9",
      bronze: "#8db498",
      ember: "#3d8668",
      flame: "#6eb492",
      blood: "#b3473c",
    },
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    line: "Indigo vault, candle gold",
    scheme: "dark",
    colors: {
      void: "#080910",
      ink: "#0e101a",
      stone: "#16182a",
      raised: "#1e2240",
      ash: "#9195ae",
      mist: "#c8cbdc",
      paper: "#eceef6",
      bronze: "#c6ae6c",
      ember: "#6878f0",
      flame: "#9aa6f5",
      blood: "#c45c6e",
    },
  },
  marble: {
    id: "marble",
    label: "Marble",
    line: "Day stone, ink on ivory",
    scheme: "light",
    colors: {
      void: "#f4efe6",
      ink: "#ebe3d4",
      stone: "#e0d6c6",
      raised: "#d4c8b6",
      ash: "#6d665c",
      mist: "#4a443c",
      paper: "#1b1814",
      bronze: "#8a6d34",
      ember: "#b0481c",
      flame: "#c46832",
      blood: "#9c3530",
    },
  },
};

/** Default brand palette for OG images, certificates, and metadata. */
export const colors = themes[DEFAULT_THEME].colors;

export const fonts = {
  display: 'var(--font-instrument), "Iowan Old Style", Palatino, Georgia, serif',
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
