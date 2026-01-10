import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Swords, Atom } from 'lucide-react';
import { Starfield } from '@/components/Starfield';
import { NeonText } from '@/components/NeonText';
import { GlowCard } from '@/components/GlowCard';
import { PillTabs } from '@/components/PillTabs';
import { Dock } from '@/components/Dock';

export const onStartDailyChallenge = () => console.log('Daily Challenge Started');
export const onStartStudyMode = () => console.log('Study Mode Started');
export const onStartBattleArena = () => console.log('Battle Arena Started');
export const onPressBattle = () => console.log('Battle Button Pressed');

export default function NewHome() {
  const [subject, setSubject] = useState('physics');

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <Starfield />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-[clamp(1rem,3vh,2rem)] pb-[clamp(6rem,14vh,8rem)]">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 md:gap-8 items-end mb-[clamp(2rem,5vh,3rem)]"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <NeonText gradient>Choose Your Path</NeonText>
            </h1>
            <p className="text-lg" style={{ color: 'var(--text-dim)' }}>
              Master A-Level Physics through competitive battles or structured learning
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="flex flex-col items-center">
              <motion.div
                className="relative w-32 h-32 rounded-full overflow-hidden mb-3"
                style={{
                  border: '3px solid var(--violet)',
                  boxShadow: '0 0 40px rgba(154,91,255,0.4)',
                }}
                whileHover={{ scale: 1.05 }}
                animate={{
                  boxShadow: [
                    '0 0 40px rgba(154,91,255,0.4)',
                    '0 0 50px rgba(255,77,216,0.5)',
                    '0 0 40px rgba(154,91,255,0.4)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <img
                  src="/Gemini_Generated_Image_720dfv720dfv720d.png"
                  alt="Scholar Byte"
                  className="w-full h-full object-cover"
                />
              </motion.div>
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  SCHOLAR BYTE
                </p>
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  PHYSICS PRODIGY
                </p>
              </div>
            </div>

            <PillTabs
              value={subject}
              onValueChange={setSubject}
              options={[
                { value: 'physics', label: 'Physics' },
                { value: 'maths', label: 'Maths' },
              ]}
            />
          </div>
        </motion.div>

        <motion.button
          onClick={onStartDailyChallenge}
          className="relative w-full mb-[clamp(1rem,3vh,2rem)] p-[clamp(1.25rem,3vh,2rem)] rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--magenta)] focus:ring-offset-2 focus:ring-offset-[#060914]"
          style={{
            background: 'linear-gradient(135deg, var(--magenta), var(--violet), var(--indigo))',
            boxShadow: '0 0 60px rgba(242,55,212,0.3)',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ boxShadow: '0 0 80px rgba(242,55,212,0.5)' }}
          whileTap={{ scale: 0.98 }}
          aria-label="Start Daily Challenge"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-wide">
                DAILY CHALLENGE: QUANTUM CONUNDRUM!
              </h2>
            </div>
            <Atom className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
        </motion.button>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-[clamp(1rem,3vh,2rem)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <GlowCard
            title="PHYSICS STUDY MODE"
            subtitle="A1 & A2 • Chapter Progression • Rank-Based Unlocks"
            icon={BookOpen}
            variant="blue"
            onClick={onStartStudyMode}
          />

          <GlowCard
            title="1V1 BATTLE ARENA"
            subtitle="A1 & A2 • Chapter Competitive • Quick Match • Ranked"
            icon={Swords}
            variant="violet"
            onClick={onStartBattleArena}
          />
        </motion.div>

        <motion.div
          className="text-center mt-[clamp(1.5rem,5vh,4rem)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <p
            className="text-xs uppercase tracking-widest font-medium"
            style={{ color: 'var(--text-dim)' }}
          >
            WISDOM YIELDS POWER
          </p>
        </motion.div>
      </div>

      <Dock
        onModules={() => console.log('Modules')}
        onChallenges={() => console.log('Challenges')}
        onBattle={onPressBattle}
        onProgression={() => console.log('Progression')}
        onShop={() => console.log('Shop')}
      />
    </div>
  );
}
