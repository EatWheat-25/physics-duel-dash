import React, { useEffect, useRef } from 'react';

const CyberBackground: React.FC = () => {
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const createParticles = () => {
      const container = particlesRef.current;
      if (!container) return;

      const particleCount = 15;
      
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = `particle ${Math.random() > 0.5 ? 'particle-cyan' : 'particle-pink'}`;
        
        const size = Math.random() * 4 + 2;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const delay = Math.random() * 8;
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${x}%`;
        particle.style.top = `${y}%`;
        particle.style.animationDelay = `${delay}s`;
        
        container.appendChild(particle);
      }
    };

    createParticles();

    return () => {
      const container = particlesRef.current;
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <>
      {/* Cyber Grid Background */}
      <div className="cyber-grid" />
      
      {/* Floating Particles */}
      <div className="particles" ref={particlesRef} />
      
      {/* Gradient Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-transparent to-background/20" />
    </>
  );
};

export default CyberBackground;