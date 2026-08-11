import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { STREAM_APPS } from "@/lib/apps-catalog";
import { launchApp } from "@/lib/transports";
import type { Device } from "@/lib/remote-types";
import type { StringKey } from "@/lib/i18n";
import { toast } from "sonner";

export function AppsGrid({ device, t }: { device: Device | null; t: (key: StringKey) => string }) {
  const [query, setQuery] = useState("");
  const list = STREAM_APPS.filter((app) =>
    app.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="font-display text-lg font-semibold">{t("launchApps")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("launchHint")}</p>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search apps"
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {list.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={async () => {
              const result = await launchApp(device, app);
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className="key-face flex size-14 items-center justify-center rounded-2xl border border-border/60 font-display text-sm font-bold"
              style={{ color: `hsl(${app.hue})` }}
            >
              {app.short}
            </span>
            <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted-foreground">
              {app.name}
            </span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No app matches that search.</p>
      ) : null}
    </section>
  );
}
