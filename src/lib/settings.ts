import { THEMES } from "./theme";

export type PadTheme = "classic" | "cross" | "touch" | "compact";
export type Appearance = "dark" | "light";
/** Five premium visual systems — nothing else is offered. */
export type Skin = "midnight" | "ocean" | "graphite" | "mint" | "noir";

export type KeyStyle = "soft" | "glass" | "flat" | "neon";
export type Lang = "en" | "hi" | "es" | "fr" | "pt" | "ar" | "bn" | "fa";

export interface Settings {
  theme: PadTheme;
  appearance: Appearance;
  skin: Skin;
  keyStyle: KeyStyle;
  haptics: boolean;
  sound: boolean;
  lang: Lang;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "classic",
  appearance: "dark",
  skin: "graphite",
  keyStyle: "soft",
  haptics: true,
  sound: false,
  lang: "en",
  onboarded: false,
};

export const PAD_THEMES: {
  value: PadTheme;
  label: string;
  hint: string;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    value: "classic",
    label: "Classic ring",
    hint: "Round D-pad with centre OK",
    labelKey: "padClassic",
    hintKey: "padClassicHint",
  },
  {
    value: "cross",
    label: "Cross pad",
    hint: "Squared directional cross",
    labelKey: "padCross",
    hintKey: "padCrossHint",
  },
  {
    value: "touch",
    label: "Touch pad",
    hint: "Swipe to navigate, tap to select",
    labelKey: "padTouch",
    hintKey: "padTouchHint",
  },
  {
    value: "compact",
    label: "Compact",
    hint: "Tight grid for one-hand use",
    labelKey: "padCompact",
    hintKey: "padCompactHint",
  },
];

/** Single source of truth lives in ThemeManager (src/lib/theme.ts). */
export const SKINS: { value: Skin; label: string; swatch: string[] }[] = THEMES.map((theme) => ({
  value: theme.name,
  label: theme.label,
  swatch: theme.swatch,
}));

export const KEY_STYLES: {
  value: KeyStyle;
  label: string;
  hint: string;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    value: "soft",
    label: "Soft raised",
    hint: "Rounded hardware keys",
    labelKey: "styleSoft",
    hintKey: "styleSoftHint",
  },
  {
    value: "glass",
    label: "Glass",
    hint: "Frosted translucent keys",
    labelKey: "styleGlass",
    hintKey: "styleGlassHint",
  },
  {
    value: "flat",
    label: "Flat",
    hint: "Minimal, no shadows",
    labelKey: "styleFlat",
    hintKey: "styleFlatHint",
  },
  {
    value: "neon",
    label: "Neon glow",
    hint: "Accent-lit outlines",
    labelKey: "styleNeon",
    hintKey: "styleNeonHint",
  },
];

const KEY = "smarttv.settings.v1";

const VALID_SKINS = new Set<string>(["midnight", "ocean", "graphite", "mint", "noir"]);

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const stored = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    // Themes removed in this release fall back to the default premium skin.
    if (!VALID_SKINS.has(stored.skin)) stored.skin = DEFAULT_SETTINGS.skin;
    return stored;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}
