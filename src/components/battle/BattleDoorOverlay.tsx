export function BattleDoorOverlay({
  isOpen,
  zIndex = 60,
  durationMs = 420,
  title,
  subtitle,
  showSpinner = false,
}: {
  isOpen: boolean
  zIndex?: number
  durationMs?: number
  title?: string
  subtitle?: string
  showSpinner?: boolean
}) {
  const duration = Math.max(120, durationMs)
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)' // easeOutCubic-ish

  return (
    <div
      className="fixed inset-0"
      style={{
        zIndex,
        pointerEvents: isOpen ? 'none' : 'auto',
      }}
      aria-hidden={isOpen}
    >
      {/* Left door */}
      <div
        className={`absolute inset-y-0 left-0 w-1/2 bg-[#050505] transform-gpu will-change-transform ${
          isOpen ? '-translate-x-full' : 'translate-x-0'
        }`}
        style={{
          transitionProperty: 'transform',
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: ease,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-blue-500/50 to-transparent" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </div>

      {/* Right door */}
      <div
        className={`absolute inset-y-0 right-0 w-1/2 bg-[#050505] transform-gpu will-change-transform ${
          isOpen ? 'translate-x-full' : 'translate-x-0'
        }`}
        style={{
          transitionProperty: 'transform',
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: ease,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-l from-blue-900/10 via-transparent to-transparent" />
        <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-blue-500/50 to-transparent" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </div>

      {/* Center seam glow (subtle) */}
      <div
        className="absolute inset-y-0 left-1/2 w-px bg-blue-500/30 transition-opacity"
        style={{
          opacity: isOpen ? 0 : 1,
          transitionDuration: `${Math.min(200, Math.floor(duration / 2))}ms`,
          transitionTimingFunction: ease,
        }}
      />

      {/* Optional centered status content (shown while doors are closed) */}
      {!isOpen && (title || subtitle || showSpinner) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-center">
            {showSpinner && (
              <div className="relative">
                <div className="w-14 h-14 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 bg-blue-500/20 rounded-full animate-pulse" />
                </div>
              </div>
            )}
            {title && (
              <p className="text-blue-500 font-mono tracking-widest text-sm uppercase">
                {title}
              </p>
            )}
            {subtitle && (
              <p className="text-white/60 font-mono tracking-wider text-xs uppercase">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}




