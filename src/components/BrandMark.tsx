import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-0", className)}>
      {/* Mascot */}
      <img
        src="/brand/mascot.png"
        alt="Battle Nerds mascot"
        className="h-[120px] sm:h-[160px] w-auto shrink-0 object-contain select-none"
        style={{
          filter:
            "drop-shadow(0 0 22px hsl(var(--bn-secondary) / 0.35)) drop-shadow(0 0 28px rgba(0,0,0,0.55))",
        }}
        draggable={false}
      />

      {/* Brand text (image) */}
      <img
        src="/brand/battle-nerds-text.png"
        alt="Battle Nerds"
        className="h-10 w-auto object-contain select-none -ml-1 sm:-ml-2"
        style={{
          filter:
            // Soft outline + depth so the dark “Battle” letters remain readable on dark/blue backgrounds
            "drop-shadow(0 0 3px rgba(255,255,255,0.30)) drop-shadow(0 0 18px rgba(0,0,0,0.70)) drop-shadow(0 0 26px hsl(var(--bn-secondary) / 0.18))",
        }}
        draggable={false}
      />
    </div>
  );
}

