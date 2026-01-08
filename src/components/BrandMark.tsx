import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Mascot */}
      <div
        className="h-10 w-10 shrink-0 rounded-2xl overflow-hidden flex items-center justify-center"
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(18px)",
        }}
      >
        <img
          src="/brand/mascot.png"
          alt="Battle Nerds mascot"
          className="h-full w-full object-cover select-none"
          style={{
            filter:
              "drop-shadow(0 0 12px hsl(var(--bn-secondary) / 0.25)) drop-shadow(0 0 18px rgba(0,0,0,0.45))",
          }}
          draggable={false}
        />
      </div>

      {/* Brand text (image) */}
      <div className="h-7 w-[160px] sm:w-[180px] overflow-hidden">
        <img
          src="/brand/battle-nerds-text.png"
          alt="Battle Nerds"
          className="h-full w-full object-cover select-none"
          style={{
            filter:
              "drop-shadow(0 0 14px rgba(0,0,0,0.65)) drop-shadow(0 0 20px hsl(var(--bn-secondary) / 0.18))",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

