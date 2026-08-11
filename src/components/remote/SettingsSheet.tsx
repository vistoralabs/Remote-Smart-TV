import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SettingsPanel } from "@/components/remote/SettingsPanel";
import type { StringKey } from "@/lib/i18n";
import type { Settings } from "@/lib/settings";

export function SettingsSheet({
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
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="secondary" aria-label={t("settings")} className="rounded-full">
          <Settings2 className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border bg-popover px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-popover-foreground"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">{t("settings")}</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Colours, button styles, pad layout, language and feedback.
          </SheetDescription>
        </SheetHeader>
        <div className="pb-6">
          <SettingsPanel
            settings={settings}
            onChange={onChange}
            appName={appName}
            version={version}
            t={t}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
