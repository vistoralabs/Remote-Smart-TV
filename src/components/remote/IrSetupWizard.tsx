import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Radio, Search, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APPLIANCES, keysFor, type ApplianceKind, type CodeSet } from "@/lib/ir-catalog";
import { powerKey } from "@/lib/ir-commands";
import { buildIrRemote, saveIrRemote, type SavedIrRemote } from "@/lib/ir-devices";
import { irCarrierRanges, irEmitterAvailable, sendIrKey, type IrCarrierRange } from "@/lib/ir-remote";
import type { StringKey, Translate } from "@/lib/i18n";
import { keyFeedback } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const APPLIANCE_KEY: Record<ApplianceKind, StringKey> = {
  tv: "kindTv",
  stb: "kindStb",
  ac: "kindAc",
  audio: "kindAudio",
  dvd: "kindDvd",
  projector: "kindProjector",
  fan: "kindFan",
};

type Step = "hardware" | "kind" | "brand" | "code" | "save";

export function IrSetupWizard({
  t,
  haptics,
  sound,
  onSaved,
  onCancel,
}: {
  t: Translate;
  haptics: boolean;
  sound: boolean;
  onSaved: (remote: SavedIrRemote) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>("hardware");
  const [emitter, setEmitter] = useState<{ available: boolean; device: string } | null>(null);
  const [ranges, setRanges] = useState<IrCarrierRange[]>([]);
  const [kind, setKind] = useState<ApplianceKind>("tv");
  const [brandName, setBrandName] = useState("");
  const [setIndex, setSetIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [tested, setTested] = useState(false);
  const [auto, setAuto] = useState<{ running: boolean; index: number; total: number }>({
    running: false,
    index: 0,
    total: 0,
  });
  const autoList = useRef<{ brand: string; index: number; set: CodeSet }[]>([]);

  useEffect(() => {
    void irEmitterAvailable().then(setEmitter);
    void irCarrierRanges().then(setRanges);
  }, []);

  const appliance = useMemo(
    () => APPLIANCES.find((item) => item.kind === kind) ?? APPLIANCES[0]!,
    [kind],
  );
  const brands = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? appliance.brands.filter((item) => item.name.toLowerCase().includes(term))
      : appliance.brands;
  }, [appliance, query]);
  const brand = useMemo(
    () => appliance.brands.find((item) => item.name === brandName) ?? null,
    [appliance, brandName],
  );
  const codeSet: CodeSet | null = brand?.sets[Math.min(setIndex, brand.sets.length - 1)] ?? null;

  const testPower = useCallback(
    async (target?: CodeSet, targetBrand?: string) => {
      const set = target ?? codeSet;
      if (!set) return;
      const key = powerKey(set);
      if (!key) {
        toast.error(t("irNoPowerCode"));
        return;
      }
      keyFeedback({ haptics, sound });
      const result = await sendIrKey(set, key, { brand: targetBrand ?? brandName, kind });
      setTested(true);
      if (!result.ok) toast.error(result.message);
    },
    [brandName, codeSet, haptics, kind, sound, t],
  );

  /** One candidate at a time, always waiting for the user's answer. */
  const startAuto = useCallback(() => {
    const list = appliance.brands.flatMap((item) =>
      item.sets
        .map((set, index) => ({ brand: item.name, index, set }))
        .filter(({ set }) => powerKey(set) !== null),
    );
    autoList.current = list;
    setAuto({ running: true, index: 0, total: list.length });
    const first = list[0];
    if (!first) return;
    setBrandName(first.brand);
    setSetIndex(first.index);
    setStep("code");
    void testPower(first.set, first.brand);
  }, [appliance, testPower]);

  const nextCandidate = useCallback(() => {
    if (auto.running) {
      const next = auto.index + 1;
      const candidate = autoList.current[next];
      if (!candidate) {
        setAuto({ running: false, index: 0, total: 0 });
        toast.info(t("searchDone"));
        return;
      }
      setAuto((current) => ({ ...current, index: next }));
      setBrandName(candidate.brand);
      setSetIndex(candidate.index);
      void testPower(candidate.set, candidate.brand);
      return;
    }
    if (!brand) return;
    const next = (setIndex + 1) % brand.sets.length;
    setSetIndex(next);
    void testPower(brand.sets[next]!, brand.name);
  }, [auto, brand, setIndex, t, testPower]);

  const confirm = useCallback(() => {
    if (!codeSet || !brand) return;
    setName(`${brand.name} ${t(APPLIANCE_KEY[kind])}`);
    setStep("save");
  }, [brand, codeSet, kind, t]);

  const save = useCallback(() => {
    if (!codeSet || !brand) return;
    const remote = buildIrRemote(
      name.trim() || `${brand.name} ${t(APPLIANCE_KEY[kind])}`,
      kind,
      brand.name,
      Math.min(setIndex, brand.sets.length - 1),
      codeSet,
    );
    saveIrRemote(remote);
    toast.success(t("irRemoteSaved"));
    onSaved(remote);
  }, [brand, codeSet, kind, name, onSaved, setIndex, t]);

  const header = (
    <div className="mb-3 flex items-center gap-2">
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("back")}
        className="size-9 rounded-full"
        onClick={() => {
          if (step === "hardware") onCancel();
          else if (step === "kind") setStep("hardware");
          else if (step === "brand") setStep("kind");
          else if (step === "code") setStep("brand");
          else setStep("code");
        }}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{t("irSetupTitle")}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {step === "hardware" && t("irStepHardware")}
          {step === "kind" && t("irStepKind")}
          {step === "brand" && t("irStepBrand")}
          {step === "code" && t("irStepCode")}
          {step === "save" && t("irStepSave")}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      {header}

      {step === "hardware" ? (
        <div className="flex flex-col gap-3">
          <div className="glass-panel rounded-2xl border border-border/60 px-4 py-3 text-xs leading-relaxed">
            {emitter === null ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t("irChecking")}
              </span>
            ) : emitter.available ? (
              <>
                <p className="text-sm font-semibold text-primary">{t("emitterReady")}</p>
                <p className="text-muted-foreground">{emitter.device}</p>
                {ranges.length ? (
                  <p className="text-muted-foreground">
                    {t("carrier")}: {ranges.map((r) => `${r.min}-${r.max} Hz`).join(", ")}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-destructive">{t("irNoEmitterShort")}</p>
                <p className="text-muted-foreground">{t("irNoEmitter")}</p>
              </>
            )}
          </div>
          <Button
            className="h-12 rounded-xl"
            disabled={!emitter?.available}
            onClick={() => setStep("kind")}
          >
            {t("next")}
          </Button>
        </div>
      ) : null}

      {step === "kind" ? (
        <div className="grid grid-cols-2 gap-2">
          {APPLIANCES.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => {
                setKind(item.kind);
                setBrandName("");
                setSetIndex(0);
                setQuery("");
                setStep("brand");
              }}
              className={cn(
                "glass-panel min-h-14 rounded-2xl border px-3 py-3 text-left text-sm font-medium",
                kind === item.kind ? "border-primary/60 text-primary" : "border-border/60",
              )}
            >
              {t(APPLIANCE_KEY[item.kind])}
              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                {item.brands.length} {t("brand").toLowerCase()}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {step === "brand" ? (
        <div className="flex flex-col gap-3">
          <Button variant="secondary" className="h-12 rounded-xl" onClick={startAuto}>
            <Wand2 className="mr-2 size-4" /> {t("autoSearch")}
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchBrand")}
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <div className="grid max-h-[46dvh] grid-cols-2 gap-2 overflow-y-auto pr-1">
            {brands.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setBrandName(item.name);
                  setSetIndex(0);
                  setTested(false);
                  setAuto({ running: false, index: 0, total: 0 });
                  setStep("code");
                }}
                className="glass-panel flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-left text-xs font-medium"
              >
                <span className="truncate">{item.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {item.sets.length}
                </span>
              </button>
            ))}
            {brands.length === 0 ? (
              <p className="col-span-2 py-6 text-center text-xs text-muted-foreground">
                {t("noBrandMatch")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "code" && brand && codeSet ? (
        <div className="flex flex-col gap-3">
          <div className="glass-panel rounded-2xl border border-border/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {brand.name} · {codeSet.label}
              </p>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                Remote {setIndex + 1} of {brand.sets.length}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {auto.running
                ? `${t("irTesting")} ${auto.index + 1}/${auto.total}`
                : `${keysFor(codeSet).length} ${t("irButtons")} · ${codeSet.protocol}`}
            </p>
          </div>
          {!auto.running ? (
            <div className="flex flex-wrap gap-2">
              {brand.sets.map((item, index) => (
                <button
                  key={`${item.label}-${index}`}
                  type="button"
                  onClick={() => {
                    setSetIndex(index);
                    setTested(false);
                  }}
                  className={cn(
                    "glass-panel min-h-10 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    setIndex === index ? "border-primary/60 text-primary bg-primary/10" : "border-border/60",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <Button className="h-14 rounded-xl text-base font-semibold shadow-md" onClick={() => void testPower()}>
            <Radio className="mr-2 size-5" /> {t("testPower")}
          </Button>

          {/* IR Range & Line of Sight Guidance */}
          <div className="glass-panel rounded-xl border border-border/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">💡 IR Remote Tip</p>
            <p>Recommended distance: ~1–5 meters under normal conditions. Point the top edge of your phone directly at the appliance with a clear line of sight.</p>
          </div>

          {tested ? (
            <>
              <p className="text-center text-xs font-medium text-muted-foreground">{t("irDidItWork")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-12 rounded-xl text-sm font-semibold" onClick={confirm}>
                  <Check className="mr-1.5 size-4" /> {t("irYesWorks")}
                </Button>
                <Button variant="secondary" className="h-12 rounded-xl text-sm font-medium" onClick={nextCandidate}>
                  <X className="mr-1.5 size-4" /> {t("irTryAnother")}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : step === "code" ? (
        <div className="glass-panel rounded-2xl border border-border/60 p-6 text-center text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">No usable code sets for this brand</p>
          <p className="mt-1">Please select another brand or use Auto Search.</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setStep("brand")}>
            Back to Brands
          </Button>
        </div>
      ) : null}

      {step === "save" && brand && codeSet ? (
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("irRemoteName")}
          </label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 rounded-xl"
            placeholder={t("irRemoteName")}
          />
          <div className="glass-panel rounded-2xl border border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <p>
              {t("appliance")}: {t(APPLIANCE_KEY[kind])}
            </p>
            <p>
              {t("brand")}: {brand.name}
            </p>
            <p>
              {t("codeSet")}: {codeSet.label}
              {codeSet.model ? ` · ${codeSet.model.replaceAll("_", " ")}` : ""}
            </p>
            <p>
              {t("carrier")}: {codeSet.protocol}
            </p>
          </div>
          <Button className="h-12 rounded-xl" onClick={save}>
            {t("irSaveRemote")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
