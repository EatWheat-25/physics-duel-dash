import React, { useEffect, useRef } from 'react';

const SpaceBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    // Mathematical symbols and formulas
    const symbols = ['∫', '∑', 'π', 'θ', 'α', 'β', 'λ', '∞', '√', '∂', 'Δ', '≈', '≠', '≤', '≥', 'φ', 'ω', 'Σ', '±'];
    
    // Create floating academic elements
    const elements: { 
      x: number; 
      y: number; 
      symbol: string;
      size: number; 
      opacity: number; 
      speed: number;
      drift: number;
    }[] = [];
    const elementCount = 40;

    for (let i = 0; i < elementCount; i++) {
      elements.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        size: Math.random() * 20 + 15,
        opacity: Math.random() * 0.3 + 0.1,
        speed: Math.random() * 0.3 + 0.1,
        drift: Math.random() * 0.5 - 0.25
      });
    }

    // Create subtle particles
    const particles: { x: number; y: number; size: number; opacity: number; fadeSpeed: number }[] = [];
    const particleCount = 100;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5,
        fadeSpeed: Math.random() * 0.01 + 0.005
      });
    }

    // Animation
    let animationFrame: number;
    const animate = () => {
      ctx.fillStyle = 'rgba(10, 10, 20, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw subtle particles
      particles.forEach(particle => {
        particle.opacity += particle.fadeSpeed;
        if (particle.opacity > 0.5 || particle.opacity < 0.1) {
          particle.fadeSpeed = -particle.fadeSpeed;
        }

        ctx.fillStyle = `rgba(200, 220, 255, ${particle.opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw floating mathematical symbols
      elements.forEach(element => {
        element.y -= element.speed;
        element.x += element.drift;

        // Reset position when element goes off screen
        if (element.y < -50) {
          element.y = canvas.height + 50;
          element.x = Math.random() * canvas.width;
        }
        if (element.x < -50 || element.x > canvas.width + 50) {
          element.x = Math.random() * canvas.width;
        }

        ctx.font = `${element.size}px Arial`;
        ctx.fillStyle = `rgba(140, 180, 255, ${element.opacity})`;
        ctx.fillText(element.symbol, element.x, element.y);
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(180deg, #0a0a14 0%, #0d0d1a 25%, #1a1a2e 50%, #0d0d1a 75%, #0a0a14 100%)' }}
    />
  );
};

export default SpaceBackground;
