import { useMemo } from 'react';
import type { Rank } from '@/types/ranking';

export const LOBBY_PLAYER_CARD_SIZE =
  'w-[clamp(280px,40vh,360px)] max-w-[90vw] aspect-[5/7]';

interface LobbyPlayerCardProps {
  rank: Rank;
  level: number;
  points: number | null;
  username: string;
  initial: string;
  className?: string;
  isInteractive?: boolean;
  isPlaceholder?: boolean;
  onCustomize?: () => void;
  onProgression?: () => void;
}

export function LobbyPlayerCard({
  rank,
  level,
  points,
  username,
  initial,
  className,
  isInteractive = true,
  isPlaceholder = false,
  onCustomize,
  onProgression,
}: LobbyPlayerCardProps) {
  const noiseId = useMemo(
    () => `homeCardNoise-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const displayPoints =
    typeof points === 'number' && Number.isFinite(points) ? points : '--';
  const displayName = username || 'Player';
  const displayInitial = (initial || displayName?.[0] || '?').toUpperCase();

  return (
    <div className={`${LOBBY_PLAYER_CARD_SIZE} ${className ?? ''}`}>
      <div
        className={`relative h-full w-full ${isInteractive ? '' : 'pointer-events-none'} ${
          isPlaceholder ? 'opacity-85' : ''
        }`}
      >
        {/* Gradient outline wrapper (clean, premium) */}
        <div
          className="relative h-full w-full rounded-3xl p-[1px]"
          style={{
            background: rank.gradient,
            boxShadow:
              '0 22px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          {/* Matte surface */}
          <div
            className="relative h-full w-full rounded-[calc(1.5rem-1px)] overflow-hidden"
            style={{
              background: 'rgba(15, 23, 42, 0.78)',
              backdropFilter: 'blur(18px)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -18px 30px rgba(0,0,0,0.35)',
            }}
          >
            {/* Soft toon-shading (robot vibe) */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                background: [
                  'radial-gradient(500px 380px at 18% 20%, rgba(56, 189, 248, 0.16) 0%, transparent 60%)',
                  'radial-gradient(460px 360px at 82% 30%, rgba(147, 197, 253, 0.10) 0%, transparent 58%)',
                  'radial-gradient(520px 420px at 50% 88%, rgba(56, 189, 248, 0.10) 0%, transparent 62%)',
                ].join(','),
              }}
            />

            {/* Matte grain (subtle) */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none">
              <filter id={noiseId}>
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.75"
                  numOctaves="3"
                  stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
            </svg>

            {/* Robot watermark (inspired, original vector) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.10]"
              viewBox="0 0 100 140"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Head */}
              <rect x="18" y="18" width="64" height="46" rx="18" fill="rgba(56,189,248,0.08)" />
              <rect x="22" y="22" width="56" height="38" rx="14" fill="rgba(255,255,255,0.04)" />
              {/* Ears */}
              <circle cx="16" cy="41" r="10" fill="rgba(56,189,248,0.06)" />
              <circle cx="84" cy="41" r="10" fill="rgba(56,189,248,0.06)" />
              <circle cx="16" cy="41" r="6" fill="rgba(255,255,255,0.04)" />
              <circle cx="84" cy="41" r="6" fill="rgba(255,255,255,0.04)" />

              {/* Eyes */}
              <rect x="38" y="36" width="8" height="14" rx="4" fill="rgba(255,255,255,0.55)" />
              <rect x="54" y="36" width="8" height="14" rx="4" fill="rgba(255,255,255,0.55)" />

              {/* Body */}
              <rect x="28" y="66" width="44" height="44" rx="18" fill="rgba(56,189,248,0.05)" />
              <rect x="32" y="70" width="36" height="36" rx="14" fill="rgba(255,255,255,0.03)" />

              {/* Antenna (to avoid copying the reference) */}
              <path d="M50 14 v-6" stroke="rgba(56,189,248,0.35)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="50" cy="6" r="3" fill="rgba(56,189,248,0.30)" />

              {/* Outline strokes */}
              <rect x="18" y="18" width="64" height="46" rx="18" fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="2" />
              <rect x="28" y="66" width="44" height="44" rx="18" fill="none" stroke="rgba(56,189,248,0.28)" strokeWidth="2" />
            </svg>

            {/* Etched inner border + corner ticks */}
            <div
              className="absolute inset-2 rounded-2xl pointer-events-none"
              style={{
                border: `1px solid ${rank.color}`,
                opacity: 0.2,
              }}
            />
            <div className="absolute inset-[10px] rounded-[18px] border border-white/5 pointer-events-none" />
            <div
              className="absolute left-3 top-3 h-3 w-3 pointer-events-none"
              style={{
                borderLeft: `2px solid ${rank.color}`,
                borderTop: `2px solid ${rank.color}`,
                opacity: 0.35,
              }}
            />
            <div
              className="absolute right-3 top-3 h-3 w-3 pointer-events-none"
              style={{
                borderRight: `2px solid ${rank.color}`,
                borderTop: `2px solid ${rank.color}`,
                opacity: 0.35,
              }}
            />
            <div
              className="absolute left-3 bottom-3 h-3 w-3 pointer-events-none"
              style={{
                borderLeft: `2px solid ${rank.color}`,
                borderBottom: `2px solid ${rank.color}`,
                opacity: 0.35,
              }}
            />
            <div
              className="absolute right-3 bottom-3 h-3 w-3 pointer-events-none"
              style={{
                borderRight: `2px solid ${rank.color}`,
                borderBottom: `2px solid ${rank.color}`,
                opacity: 0.35,
              }}
            />

            <div className="relative p-6 h-full flex flex-col">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white/80 truncate">
                    {rank.displayName}
                  </div>
                  <div className="mt-1 text-xs text-white/55">Level {level}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white tabular-nums">{displayPoints}</div>
                  <div className="text-xs text-white/55">Points</div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center">
                <div
                  className="h-20 w-20 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 65%, rgba(0,0,0,0.15) 100%)',
                    border: `1px solid ${rank.color}`,
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                  }}
                >
                  <span className="text-3xl font-bold text-white">{displayInitial}</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <div className="text-2xl font-bold text-white">{displayName}</div>
                <div className="text-sm text-white/55">{rank.displayName}</div>
              </div>

              <div className="mt-auto pt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onCustomize}
                  className="text-xs font-medium transition-colors text-white/60 hover:text-white"
                >
                  Customize Card
                </button>
                <button
                  type="button"
                  onClick={onProgression}
                  className="text-xs font-medium transition-colors text-white/60 hover:text-white"
                >
                  View Progression
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
