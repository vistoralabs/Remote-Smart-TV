import { tokensFor } from "@/lib/theme";
import type { Appearance, Skin } from "@/lib/settings";

/**
 * Miniature remote drawn with a theme's real tokens, so a theme card shows
 * exactly how the pad, OK key and text will look before it is applied.
 */
export function ThemePreview({
  skin,
  appearance,
}: {
  skin: Skin;
  appearance: Appearance;
}) {
  const t = tokensFor(skin, appearance);
  const key = {
    backgroundColor: t.button,
    borderColor: t.buttonBorder,
    color: t.icon,
  };
  return (
    <span
      aria-hidden="true"
      className="flex h-16 w-12 shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5"
      style={{ backgroundColor: t.surface, borderColor: t.divider }}
    >
      <span
        className="h-2 w-full rounded-sm"
        style={{ backgroundColor: t.surfaceSecondary, color: t.textSecondary }}
      />
      <span className="grid grid-cols-3 gap-[2px]">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => {
          const centre = cell === 4;
          const arrow = cell === 1 || cell === 3 || cell === 5 || cell === 7;
          if (!centre && !arrow) return <span key={cell} className="size-[9px]" />;
          return (
            <span
              key={cell}
              className="size-[9px] rounded-full border"
              style={
                centre
                  ? { backgroundColor: t.primary, borderColor: t.primary }
                  : key
              }
            />
          );
        })}
      </span>
      <span className="flex w-full gap-[2px]">
        <span className="h-2 flex-1 rounded-sm border" style={key} />
        <span
          className="h-2 flex-1 rounded-sm border"
          style={{ backgroundColor: t.danger, borderColor: t.danger }}
        />
      </span>
    </span>
  );
}
