import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
      {/* Mascot */}
      <img
        src="/brand/mascot.png"
        alt="Battle Nerds mascot"
        className="h-[84px] w-[84px] sm:h-[128px] sm:w-[128px] shrink-0 object-cover select-none"
        style={{
          // Crop the tall portrait so the mascot fills the visible area (no huge empty background).
          objectPosition: "center 46%",
          filter:
            "drop-shadow(0 0 22px hsl(var(--bn-secondary) / 0.35)) drop-shadow(0 0 28px rgba(0,0,0,0.55))",
        }}
        draggable={false}
      />

      {/* Brand text (image) */}
      <div className="relative h-7 sm:h-8 w-[220px] sm:w-[260px] overflow-hidden">
        <img
          src="/brand/battle-nerds-text.png"
          alt="Battle Nerds"
          className="relative h-full w-full object-cover select-none"
          style={{
            // This PNG is very tall; crop to keep the actual text in view (avoid the “blank bar”).
            objectPosition: "center 62%",
            filter:
              // Soft outline + depth so the dark “Battle” letters remain readable on dark/blue backgrounds
              "drop-shadow(0 0 3px rgba(255,255,255,0.30)) drop-shadow(0 0 18px rgba(0,0,0,0.70)) drop-shadow(0 0 26px hsl(var(--bn-secondary) / 0.18))",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

