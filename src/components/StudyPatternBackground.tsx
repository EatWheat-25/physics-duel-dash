import React from 'react';

type StudyPatternBackgroundVariant = 'default' | 'battleNerds';

interface StudyPatternBackgroundProps {
  variant?: StudyPatternBackgroundVariant;
}

export const StudyPatternBackground: React.FC<StudyPatternBackgroundProps> = ({
  variant = 'default',
}) => {
  const isBattleNerds = variant === 'battleNerds';

  // Dense, repeating "study doodles" pattern (original vector, inspired by your reference wallpaper)
  const patternStroke = isBattleNerds ? '#55C7FF' : '#22d3ee';
  const patternSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <g fill="none" stroke="${patternStroke}" stroke-opacity="0.30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Book -->
        <path d="M26 34h34c6 0 10 4 10 10v44c0-6-4-10-10-10H26z"/>
        <path d="M26 34v44"/>
        <path d="M60 34v44"/>
        <path d="M40 44h18"/>

        <!-- Calculator -->
        <rect x="154" y="28" width="48" height="58" rx="10"/>
        <rect x="164" y="38" width="28" height="10" rx="4"/>
        <g>
          <rect x="164" y="54" width="10" height="10" rx="3"/>
          <rect x="178" y="54" width="10" height="10" rx="3"/>
          <rect x="192" y="54" width="10" height="10" rx="3"/>
          <rect x="164" y="68" width="10" height="10" rx="3"/>
          <rect x="178" y="68" width="10" height="10" rx="3"/>
          <rect x="192" y="68" width="10" height="10" rx="3"/>
        </g>

        <!-- Atom -->
        <circle cx="64" cy="150" r="5"/>
        <path d="M64 134c22 0 40 7 40 16s-18 16-40 16-40-7-40-16 18-16 40-16z"/>
        <path d="M44 140c10-16 28-26 40-22 12 4 14 22 4 38s-28 26-40 22c-12-4-14-22-4-38z"/>
        <path d="M84 140c-10-16-28-26-40-22-12 4-14 22-4 38s28 26 40 22c12-4 14-22 4-38z"/>

        <!-- Flask -->
        <path d="M170 126h24"/>
        <path d="M178 126v18l-20 34c-2 4 1 8 6 8h44c5 0 8-4 6-8l-20-34v-18"/>
        <path d="M168 172h44"/>

        <!-- Pencil -->
        <path d="M34 212l40-40 10 10-40 40H34z"/>
        <path d="M74 172l10 10"/>
        <path d="M30 216l4-4"/>

        <!-- Ruler -->
        <rect x="120" y="200" width="74" height="16" rx="6"/>
        <path d="M132 200v8"/>
        <path d="M144 200v6"/>
        <path d="M156 200v8"/>
        <path d="M168 200v6"/>
        <path d="M180 200v8"/>

        <!-- Lightbulb -->
        <path d="M206 120c0-10-8-18-18-18s-18 8-18 18c0 7 4 13 9 16v6h18v-6c5-3 9-9 9-16z"/>
        <path d="M178 148h20"/>
        <path d="M180 156h16"/>

        <!-- Graph -->
        <path d="M26 124v34h34"/>
        <path d="M30 152l10-12 10 8 10-18"/>

        <!-- Small stars/dots -->
        <path d="M116 44l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
        <circle cx="112" cy="92" r="2"/>
        <circle cx="122" cy="108" r="2"/>
        <circle cx="102" cy="110" r="2"/>
        <path d="M214 96l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
      </g>
    </svg>
  `);
  const patternUrl = `url("data:image/svg+xml,${patternSvg}")`;

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-black">
      {/* 1. High Contrast Dark Base (Black/Dark Slate) */}
      <div 
        className="absolute inset-0"
        style={{
          background: isBattleNerds
            ? 'radial-gradient(circle at 60% 55%, hsl(var(--bn-primary)) 0%, hsl(var(--bn-primary-deep)) 62%, #000000 100%)'
            : 'radial-gradient(circle at 50% 50%, #0f172a 0%, #000000 100%)',
        }}
      />

      {/* BattleNerds: soft light-blue fade in top-left */}
      {isBattleNerds && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'radial-gradient(900px 650px at 12% 12%, hsl(var(--bn-secondary) / 0.22) 0%, transparent 62%)',
              'radial-gradient(700px 500px at 18% 22%, hsl(var(--bn-secondary-deep) / 0.12) 0%, transparent 58%)',
            ].join(','),
          }}
        />
      )}

      {/* 2. Dense repeating pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          width: '160%',
          height: '160%',
          left: '-30%',
          top: '-30%',
          transform: 'rotate(-12deg) scale(1.2)',
          transformOrigin: 'center',
          backgroundImage: patternUrl,
          backgroundRepeat: 'repeat',
          backgroundSize: '170px 170px',
          opacity: 0.14,
        }}
      />

      {/* 3. Stronger Vignette for focus */}
      <div className="absolute inset-0 bg-[radial-gradient(transparent_30%,#000000_100%)] opacity-90 pointer-events-none" />
      
      {/* 4. Electric Blue Glow Drifts */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-20 animate-blob-float"
        style={{ background: isBattleNerds ? 'hsl(var(--bn-secondary))' : '#06b6d4' }} // Cyan-500
      />
      <div 
        className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-10 animate-blob-float"
        style={{ 
          background: isBattleNerds ? 'hsl(var(--bn-secondary-deep))' : '#3b82f6', // Blue-500
          animationDelay: '-5s' 
        }} 
      />
    </div>
  );
};
