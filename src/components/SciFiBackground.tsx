import React from 'react';

export const SciFiBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-slate-950">
      {/* 1. Base Gradient (Deep Indigo/Charcoal) */}
      <div 
        className="absolute inset-0 opacity-80"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #020617 100%)',
        }}
      />

      {/* 2. Flowing Orbs (Rivers of Light) */}
      {/* Cyan flow */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-30 animate-blob-float"
        style={{
          background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
          animationDelay: '0s',
        }}
      />
      {/* Gold/Amber flow */}
      <div 
        className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[140px] opacity-20 animate-blob-float"
        style={{
          background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)',
          animationDelay: '-5s',
          animationDuration: '25s',
        }}
      />
      {/* Pearlescent White/Violet highlight */}
      <div 
        className="absolute top-[40%] left-[50%] w-[40%] h-[40%] rounded-full blur-[100px] opacity-20 animate-blob-float"
        style={{
          background: 'radial-gradient(circle, #ddd6fe 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          animationDelay: '-10s',
          animationDuration: '30s',
        }}
      />
      
      {/* 3. Nebula/Dust Texture (SVG Noise Overlay) */}
      <svg className="absolute inset-0 w-full h-full opacity-30 mix-blend-overlay pointer-events-none">
        <filter id="noiseFilter">
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.6" 
            numOctaves="3" 
            stitchTiles="stitch" 
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>
      
      {/* 4. Subtle Vignette to focus center */}
      <div className="absolute inset-0 bg-[radial-gradient(transparent_0%,#020617_100%)] opacity-60 pointer-events-none" />
    </div>
  );
};

