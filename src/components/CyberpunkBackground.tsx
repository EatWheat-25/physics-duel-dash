import React from 'react';
import { motion } from 'framer-motion';

const CyberpunkBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base Gradient */}
      <div 
        className="absolute inset-0" 
        style={{ background: 'var(--gradient-bg)' }}
      />
      
      {/* Animated Circuit Grid */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'var(--pattern-circuit)',
          backgroundSize: '100px 100px',
        }}
      >
        <motion.div
          className="w-full h-full"
          animate={{ 
            backgroundPosition: ['0px 0px', '100px 100px', '0px 0px'] 
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            backgroundImage: 'var(--pattern-circuit)',
            backgroundSize: '100px 100px',
          }}
        />
      </div>
      
      {/* Hexagonal Tech Pattern */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'var(--pattern-hex)',
          backgroundSize: '60px 60px',
        }}
      >
        <motion.div
          className="w-full h-full"
          animate={{ 
            backgroundPosition: ['0px 0px', '-60px -60px', '0px 0px'] 
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          style={{
            backgroundImage: 'var(--pattern-hex)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>
      
      {/* Data Stream Particles */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'var(--pattern-data)',
          backgroundSize: '40px 40px',
        }}
      >
        <motion.div
          className="w-full h-full"
          animate={{ 
            backgroundPosition: ['0px 0px', '40px 40px', '0px 0px'] 
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{
            backgroundImage: 'var(--pattern-data)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>
      
      {/* Floating Holographic Orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(180, 100%, 50%, 0.1), transparent)',
          filter: 'blur(20px)'
        }}
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -50, 100, 0],
          scale: [1, 1.2, 0.8, 1],
          opacity: [0.3, 0.6, 0.3, 0.3]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <motion.div
        className="absolute top-3/4 right-1/4 w-24 h-24 rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(280, 100%, 70%, 0.15), transparent)',
          filter: 'blur(15px)'
        }}
        animate={{
          x: [0, -80, 60, 0],
          y: [0, 60, -40, 0],
          scale: [1, 0.8, 1.3, 1],
          opacity: [0.4, 0.7, 0.4, 0.4]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      
      <motion.div
        className="absolute top-1/2 right-1/3 w-20 h-20 rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(320, 100%, 60%, 0.12), transparent)',
          filter: 'blur(12px)'
        }}
        animate={{
          x: [0, 70, -30, 0],
          y: [0, -80, 50, 0],
          scale: [1, 1.5, 0.9, 1],
          opacity: [0.2, 0.5, 0.2, 0.2]
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
      
      {/* Scanning Lines Effect */}
      <motion.div
        className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-20"
        animate={{ y: ['-100vh', '100vh'] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        style={{ filter: 'blur(1px)' }}
      />
      
      <motion.div
        className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-15"
        animate={{ y: ['-100vh', '100vh'] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear", delay: 4 }}
        style={{ filter: 'blur(1px)' }}
      />
      
      {/* Geometric Wireframes */}
      <motion.div
        className="absolute top-10 right-10 w-40 h-40 border border-cyan-400/20 rotate-45"
        animate={{ rotate: [45, 225, 405] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-4 border border-purple-400/15 rotate-45" />
        <div className="absolute inset-8 border border-pink-400/10 rotate-45" />
      </motion.div>
      
      <motion.div
        className="absolute bottom-20 left-20 w-32 h-32 border border-purple-400/20"
        animate={{ rotate: [0, 180, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-3 border border-cyan-400/15 rotate-45" />
        <div className="absolute inset-6 border border-pink-400/10" />
      </motion.div>
      
      {/* Subtle Data Stream Lines */}
      <div className="absolute inset-0">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-px h-20 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent"
            style={{
              left: `${20 + i * 15}%`,
              top: '-20px'
            }}
            animate={{ y: ['0vh', '120vh'] }}
            transition={{ 
              duration: 6 + i, 
              repeat: Infinity, 
              ease: "linear",
              delay: i * 2
            }}
          />
        ))}
        
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={`purple-${i}`}
            className="absolute w-px h-16 bg-gradient-to-b from-transparent via-purple-400/25 to-transparent"
            style={{
              left: `${60 + i * 20}%`,
              top: '-16px'
            }}
            animate={{ y: ['0vh', '120vh'] }}
            transition={{ 
              duration: 8 + i, 
              repeat: Infinity, 
              ease: "linear",
              delay: i * 3
            }}
          />
        ))}
      </div>
      
      {/* Ambient Corner Glows */}
      <div 
        className="absolute top-0 left-0 w-96 h-96 opacity-20"
        style={{
          background: 'radial-gradient(circle at top left, hsl(180, 100%, 50%, 0.1), transparent 70%)',
          filter: 'blur(60px)'
        }}
      />
      
      <div 
        className="absolute bottom-0 right-0 w-96 h-96 opacity-20"
        style={{
          background: 'radial-gradient(circle at bottom right, hsl(280, 100%, 70%, 0.1), transparent 70%)',
          filter: 'blur(60px)'
        }}
      />
      
      <div 
        className="absolute top-0 right-0 w-80 h-80 opacity-15"
        style={{
          background: 'radial-gradient(circle at top right, hsl(320, 100%, 60%, 0.08), transparent 70%)',
          filter: 'blur(50px)'
        }}
      />
    </div>
  );
};

export default CyberpunkBackground;