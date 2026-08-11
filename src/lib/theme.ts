/**
 * Centralised ThemeManager.
 *
 * Every colour used anywhere in the app comes from here. A theme is a pair of
 * complete palettes (light + dark) — never an inversion of the other. Applying
 * a theme writes CSS custom properties on <html>, so *all* components, shadcn
 * primitives, sheets and dialogs update in the same frame.
 */
import type { Appearance, KeyStyle, Skin } from "./settings";

export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceSecondary: string;
  card: string;
  button: string;
  buttonPressed: string;
  buttonBorder: string;
  primary: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  icon: string;
  danger: string;
  divider: string;
  inputBackground: string;
  inputText: string;
  shadow: string;
}

export interface ThemeDefinition {
  name: Skin;
  label: string;
  swatch: string[];
  lightColors: ThemeTokens;
  darkColors: ThemeTokens;
}

export const THEMES: ThemeDefinition[] = [

  {
    name: "midnight",
    label: "Midnight Indigo",
    swatch: ["#0f1226", "#232a52", "#6f7bff"],
    darkColors: {
      background: "#0c0f22",
      surface: "#13172f",
      surfaceSecondary: "#1a1f3d",
      card: "#161b36",
      button: "#212849",
      buttonPressed: "#2c3364",
      buttonBorder: "#39417a",
      primary: "#8b93ff",
      secondary: "#9aa2d4",
      textPrimary: "#f1f2ff",
      textSecondary: "#a8afd6",
      icon: "#e4e7ff",
      danger: "#ff5a7a",
      divider: "#252b52",
      inputBackground: "#1a1f3d",
      inputText: "#f1f2ff",
      shadow: "rgba(4,6,20,0.7)",
    },
    lightColors: {
      background: "#f4f5fd",
      surface: "#ffffff",
      surfaceSecondary: "#e8eaf9",
      card: "#ffffff",
      button: "#e4e7f8",
      buttonPressed: "#d2d7f1",
      buttonBorder: "#bcc3e8",
      primary: "#3f47c4",
      secondary: "#5760a0",
      textPrimary: "#131634",
      textSecondary: "#525a80",
      icon: "#1b2044",
      danger: "#c31f45",
      divider: "#d8dcf1",
      inputBackground: "#ffffff",
      inputText: "#131634",
      shadow: "rgba(19,22,52,0.18)",
    },
  },
  {
    name: "ocean",
    label: "Ocean Teal",
    swatch: ["#0b1a26", "#153347", "#37c8e8"],
    darkColors: {
      background: "#081520",
      surface: "#0d1f2d",
      surfaceSecondary: "#132b3c",
      card: "#102534",
      button: "#1a3648",
      buttonPressed: "#234b64",
      buttonBorder: "#2c5a76",
      primary: "#3fc9ea",
      secondary: "#8ab3c6",
      textPrimary: "#ecf7fb",
      textSecondary: "#9dbccb",
      icon: "#daeef6",
      danger: "#ff5f6d",
      divider: "#1c3c51",
      inputBackground: "#132b3c",
      inputText: "#ecf7fb",
      shadow: "rgba(2,12,20,0.7)",
    },
    lightColors: {
      background: "#f1f8fb",
      surface: "#ffffff",
      surfaceSecondary: "#e3f0f6",
      card: "#ffffff",
      button: "#ddedf4",
      buttonPressed: "#c9e2ec",
      buttonBorder: "#aed4e3",
      primary: "#0a6f8c",
      secondary: "#3d6a7c",
      textPrimary: "#0c1f28",
      textSecondary: "#456371",
      icon: "#122d39",
      danger: "#bb2231",
      divider: "#d2e6ef",
      inputBackground: "#ffffff",
      inputText: "#0c1f28",
      shadow: "rgba(12,31,40,0.16)",
    },
  },
  {
    name: "graphite",
    label: "Graphite Amber",
    swatch: ["#16181d", "#2a2d34", "#f0a93f"],
    darkColors: {
      background: "#0f1115",
      surface: "#16181d",
      surfaceSecondary: "#1e2128",
      card: "#1a1d23",
      button: "#25282f",
      buttonPressed: "#33373f",
      buttonBorder: "#3c414b",
      primary: "#f0a93f",
      secondary: "#8b93a1",
      textPrimary: "#f4f5f7",
      textSecondary: "#a7adb8",
      icon: "#e7e9ee",
      danger: "#ff5567",
      divider: "#2c3038",
      inputBackground: "#1e2128",
      inputText: "#f4f5f7",
      shadow: "rgba(0,0,0,0.65)",
    },
    lightColors: {
      background: "#f6f7f9",
      surface: "#ffffff",
      surfaceSecondary: "#eceef2",
      card: "#ffffff",
      button: "#e9ebf0",
      buttonPressed: "#d9dce4",
      buttonBorder: "#c6ccd6",
      primary: "#a1620a",
      secondary: "#5c6472",
      textPrimary: "#14171c",
      textSecondary: "#565e6b",
      icon: "#1c2129",
      danger: "#c02234",
      divider: "#dde1e8",
      inputBackground: "#ffffff",
      inputText: "#14171c",
      shadow: "rgba(20,23,28,0.18)",
    },
  },
  {
    name: "mint",
    label: "Neon Mint",
    swatch: ["#0c1a17", "#17342c", "#3ee8b0"],
    darkColors: {
      background: "#08140f",
      surface: "#0e1e18",
      surfaceSecondary: "#142a22",
      card: "#11241d",
      button: "#1a352b",
      buttonPressed: "#234639",
      buttonBorder: "#2c5445",
      primary: "#43e8ae",
      secondary: "#8fbdad",
      textPrimary: "#eefaf4",
      textSecondary: "#9ec2b5",
      icon: "#dcf5eb",
      danger: "#ff6060",
      divider: "#1d3a30",
      inputBackground: "#142a22",
      inputText: "#eefaf4",
      shadow: "rgba(2,12,8,0.7)",
    },
    lightColors: {
      background: "#f2faf6",
      surface: "#ffffff",
      surfaceSecondary: "#e4f2eb",
      card: "#ffffff",
      button: "#dff0e8",
      buttonPressed: "#cbe6da",
      buttonBorder: "#b3d8c7",
      primary: "#0b7a55",
      secondary: "#3f6d5c",
      textPrimary: "#0d1f18",
      textSecondary: "#4a6459",
      icon: "#132b22",
      danger: "#bd2230",
      divider: "#d3e8dd",
      inputBackground: "#ffffff",
      inputText: "#0d1f18",
      shadow: "rgba(13,31,24,0.16)",
    },
  },
  {
    name: "noir",
    label: "Noir Gold",
    swatch: ["#111111", "#262626", "#d8b451"],
    darkColors: {
      background: "#0b0b0b",
      surface: "#141414",
      surfaceSecondary: "#1c1c1c",
      card: "#171717",
      button: "#222222",
      buttonPressed: "#2f2f2f",
      buttonBorder: "#3a3a3a",
      primary: "#e0bc5c",
      secondary: "#9c9c9c",
      textPrimary: "#f5f5f5",
      textSecondary: "#a8a8a8",
      icon: "#ececec",
      danger: "#ff5a5a",
      divider: "#2a2a2a",
      inputBackground: "#1c1c1c",
      inputText: "#f5f5f5",
      shadow: "rgba(0,0,0,0.75)",
    },
    lightColors: {
      background: "#f7f6f3",
      surface: "#ffffff",
      surfaceSecondary: "#efede8",
      card: "#ffffff",
      button: "#eceae4",
      buttonPressed: "#dcd9d0",
      buttonBorder: "#cbc7bc",
      primary: "#8a6a12",
      secondary: "#6a655a",
      textPrimary: "#161513",
      textSecondary: "#5d5952",
      icon: "#1f1d19",
      danger: "#bc2430",
      divider: "#e0ddd5",
      inputBackground: "#ffffff",
      inputText: "#161513",
      shadow: "rgba(22,21,19,0.16)",
    },
  },
];

