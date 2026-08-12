import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Info,
  Menu,
  Moon,
  Pencil,
  Play,
  Plus,
  Power,
  Radio,
  Sun,
  Trash2,
  Tv,
  Volume2,
  VolumeX,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddRemoteSheet } from "@/components/remote/AddRemoteSheet";
import { IrRemoteScreen } from "@/components/remote/IrRemoteScreen";
import { PadSurface } from "@/components/remote/PadSurface";
import { RemoteKey } from "@/components/remote/RemoteKey";
import { Onboarding } from "@/components/remote/Onboarding";
import { RatingDialog } from "@/components/remote/RatingDialog";

import { VoiceKey } from "@/components/remote/VoiceKey";
import { DebugSheet } from "@/components/remote/DebugSheet";
import { SettingsSheet } from "@/components/remote/SettingsSheet";
import logo from "@/assets/logo.png";
import { TRANSPORT_LABEL, type Device, type Key, type Transport } from "@/lib/remote-types";
import { probeCapabilities, sendKey, type Capability } from "@/lib/transports";
import { isRtl, translator } from "@/lib/i18n";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useConnection } from "@/hooks/use-connection";
import { applyTheme } from "@/lib/theme";
import {
  setAdCriticalFlow,
  showInterstitialAtBreak,
  showInterstitialOnTransition,
  startAds,
} from "@/lib/native-ads";
import {
  maybeRequestReview,
  noteAdShown,
  noteCommand,
  noteConnection,
  noteSessionStart,
  shouldShowRating,
  markRatingShown,
  openStoreListing,
} from "@/lib/native-review";
import { keyFeedback } from "@/lib/feedback";
import {
  loadIrRemotes,
  removeIrRemote,
  renameIrRemote,
  type SavedIrRemote,
} from "@/lib/ir-devices";

import { APP_NAME, APP_VERSION } from "@/lib/app-info";

const STORAGE_KEY = "remote.devices.v1";
export { APP_NAME, APP_VERSION };

const TRANSPORT_ICON: Record<Transport, typeof Wifi> = {
  wifi: Wifi,
  bluetooth: Wifi,
  ir: Wifi,
};

function applyAppearance(settings: Settings) {
  applyTheme(settings.skin, settings.appearance, settings.keyStyle);
}

