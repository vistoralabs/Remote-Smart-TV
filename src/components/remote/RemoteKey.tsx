import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface RemoteKeyProps {
  onPress: () => void;
  label?: string;
  className?: string;
  round?: boolean;
  tone?: "default" | "primary" | "destructive";
  ariaLabel: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function RemoteKey({
  onPress,
  label,
  className,
  round,
  tone = "default",
  ariaLabel,
  disabled = false,
  children,
}: RemoteKeyProps) {
  const [active, setActive] = useState(false);

  const fire = useCallback(() => {
    if (disabled) return;
    setActive(true);
    window.setTimeout(() => setActive(false), 130);
    onPress();
  }, [disabled, onPress]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      disabled={disabled}
      onPointerDown={() => !disabled && setActive(true)}
      onPointerUp={() => setActive(false)}
      onPointerLeave={() => setActive(false)}
      onClick={fire}
      className={cn(
        "key-face flex min-h-12 min-w-12 select-none flex-col items-center justify-center gap-0.5 border text-sm font-medium text-key-foreground outline-none focus-visible:signal-ring",
        round ? "rounded-full" : "rounded-2xl",
        tone === "primary" && "key-primary",
        tone === "destructive" && "text-destructive",
        active && !disabled && "key-face-active",
        disabled && "opacity-45",
        className,
      )}
    >
      {children}
      {label ? (
        <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
      ) : null}
    </button>
  );
}