/* ------------------------------------------------------------------ */
/* Contrast safety                                                     */
/* ------------------------------------------------------------------ */

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white — whichever is readable on the given background. */
export function readableOn(background: string): string {
  return contrast("#ffffff", background) >= contrast("#111111", background) ? "#ffffff" : "#111111";
}

/**
 * Guarantees no invisible text or icons: every foreground token is checked
 * against every surface it can sit on and replaced with a readable fallback
 * when it fails WCAG AA.
 */
export function ensureContrast(tokens: ThemeTokens): ThemeTokens {
  const surfaces = [
    tokens.background,
    tokens.surface,
    tokens.surfaceSecondary,
    tokens.card,
    tokens.button,
    tokens.buttonPressed,
    tokens.inputBackground,
  ];
  const worst = (color: string) => Math.min(...surfaces.map((s) => contrast(color, s)));
  const fallback = readableOn(tokens.background);

  const safe: ThemeTokens = { ...tokens };
  if (worst(safe.textPrimary) < 4.5) safe.textPrimary = fallback;
  if (worst(safe.icon) < 3) safe.icon = fallback;
  if (worst(safe.inputText) < 4.5) safe.inputText = readableOn(tokens.inputBackground);
  if (worst(safe.textSecondary) < 3.2) {
    safe.textSecondary = fallback === "#ffffff" ? "#c3c8d1" : "#4b5260";
  }
  if (contrast(safe.divider, tokens.background) < 1.25) {
    safe.divider = fallback === "#ffffff" ? "#4a4f58" : "#b9bfc9";
  }
  if (contrast(safe.buttonBorder, tokens.button) < 1.25) {
    safe.buttonBorder = fallback === "#ffffff" ? "#565c66" : "#b3b9c4";
  }
  return safe;
}

