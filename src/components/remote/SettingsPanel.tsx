import {
  Check,
  Info,
  Languages,
  Moon,
  Palette,
  Sparkles,
  SquareMousePointer,
  Star,
  Sun,
  Vibrate,
  Volume2,
} from "lucide-react";
import { openStoreListing } from "@/lib/native-review";
import { ThemePreview } from "@/components/remote/ThemePreview";
import { toast } from "sonner";
import { previewHaptics, previewSound } from "@/lib/feedback";
import { LANGUAGES, type StringKey } from "@/lib/i18n";
import { KEY_STYLES, PAD_THEMES, SKINS, type Settings } from "@/lib/settings";
import { HelpSection } from "@/components/remote/HelpSection";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function SettingsPanel({
  settings,
  onChange,
  appName,
  version,
  t,
}: {
  settings: Settings;
  onChange: (next: Partial<Settings>) => void;
  appName: string;
  version: string;
  t: (key: StringKey) => string;
}) {
  return (
    <section className="flex flex-col gap-6 text-foreground">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          {settings.appearance === "dark" ? (
            <Moon className="size-4 text-primary" />
          ) : (
            <Sun className="size-4 text-primary" />
          )}
          {t("appearance")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={t("appearance")}>
          <Button
            type="button"
            variant={settings.appearance === "light" ? "default" : "secondary"}
            onClick={() => onChange({ appearance: "light" })}
            className="h-12 justify-start gap-2 rounded-lg"
          >
            <Sun className="size-4" /> {t("light")}
          </Button>
          <Button
            type="button"
            variant={settings.appearance === "dark" ? "default" : "secondary"}
            onClick={() => onChange({ appearance: "dark" })}
            className="h-12 justify-start gap-2 rounded-lg"
          >
            <Moon className="size-4" /> {t("dark")}
          </Button>
        </div>
      </div>

      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Palette className="size-4 text-primary" />
          {t("colourTheme")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {SKINS.map((skin) => (
            <button
              key={skin.value}
              type="button"
              onClick={() => onChange({ skin: skin.value })}
              className={`glass-panel flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-left text-foreground transition-colors ${
                settings.skin === skin.value
                  ? "border-primary ring-2 ring-primary/60"
                  : "border-border"
              }`}
            >
              <ThemePreview skin={skin.value} appearance={settings.appearance} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-medium">{skin.label}</span>
                  {settings.skin === skin.value ? (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  ) : null}
                </span>
                <span className="mt-1.5 flex overflow-hidden rounded-full border border-border/60">
                  {skin.swatch.map((color) => (
                    <span key={color} className="h-3 flex-1" style={{ backgroundColor: color }} />
                  ))}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>


      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <SquareMousePointer className="size-4 text-primary" />
          {t("buttonStyle")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {KEY_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => onChange({ keyStyle: style.value })}
              className={`glass-panel rounded-2xl px-3 py-3 text-left text-foreground transition-colors ${
                settings.keyStyle === style.value
                  ? "border-primary ring-2 ring-primary/60"
                  : "border-border"
              }`}
            >
              <span className="flex items-center justify-between text-sm font-medium">
                {t(style.labelKey as StringKey)}
                {settings.keyStyle === style.value ? (
                  <Check className="size-4 text-primary" />
                ) : null}
              </span>
              <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">
                {t(style.hintKey as StringKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          {t("padStyle")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {PAD_THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              onClick={() => onChange({ theme: theme.value })}
              className={`glass-panel rounded-2xl border px-3 py-3 text-left text-foreground transition-colors ${
                settings.theme === theme.value ? "border-primary/60" : "border-border/60"
              }`}
            >
              <span className="flex items-center justify-between text-sm font-medium">
                {t(theme.labelKey as StringKey)}
                {settings.theme === theme.value ? <Check className="size-4 text-primary" /> : null}
              </span>
              <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">
                {t(theme.hintKey as StringKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel divide-y divide-border rounded-2xl">
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Vibrate className="size-4 text-muted-foreground" />
            {t("haptics")}
          </span>
          <Switch
            checked={settings.haptics}
            onCheckedChange={(checked) => {
              onChange({ haptics: checked });
              if (checked) previewHaptics();
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Volume2 className="size-4 text-muted-foreground" />
            {t("keySound")}
          </span>
          <Switch
            checked={settings.sound}
            onCheckedChange={(checked) => {
              onChange({ sound: checked });
              if (checked) previewSound();
            }}
          />
        </label>
      </div>

      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Languages className="size-4 text-primary" />
          {t("language")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => onChange({ lang: lang.value })}
              className={`glass-panel flex items-center justify-between rounded-2xl border px-3 py-2.5 text-sm text-foreground ${
                settings.lang === lang.value ? "border-primary/60" : "border-border/60"
              }`}
            >
              <span>{lang.native}</span>
              {settings.lang === lang.value ? <Check className="size-4 text-primary" /> : null}
            </button>
          ))}
        </div>
      </div>

      <HelpSection t={t} />

      <button
        type="button"
        onClick={() =>
          void openStoreListing().then((opened) => {
            if (!opened) toast.error(t("playStoreError"));
          })
        }
        className="glass-panel flex w-full items-center justify-between rounded-2xl border border-border/60 px-4 py-3.5 text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <Star className="size-4 text-primary" />
          {t("rateApp")}
        </span>
        <span className="text-xs font-normal text-muted-foreground">{t("playStore")}</span>
      </button>

      <div className="glass-panel rounded-2xl px-4 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Info className="size-4 text-primary" />
          {t("about")}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {appName} v{version} — {t("aboutText")}
        </p>
      </div>
    </section>
  );
}
