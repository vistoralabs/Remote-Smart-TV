import { useState } from "react";
import { Bluetooth, Radio, Layers, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import type { StringKey } from "@/lib/i18n";
import { showInterstitialAtBreak } from "@/lib/native-ads";

const SLIDES = [
  {
    icon: Radio,
    title: "IR blaster, fully offline",
    body: "Phones with an infrared emitter drive Samsung, LG, Sony, Hisense and TCL sets without any network.",
  },
  {
    icon: Wifi,
    title: "Control over Wi-Fi",
    body: "Your TV and phone on the same Wi-Fi is all it takes — tap Search your TV to begin.",
  },
  {
    icon: Bluetooth,
    title: "Connected over Bluetooth",
    body: "Pair and control supported TVs, soundbars and accessories with ease.",
  },
  {
    icon: Layers,
    title: "All your remotes in one place",
    body: "TV, AC, Fan, Soundbar — everything you need, in your pocket.",
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
    <div className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-background px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-6 text-center">
        {/* Responsive Logo Branding Header */}
        <div className="relative mb-8 flex flex-col items-center">
          <div className="absolute -inset-2 rounded-3xl bg-primary/10 blur-xl" />
          <img
            src={logo}
            alt={`${appName} logo`}
            width={88}
            height={88}
            className="relative size-20 rounded-2xl shadow-xl border border-border/40 object-cover sm:size-24"
          />
        </div>

        {/* Feature Feature Icon Badge */}
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-inner sm:size-20">
          <Icon className="size-8 text-primary sm:size-10" />
        </div>

        {/* Title & Body */}
        <div className="px-2">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {slide.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground sm:text-base">
            {slide.body}
          </p>
        </div>
      </div>

      {/* Responsive Bottom Navigation Section */}
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-4">
        {/* Step Indicator Dots */}
        <div className="flex justify-center items-center gap-2">
          {SLIDES.map((item, index) => (
            <span
              key={item.title}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === step ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Skip & Next / Get Started Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            className="h-12 flex-1 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition-all"
            onClick={() => {
              void showInterstitialAtBreak();
              onDone();
            }}
          >
            {t("skip")}
          </Button>
          <Button
            className="h-12 flex-[1.4] rounded-2xl text-sm font-bold bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
            onClick={() => {
              void showInterstitialAtBreak();
              if (last) onDone();
              else setStep((value) => value + 1);
            }}
          >
            {last ? "Get Started" : t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
