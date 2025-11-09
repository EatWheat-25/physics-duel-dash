import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Calculator, Atom, BookOpen, Swords, Trophy, ShoppingBag, TrendingUp, Layers, Sparkles } from 'lucide-react';
import { useCharacter } from '@/hooks/useCharacter';
import CharacterAvatar from '@/components/CharacterAvatar';

const ModeSelection: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCharacter } = useCharacter();

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #0a0a14 0%, #12121a 50%, #0a0a14 100%)'
    }}>
      {/* Starfield Background */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute w-1 h-1 bg-white rounded-full opacity-60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-between p-8 pb-4">
        {/* Back Button */}
        <Link 
          to="/" 
          className="self-start text-white/70 hover:text-white transition-all text-sm font-medium mb-8"
        >
          ← Back to Dashboard
        </Link>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl">
          {/* Title & Character Section */}
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-6xl font-black mb-4" style={{
              background: 'linear-gradient(90deg, #00d9ff 0%, #a855f7 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Choose Your Path
            </h1>
            <p className="text-gray-400 text-lg max-w-lg mx-auto mb-12">
              Master A-Level Physics through competitive battles or structured learning
            </p>

            {/* Character Avatar with Subject Buttons */}
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="relative">
                <div className="w-48 h-48 rounded-full relative" style={{
                  background: 'linear-gradient(135deg, #00d9ff, #a855f7, #ec4899)',
                  padding: '4px'
                }}>
                  <div className="w-full h-full rounded-full bg-[#12121a] flex items-center justify-center overflow-hidden">
                    <CharacterAvatar character={selectedCharacter} size="lg" />
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-center w-full">
                  <div className="text-white font-bold text-sm tracking-wider">SCHOLAR BYTE</div>
                  <div className="text-gray-400 text-xs">PHYSICS PRODIGY</div>
                </div>
              </div>

              {/* Subject Pills */}
              <div className="flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 rounded-2xl font-bold text-white flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #ec4899)'
                  }}
                  onClick={() => navigate('/?subject=physics&mode=A1')}
                >
                  <Atom className="w-5 h-5" />
                  PHYSICS
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 rounded-2xl font-bold text-white flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #00d9ff, #3b82f6)'
                  }}
                  onClick={() => navigate('/?subject=math&mode=A1')}
                >
                  <Calculator className="w-5 h-5" />
                  MATHS
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Daily Challenge Card */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-4xl mb-8"
          >
            <div 
              className="p-8 rounded-3xl cursor-pointer hover:scale-[1.02] transition-transform"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                boxShadow: '0 20px 60px rgba(168, 85, 247, 0.3)'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black text-white mb-2">
                    DAILY CHALLENGE:
                  </h2>
                  <h3 className="text-3xl font-black text-white/90">
                    QUANTUM CONUNDRUM!
                  </h3>
                </div>
                <Sparkles className="w-16 h-16 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Mode Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            {/* Study Mode */}
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              onClick={() => navigate('/?subject=physics&mode=A1')}
              className="p-8 rounded-3xl cursor-pointer hover:scale-[1.02] transition-transform"
              style={{
                background: 'linear-gradient(135deg, #00d9ff, #a855f7)',
                boxShadow: '0 20px 60px rgba(0, 217, 255, 0.3)'
              }}
            >
              <div className="flex items-start justify-between mb-6">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-3xl font-black text-white mb-4">
                PHYSICS STUDY<br/>MODE
              </h3>
              <div className="text-white/90 text-sm space-y-1">
                <p>A1 & A2 • CHAPTER</p>
                <p>PROGRESSION • RANK-</p>
                <p>BASED UNLOCKS</p>
              </div>
            </motion.div>

            {/* Battle Arena */}
            <motion.div
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              onClick={() => navigate('/online-battle')}
              className="p-8 rounded-3xl cursor-pointer hover:scale-[1.02] transition-transform"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                boxShadow: '0 20px 60px rgba(236, 72, 153, 0.3)'
              }}
            >
              <div className="flex items-start justify-between mb-6">
                <Swords className="w-10 h-10 text-white" />
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-3xl font-black text-white mb-4">
                1V1 BATTLE<br/>ARENA
              </h3>
              <div className="text-white/90 text-sm space-y-1">
                <p>A1 & A2 • CHAPTER</p>
                <p>COMPETITIVE • QUICK</p>
                <p>MATCH • RANKED</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="w-full max-w-4xl mt-12">
          <div className="bg-[#1a1a24]/80 backdrop-blur-lg rounded-3xl p-4 border border-white/10">
            <div className="flex items-center justify-around">
              <button className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <Layers className="w-6 h-6" />
                <span className="text-xs font-bold">MODULES</span>
              </button>
              <button className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <Trophy className="w-6 h-6" />
                <span className="text-xs font-bold">CHALLENGES</span>
              </button>
              <button 
                className="flex flex-col items-center gap-2 -mt-8"
                onClick={() => navigate('/online-battle')}
              >
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-full p-6 shadow-lg">
                  <Swords className="w-8 h-8 text-white" />
                </div>
                <span className="text-xs font-bold text-white">BATTLE!</span>
              </button>
              <button className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <TrendingUp className="w-6 h-6" />
                <span className="text-xs font-bold">PROGRESSION</span>
              </button>
              <button className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <ShoppingBag className="w-6 h-6" />
                <span className="text-xs font-bold">SHOP</span>
              </button>
            </div>
          </div>
          <p className="text-center text-gray-500 text-xs mt-4 tracking-widest">
            WISDOM YIELDS POWER
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;