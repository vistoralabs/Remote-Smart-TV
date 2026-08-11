import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Power, Radio, Minus, Plus, Wind, Snowflake, Zap, Leaf } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SavedIrRemote } from "@/lib/ir-devices";
import { IRRemoteEngine } from "@/lib/ir-engine";
import {
  AC_FAN_LABEL,
  AC_MODE_LABEL,
  clampTemp,
  type AcFan,
  type AcMode,
  type AcProfile,
  type AcState,
} from "@/lib/ac-protocols";
import { loadAcState, saveAcState } from "@/lib/ac-state";
import { lastIrSignal } from "@/lib/ir-remote";
import { keyFeedback } from "@/lib/feedback";
import type { Translate } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Full air-conditioner remote.
 *
 * Every control mutates the in-memory state and re-transmits the complete IR
 * frame for the selected profile — an AC never accepts single-button pulses.
 */
export function AcRemoteScreen({
  remote,
  profile,
  t,
  haptics,
  sound,
  onClose,
  onUsage,
}: {
  remote: SavedIrRemote;
  profile: AcProfile;
  t: Translate;
  haptics: boolean;
  sound: boolean;
  onClose: () => void;
  onUsage?: () => void;
}) {
  const caps = profile.capabilities;
  const [state, setState] = useState<AcState>(() => loadAcState(remote.id, profile));
  const [status, setStatus] = useState("");

  useEffect(() => {
    saveAcState(remote.id, state);
  }, [remote.id, state]);

  const push = useCallback(
    async (next: AcState, command: string) => {
      keyFeedback({ haptics, sound });
      const clamped = clampTemp(next, caps);
      setState(clamped);
      const result = await IRRemoteEngine.sendAcState(remote, profile, clamped, command);
      const signal = lastIrSignal();
      setStatus(
        signal
          ? `${command} · ${signal.frequency} Hz · ${signal.items} · ${signal.ok ? "SUCCESS" : "FAILED"}`
          : result.message,
      );
      if (!result.ok) {
        toast.error(t("irSendFailed"), {
          action: { label: t("retry"), onClick: () => void push(clamped, command) },
        });
      }
      onUsage?.();
    },
    [caps, haptics, onUsage, profile, remote, sound, t],
  );

  const pill = (active: boolean) =>
    cn(
      "min-h-12 flex-1 rounded-xl border px-3 text-sm font-semibold transition-colors",
      active
        ? "border-primary/70 bg-primary/15 text-primary"
        : "border-border/60 bg-card/60 text-muted-foreground",
    );

  const toggles: { key: keyof AcState; label: string; icon: typeof Wind; enabled: boolean }[] = [
    { key: "swing", label: "Swing", icon: Wind, enabled: caps.swing },
    { key: "turbo", label: "Turbo", icon: Zap, enabled: caps.turbo },
    { key: "eco", label: "Eco", icon: Leaf, enabled: caps.eco },
  ];

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          aria-label={t("back")}
          className="size-10 shrink-0 rounded-full"
          onClick={onClose}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold leading-tight">{remote.name}</h1>
          <p className="flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Radio className="size-3" /> {t("irReady")} · {remote.brand} · {profile.label}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-1">
        {/* Status card */}
        <section className="glass-panel rounded-3xl border border-border/60 px-5 py-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-display text-5xl font-bold leading-none">
                {state.power ? `${state.temperature}°C` : "OFF"}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {AC_MODE_LABEL[state.mode]} · {AC_FAN_LABEL[state.fan]} FAN
                {state.swing ? " · SWING" : ""}
              </p>
            </div>
            <Snowflake className={cn("size-8", state.power ? "text-primary" : "text-muted-foreground")} />
          </div>
        </section>

        <Button
          variant={state.power ? "destructive" : "default"}
          className="h-16 w-full rounded-2xl text-base font-semibold"
          onClick={() => void push({ ...state, power: !state.power }, state.power ? "AC_POWER_OFF" : "AC_POWER_ON")}
        >
          <Power className="mr-2 size-5" /> {state.power ? "Turn off" : "Turn on"}
        </Button>

        {/* Temperature */}
        <section>
          <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Temperature
          </h2>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Button
              variant="secondary"
              className="h-16 rounded-2xl"
              aria-label="Temperature down"
              onClick={() => void push({ ...state, temperature: state.temperature - 1 }, "AC_TEMP_DOWN")}
            >
              <Minus className="size-6" />
            </Button>
            <p className="min-w-20 text-center font-display text-3xl font-bold">{state.temperature}°C</p>
            <Button
              variant="secondary"
              className="h-16 rounded-2xl"
              aria-label="Temperature up"
              onClick={() => void push({ ...state, temperature: state.temperature + 1 }, "AC_TEMP_UP")}
            >
              <Plus className="size-6" />
            </Button>
          </div>
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            {caps.minTemp}–{caps.maxTemp}°C supported by this profile
          </p>
        </section>

        {/* Mode */}
        <section>
          <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Mode
          </h2>
          <div className="flex flex-wrap gap-2">
            {caps.modes.map((mode: AcMode) => (
              <button
                key={mode}
                type="button"
                className={pill(state.mode === mode)}
                onClick={() => void push({ ...state, mode }, `AC_MODE_${mode.toUpperCase()}`)}
              >
                {AC_MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        </section>

        {/* Fan */}
        <section>
          <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Fan speed
          </h2>
          <div className="flex flex-wrap gap-2">
            {caps.fans.map((fan: AcFan) => (
              <button
                key={fan}
                type="button"
                className={pill(state.fan === fan)}
                onClick={() => void push({ ...state, fan }, `AC_FAN_${fan.toUpperCase()}`)}
              >
                {AC_FAN_LABEL[fan]}
              </button>
            ))}
          </div>
        </section>

        {/* Toggles */}
        <section>
          <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Comfort
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {toggles
              .filter((item) => item.enabled)
              .map((item) => {
                const active = Boolean(state[item.key]);
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(pill(active), "flex h-14 flex-col items-center justify-center gap-1")}
                    onClick={() =>
                      void push(
                        { ...state, [item.key]: !active } as AcState,
                        `AC_${item.label.toUpperCase()}_${active ? "OFF" : "ON"}`,
                      )
                    }
                  >
                    <Icon className="size-4" />
                    <span className="text-[11px]">{item.label}</span>
                  </button>
                );
              })}
          </div>
        </section>
      </div>

      {status ? (
        <p className="shrink-0 truncate text-center text-[10px] text-muted-foreground">{status}</p>
      ) : null}
    </main>
  );
}
