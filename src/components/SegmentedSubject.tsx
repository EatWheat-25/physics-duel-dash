import { motion } from 'framer-motion';
import { useSubjectStore } from '@/store/useSubjectStore';

export function SegmentedSubject() {
  const { subject, setSubject } = useSubjectStore();

  return (
    <div
      className="inline-flex gap-1 p-1 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
      role="radiogroup"
      aria-label="Subject selection"
    >
      <button
        onClick={() => setSubject('physics')}
        className={`relative px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:ring-offset-2 focus:ring-offset-[#060914]`}
        role="radio"
        aria-checked={subject === 'physics'}
        tabIndex={0}
      >
        {subject === 'physics' && (
          <motion.div
            layoutId="activeSubject"
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, var(--violet), var(--magenta))',
              boxShadow: '0 0 20px rgba(154,91,255,0.4)',
            }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          />
        )}
        <span className={`relative z-10 ${subject === 'physics' ? 'text-white' : 'text-[var(--text-dim)]'}`}>
          Physics
        </span>
      </button>

      <button
        onClick={() => setSubject('maths')}
        className={`relative px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:ring-offset-2 focus:ring-offset-[#060914]`}
        role="radio"
        aria-checked={subject === 'maths'}
        tabIndex={0}
      >
        {subject === 'maths' && (
          <motion.div
            layoutId="activeSubject"
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, var(--blue), var(--aqua))',
              boxShadow: '0 0 20px rgba(88,196,255,0.4)',
            }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          />
        )}
        <span className={`relative z-10 ${subject === 'maths' ? 'text-white' : 'text-[var(--text-dim)]'}`}>
          Maths
        </span>
      </button>
    </div>
  );
}
