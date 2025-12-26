import React from 'react';

export const SolarSystemBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-slate-950">
      {/* 1. Deep Space Base Layer */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #020617 80%)',
        }}
      />
      
      {/* 2. Solar System Container - Centered and tilted for perspective */}
      <div 
        className="absolute top-1/2 left-1/2 w-[100vmax] h-[100vmax] -translate-x-1/2 -translate-y-1/2"
        style={{
          transform: 'translate(-50%, -50%) scale(1)',
        }}
      >
        {/* Central Star (Sun) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Glow */}
          <div className="w-32 h-32 rounded-full bg-orange-500 blur-[80px] opacity-40 animate-pulse" />
          {/* Core */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-amber-200 to-orange-600 shadow-[0_0_60px_rgba(251,146,60,0.6)]" />
        </div>

        {/* Orbit 1: Mercury-like (Fast, Cyan) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25%] h-[25%] rounded-full border border-cyan-500/10 animate-[orbit_20s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
        </div>

        {/* Orbit 2: Earth-like (Medium, Blue/Green) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full border border-blue-500/10 animate-[orbit_35s_linear_infinite_reverse]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)]">
            {/* Tiny moon */}
            <div className="absolute -top-3 left-1/2 w-1.5 h-1.5 rounded-full bg-slate-200 animate-[orbit_3s_linear_infinite]" />
          </div>
        </div>

        {/* Orbit 3: Mars-like (Slow, Red) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full border border-red-500/10 animate-[orbit_55s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]" />
        </div>

        {/* Orbit 4: Jupiter-like (Very Slow, Purple/Gold) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] rounded-full border border-purple-500/10 animate-[orbit_90s_linear_infinite_reverse]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-amber-600 shadow-[0_0_30px_rgba(168,85,247,0.6)]">
             {/* Ring */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-4 border border-white/20 rounded-full -rotate-12" />
          </div>
        </div>
      </div>
      
      {/* 3. Starfield Overlay (Static dust) */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(1px 1px at 10% 10%, white 100%, transparent), radial-gradient(1px 1px at 20% 20%, white 100%, transparent), radial-gradient(2px 2px at 30% 30%, white 100%, transparent)', backgroundSize: '500px 500px', opacity: 0.15 }}></div>
    </div>
  );
};

