import { CircleHelp, LifeBuoy } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { StringKey, Translate } from "@/lib/i18n";

const TOPICS: { q: StringKey; a: StringKey }[] = [
  { q: "helpConnectAtv", a: "helpConnectAtvBody" },
  { q: "helpConnectXstream", a: "helpConnectXstreamBody" },
  { q: "helpIrSetup", a: "helpIrSetupBody" },
  { q: "helpCodeSet", a: "helpCodeSetBody" },
  { q: "helpNotWorking", a: "helpNotWorkingBody" },
  { q: "helpIrCompat", a: "helpIrCompatBody" },
];

/** Settings → Help: setup guides, troubleshooting and support. */
export function HelpSection({ t }: { t: Translate }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <CircleHelp className="size-4 text-primary" />
        {t("help")}
      </h2>
      <Accordion type="single" collapsible className="mt-2">
        {TOPICS.map((topic) => (
          <AccordionItem key={topic.q} value={topic.q}>
            <AccordionTrigger className="py-3 text-left text-sm">{t(topic.q)}</AccordionTrigger>
            <AccordionContent className="text-xs leading-relaxed text-muted-foreground">
              {t(topic.a)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <a
        href="mailto:support@smarttvremote.app?subject=Smart%20Android%20TV%20Remote%20support"
        className="glass-panel mt-3 flex min-h-12 items-center gap-2 rounded-2xl border border-border/60 px-4 py-3 text-sm font-medium"
      >
        <LifeBuoy className="size-4 text-primary" />
        {t("helpSupport")}
      </a>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {t("helpDiagnostics")} — {t("diagnostics")}.
      </p>
    </div>
  );
}
