import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RemoteKey } from "@/components/remote/RemoteKey";
import { AcRemoteScreen } from "@/components/remote/AcRemoteScreen";
import { IR_KEY_LABEL, type IrKey } from "@/lib/ir-catalog";
import { layoutFor } from "@/lib/ir-commands";
import { codeSetFor, type SavedIrRemote } from "@/lib/ir-devices";
import { irRemoteTransport } from "@/lib/remote-controller";
import { acProfileFor } from "@/lib/ac-protocols";
import { lastIrSignal } from "@/lib/ir-remote";
import type { Translate } from "@/lib/i18n";
import { keyFeedback } from "@/lib/feedback";
import { cn } from "@/lib/utils";

/** Complete IR remote for a saved appliance — only supported keys are shown. */
export function IrRemoteScreen({
  remote,
  t,
  haptics,
  sound,
  onClose,
  onUsage,
}: {
  remote: SavedIrRemote;
  t: Translate;
  haptics: boolean;
  sound: boolean;
  onClose: () => void;
  onUsage?: () => void;
}) {
  const set = useMemo(() => codeSetFor(remote), [remote]);
  const transport = useMemo(() => irRemoteTransport(remote), [remote]);
  const sections = useMemo(() => (set ? layoutFor(remote.kind, set) : []), [remote.kind, set]);
  const acProfile = useMemo(
    () => (remote.kind === "ac" ? acProfileFor(remote.brand) : null),
    [remote.brand, remote.kind],
  );
  const [status, setStatus] = useState("");
  // A very small code set would otherwise leave most of the screen empty.
  const sparse = sections.reduce((total, section) => total + section.keys.length, 0) <= 8;



  const fire = useCallback(
    async (key: IrKey) => {
      keyFeedback({ haptics, sound });
      const result = await transport.send(key);
      const signal = lastIrSignal();
      setStatus(
        signal
          ? `${signal.command} · ${signal.frequency} Hz · ${signal.items} · ${signal.ok ? "SUCCESS" : "FAILED"}`
          : result.message,
      );
      if (!result.ok) {
        toast.error(t("irSendFailed"), {
          action: { label: t("retry"), onClick: () => void fire(key) },
        });
      }
      onUsage?.();
    },
    [haptics, onUsage, sound, t, transport],
  );

  // Air conditioners are stateful: when the brand has a real frame builder we
  // show the full AC remote instead of a grid of single-shot codes.
  if (acProfile) {
    return (
      <AcRemoteScreen
        remote={remote}
        profile={acProfile}
        t={t}
        haptics={haptics}
        sound={sound}
        onClose={onClose}
        {...(onUsage ? { onUsage } : {})}
      />
    );
  }

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
            <Radio className="size-3" /> {t("irReady")} · {remote.brand} · {remote.setLabel}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
        {sections.map((section, index) => (
          <section key={`${section.title}-${index}`}>
            {section.title ? (
              <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </h2>
            ) : null}
            <div
              className={cn(
                "grid gap-2",
                section.cols === 2 && "grid-cols-2",
                section.cols === 3 && "grid-cols-3",
                section.cols === 4 && "grid-cols-4",
              )}
            >
              {section.keys.map((key) => (
                <RemoteKey
                  key={key}
                  ariaLabel={IR_KEY_LABEL[key]}
                  label={IR_KEY_LABEL[key]}
                  onPress={() => void fire(key)}
                  tone={
                    key === "power" || key === "poweroff"
                      ? "destructive"
                      : key === "ok"
                        ? "primary"
                        : "default"
                  }
                  className={sparse ? "h-20" : section.large ? "h-16" : "h-14"}
                />
              ))}
            </div>
          </section>
        ))}
        {sections.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("tryAnotherCode")}</p>
        ) : null}
      </div>

      {status ? (
        <p className="shrink-0 truncate text-center text-[10px] text-muted-foreground">{status}</p>
      ) : null}
    </main>
  );
}
