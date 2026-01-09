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
        className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 object-contain select-none"
        style={{
          filter:
            "drop-shadow(0 0 22px hsl(var(--bn-secondary) / 0.35)) drop-shadow(0 0 28px rgba(0,0,0,0.55))",
        }}
        draggable={false}
      />

      {/* Brand text (image) */}
      <div className="relative h-7 sm:h-8 w-[220px] sm:w-[260px] overflow-hidden">
        {/* Contrast glow behind the darker “Battle” side (no image edits) */}
        <div
          className="absolute -inset-y-3 -inset-x-4 rounded-2xl pointer-events-none"
          style={{
            background: [
              // Lift the left side (Battle) so it doesn't camouflage into the background
              "radial-gradient(260px 90px at 22% 50%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.10) 45%, transparent 72%)",
              // Brand sky glow for the right side (Nerds), kept subtle
              "radial-gradient(300px 100px at 78% 50%, hsl(var(--bn-secondary) / 0.18) 0%, transparent 68%)",
            ].join(","),
            filter: "blur(12px)",
          }}
          aria-hidden="true"
        />
        <img
          src="/brand/battle-nerds-text.png"
          alt="Battle Nerds"
          className="relative h-full w-full object-cover select-none"
          style={{
            // This PNG is very tall; cover + positioned crop keeps the actual text tight next to the mascot.
            objectPosition: "left 76%",
            filter:
              // Soft outline + depth so the dark “Battle” letters remain readable on dark/blue backgrounds
              "drop-shadow(0 0 2px rgba(255,255,255,0.22)) drop-shadow(0 0 16px rgba(0,0,0,0.55)) drop-shadow(0 0 22px hsl(var(--bn-secondary) / 0.16))",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