export function RemoteApp() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [irRemotes, setIrRemotes] = useState<SavedIrRemote[]>([]);
  const [openIr, setOpenIr] = useState<SavedIrRemote | null>(null);
  const pressCount = useRef(0);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    setCapabilities(probeCapabilities());
    setIrRemotes(loadIrRemotes());
    const storedSettings = loadSettings();
    setSettings(storedSettings);
    applyAppearance(storedSettings);
    setReady(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Device[];
        setDevices(parsed);
        setActiveId(parsed[0]?.id ?? null);
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  // AdMob: boot only full-screen formats; the approved v3.0 UI has no banner.
  useEffect(() => {
    noteSessionStart();
    void startAds();
    noteAdShown();
  }, []);

  const t = useMemo(() => translator(settings.lang), [settings.lang]);

  const updateSettings = useCallback((next: Partial<Settings>) => {
    setSettings((current) => {
      const merged = { ...current, ...next };
      saveSettings(merged);
      applyAppearance(merged);
      return merged;
    });
  }, []);

  const persist = useCallback((next: Device[]) => {
    setDevices(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const activeDevice = useMemo(
    () => devices.find((d) => d.id === activeId) ?? null,
    [devices, activeId],
  );
  const active = activeDevice;
  const { connected } = useConnection(activeDevice);

  // Discovery/pairing is never interrupted (DeviceSheet raises the critical flag);
  // a freshly linked TV is a genuine transition, so an interstitial is eligible there.
  useEffect(() => {
    void setAdCriticalFlow(false);
    noteConnection(connected);
    if (connected) {
      pressCount.current = 0;
      // A TV just linked: guaranteed full-screen ad at this transition.
      void showInterstitialOnTransition();
      noteAdShown();
    }
  }, [connected]);

  // Mid-session breaks: ask for a full-screen ad periodically. The native side
  // still enforces the cooldown and never interrupts a critical flow.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void showInterstitialAtBreak();
      noteAdShown();
    }, 90_000);
    return () => window.clearInterval(timer);
  }, []);

  const addDevice = useCallback(
    (device: Device) => {
      const next = [...devices.filter((d) => d.id !== device.id), device];
      persist(next);
      setActiveId(device.id);
      toast.success(`${device.name} added`);
    },
    [devices, persist],
  );

  const press = useCallback(
    async (key: Key) => {
      if (!connected) {
        toast.error(t("notConnectedError"));
        return;
      }
      keyFeedback({ haptics: settings.haptics, sound: settings.sound });
      const result = await sendKey(active, key);
      if (!result.ok) toast.error(result.message);
      // The command is already delivered; every 6th press is treated as a break.
      pressCount.current += 1;
      if (result.ok) {
        noteCommand();
        // Official Play In-App Review — only fires when every rule passes.
        void maybeRequestReview("remote command");
        // Custom in-app rating popup fallback
        if (shouldShowRating()) {
          setShowRating(true);
        }
      }
      if (pressCount.current >= 6) {
        pressCount.current = 0;
        void showInterstitialAtBreak();
        noteAdShown();
      }
    },
    [active, connected, settings.haptics, settings.sound, t],
  );

  const ActiveIcon = active ? TRANSPORT_ICON[active.transport] : Tv;

  if (openIr) {
    return (
      <IrRemoteScreen
        remote={openIr}
        t={t}
        haptics={settings.haptics}
        sound={settings.sound}
        onClose={() => setOpenIr(null)}
        onUsage={() => noteCommand()}
      />
    );
  }

  if (ready && !settings.onboarded) {
    return (
      <Onboarding appName={APP_NAME} t={t} onDone={() => updateSettings({ onboarded: true })} />
    );
  }

  return (
    <main
      dir={isRtl(settings.lang) ? "rtl" : "ltr"}
      className="mx-auto flex h-dvh w-full max-w-md flex-col gap-2 overflow-hidden px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={logo}
            alt={`${APP_NAME} logo`}
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-bold leading-tight">{APP_NAME}</h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
              {t("universalRemote")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <DebugSheet />
          <SettingsSheet
            settings={settings}
            onChange={updateSettings}
            appName={APP_NAME}
            version={APP_VERSION}
            t={t}
            onRateApp={() => setShowRating(true)}
          />
          <Button
            size="icon"
            variant="secondary"
            aria-label={`Switch to ${settings.appearance === "dark" ? "light" : "dark"} theme`}
            title={`Appearance: ${settings.appearance === "dark" ? "Dark" : "Light"}`}
            className="size-9 rounded-full"
            onClick={() =>
              updateSettings({ appearance: settings.appearance === "dark" ? "light" : "dark" })
            }
          >
            {settings.appearance === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
          <AddRemoteSheet
            capabilities={capabilities}
            onAddWifi={addDevice}
            onAddIr={(remote) => {
              setIrRemotes(loadIrRemotes());
              setOpenIr(remote);
            }}
            t={t}
            haptics={settings.haptics}
            sound={settings.sound}
            trigger={
              <Button
                size="icon"
                variant="secondary"
                aria-label={t("addRemote")}
                title={t("addRemote")}
                className="size-9 rounded-full"
              >
                <Plus className="size-4" />
              </Button>
            }
          />
        </div>
      </header>

      {/* Device strip */}
      <section aria-label={t("yourDevices")} className="-mx-3 shrink-0 overflow-x-auto px-3">
        <div className="flex gap-2">
          {devices.length === 0 ? (
            <div className="w-full rounded-2xl border border-dashed border-border px-3 py-2">
              <p className="text-xs font-medium">{t("noDevice")}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t("noDeviceHint")}</p>
            </div>
          ) : (
            devices.map((device) => {
              const Icon = TRANSPORT_ICON[device.transport];
              const selected = device.id === activeId;
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => setActiveId(device.id)}
                  className={cn(
                    "glass-panel flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs",
                    selected ? "border-primary/60 text-primary" : "border-border/60",
                  )}
                >
                  <Icon className="size-3.5" />
                  {device.name}
                </button>
              );
            })
          )}
        </div>
      </section>

      {irRemotes.length ? (
        <section aria-label={t("savedRemotes")} className="-mx-3 shrink-0 overflow-x-auto px-3">
          <div className="flex gap-2">
            {irRemotes.map((remote) => (
              <div
                key={remote.id}
                className="glass-panel flex shrink-0 items-center gap-2 rounded-2xl border-border/60 px-2.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => setOpenIr(remote)}
                  className="flex min-w-0 items-center gap-2 text-left"
                  aria-label={`${t("openRemote")} ${remote.name}`}
                >
                  <Radio className="size-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block max-w-28 truncate text-xs font-medium">
                      {remote.name}
                    </span>
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      IR · {t("saved")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${t("renameRemote")} ${remote.name}`}
                  className="rounded-full p-1 text-muted-foreground"
                  onClick={() => {
                    const next = window.prompt(t("irRemoteName"), remote.name);
                    if (next && next.trim()) setIrRemotes(renameIrRemote(remote.id, next.trim()));
                  }}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`${t("forgetRemote")} ${remote.name}`}
                  className="rounded-full p-1 text-muted-foreground"
                  onClick={() => setIrRemotes(removeIrRemote(remote.id))}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="glass-panel flex shrink-0 items-center justify-between gap-3 rounded-2xl px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <ActiveIcon className="size-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-foreground">
              {active ? `${active.name} · ${TRANSPORT_LABEL[active.transport]}` : t("noDevice")}
            </span>
            <span
              className={cn(
                "block text-[10px] font-semibold uppercase tracking-wider",
                connected ? "text-primary" : "text-muted-foreground",
              )}
            >
              {connected ? t("connected") : t("notConnected")}
            </span>
          </span>
        </span>
        <RemoteKey
          ariaLabel={t("power")}
          onPress={() => press("power")}
          disabled={!connected}
          round
          tone="destructive"
          className="size-10 shrink-0"
        >
          <Power className="size-4" />
        </RemoteKey>
      </div>

      <div className="flex min-h-0 flex-[3] items-center justify-center [&>*]:h-full [&>*]:max-h-full [&>*]:w-auto">
        <PadSurface theme={settings.theme} onKey={press} disabled={!connected} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
        <RemoteKey
          ariaLabel={t("back")}
          onPress={() => press("back")}
          disabled={!connected}
          className="h-full"
        >
          <ArrowLeft className="size-5" />
        </RemoteKey>
        <RemoteKey
          ariaLabel={t("home")}
          onPress={() => press("home")}
          disabled={!connected}
          className="h-full"
        >
          <Home className="size-5" />
        </RemoteKey>
        <RemoteKey
          ariaLabel={t("menu")}
          onPress={() => press("menu")}
          disabled={!connected}
          className="h-full"
        >
          <Menu className="size-5" />
        </RemoteKey>
      </div>

      <div className="grid min-h-0 flex-[2.4] grid-cols-2 gap-2">
        <div className="glass-panel flex min-h-0 flex-col gap-1 rounded-2xl p-2">
          <RemoteKey
            ariaLabel={t("volumeUp")}
            onPress={() => press("volup")}
            disabled={!connected}
            className="min-h-0 flex-1"
          >
            <Volume2 className="size-5" />
          </RemoteKey>
          <span className="shrink-0 text-center text-[9px] uppercase tracking-widest text-muted-foreground">
            {t("volume")}
          </span>
          <RemoteKey
            ariaLabel={t("volumeDown")}
            onPress={() => press("voldown")}
            disabled={!connected}
            className="min-h-0 flex-1"
          >
            <VolumeX className="size-5" />
          </RemoteKey>
        </div>
        <div className="glass-panel flex min-h-0 flex-col gap-1 rounded-2xl p-2">
          <RemoteKey
            ariaLabel={t("channelUp")}
            onPress={() => press("chup")}
            disabled={!connected}
            className="min-h-0 flex-1"
          >
            <ChevronsRight className="size-5" />
          </RemoteKey>
          <span className="shrink-0 text-center text-[9px] uppercase tracking-widest text-muted-foreground">
            {t("channel")}
          </span>
          <RemoteKey
            ariaLabel={t("channelDown")}
            onPress={() => press("chdown")}
            disabled={!connected}
            className="min-h-0 flex-1"
          >
            <ChevronsLeft className="size-5" />
          </RemoteKey>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-4 gap-2">
        <RemoteKey
          ariaLabel={t("mute")}
          onPress={() => press("mute")}
          disabled={!connected}
          className="h-full"
        >
          <VolumeX className="size-5" />
        </RemoteKey>
        <RemoteKey
          ariaLabel={t("playPause")}
          onPress={() => press("play")}
          disabled={!connected}
          className="h-full"
        >
          <Play className="size-5" />
        </RemoteKey>
        <RemoteKey
          ariaLabel={t("info")}
          onPress={() => press("info")}
          disabled={!connected}
          className="h-full"
        >
          <Info className="size-5" />
        </RemoteKey>
        <VoiceKey device={active} connected={connected} label={t("voice")} className="h-full" />
      </div>

      <RatingDialog
        open={showRating}
        onClose={() => {
          setShowRating(false);
          markRatingShown();
        }}
        onRate={(stars) => {
          if (stars >= 4) {
            void openStoreListing();
          } else {
            window.open("mailto:shivkr6083@gmail.com?subject=Smart TV Remote Feedback");
          }
          markRatingShown();
        }}
        t={t}
      />
    </main>
  );
}
