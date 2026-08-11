import { useState } from "react";
import { Bluetooth, Radio, ShieldCheck, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import type { StringKey } from "@/lib/i18n";
import { showInterstitialAtBreak } from "@/lib/native-ads";

const SLIDES = [
  {
    icon: Wifi,
    title: "Control over Wi-Fi",
    body: "Your TV and phone on the same Wi-Fi is all it takes — tap Search your TV to begin.",
  },
  {
    icon: Radio,
    title: "IR blaster, fully offline",
    body: "Phones with an infrared emitter drive Samsung, LG, Sony, Hisense and TCL sets without any network.",
  },
  {
    icon: Bluetooth,
    title: "Bluetooth boxes too",
    body: "Scan, pair and control Bluetooth set-top boxes and TV remotes straight from the app.",
  },
  {
    icon: ShieldCheck,
    title: "Everything unlocked",
    body: "No sign-up and no subscription — every remote, every key and voice search are unlocked from the first tap.",
  },
];

export function Onboarding({
  appName,
  onDone,
  t,
}: {
  appName: string;
  onDone: () => void;
  t: (key: StringKey) => string;
}) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step]!;
  const Icon = slide.icon;
  const last = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background px-6 pb-10 pt-14">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <img
          src={logo}
          alt={`${appName} logo`}
          width={96}
          height={96}
          className="size-24 rounded-3xl"
        />
        <div className="key-face flex size-16 items-center justify-center rounded-2xl border border-border/60">
          <Icon className="size-7 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">{slide.title}</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {slide.body}
          </p>
        </div>
      </div>

      <div className="flex justify-center gap-1.5 pb-6">
        {SLIDES.map((item, index) => (
          <span
            key={item.title}
            className={`h-1.5 rounded-full transition-all ${
              index === step ? "w-6 bg-primary" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => {
            void showInterstitialAtBreak();
            onDone();
          }}
        >
          {t("skip")}
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            void showInterstitialAtBreak();
            if (last) onDone();
            else setStep((value) => value + 1);
          }}
        >
          {last ? t("start") : t("next")}
        </Button>
      </div>
    </div>
  );
}