export function tokensFor(skin: Skin, appearance: Appearance): ThemeTokens {
  const theme = THEMES.find((t) => t.name === skin) ?? THEMES[0]!;
  return ensureContrast(appearance === "light" ? theme.lightColors : theme.darkColors);
}

/** Writes the palette to <html> so the entire tree (incl. portals) re-themes. */
export function applyTheme(skin: Skin, appearance: Appearance, keyStyle: KeyStyle): void {
  if (typeof document === "undefined") return;
  const t = tokensFor(skin, appearance);
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  // Raw theme tokens (available as var(--t-*) anywhere).
  (Object.keys(t) as (keyof ThemeTokens)[]).forEach((key) =>
    set(`--t-${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`, t[key]),
  );

  const onPrimary = readableOn(t.primary);
  const onDanger = readableOn(t.danger);

  set("--background", t.background);
  set("--foreground", t.textPrimary);
  set("--card", t.card);
  set("--card-foreground", t.textPrimary);
  set("--popover", t.surface);
  set("--popover-foreground", t.textPrimary);
  set("--primary", t.primary);
  set("--primary-foreground", onPrimary);
  set("--secondary", t.surfaceSecondary);
  set("--secondary-foreground", t.textPrimary);
  set("--muted", t.surfaceSecondary);
  set("--muted-foreground", t.textSecondary);
  set("--accent", t.buttonPressed);
  set("--accent-foreground", t.textPrimary);
  set("--destructive", t.danger);
  set("--destructive-foreground", onDanger);
  set("--border", t.divider);
  set("--input", t.inputBackground);
  set("--ring", t.primary);

  set("--shell", t.surface);
  set("--key", t.button);
  set("--key-pressed", t.buttonPressed);
  set("--key-foreground", t.textPrimary);
  set("--key-edge", t.buttonBorder);
  set("--icon", t.icon);
  set("--signal", t.primary);
  set("--signal-foreground", onPrimary);
  set("--live", t.primary);
  set("--live-foreground", onPrimary);
  set("--shadow-color", t.shadow);

  root.classList.toggle("dark", appearance === "dark");
  root.classList.toggle("light", appearance === "light");
  root.dataset["keystyle"] = keyStyle;
  root.dataset["skin"] = skin;
  root.style.colorScheme = appearance;
  document.body.style.backgroundColor = t.background;
  // Inline styles win over stylesheets, so the body text colour must be set here
  // too — otherwise a bootstrap inline colour keeps light mode unreadable.
  document.body.style.color = t.textPrimary;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.background);
}
