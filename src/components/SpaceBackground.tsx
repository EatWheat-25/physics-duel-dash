import React from 'react';

const SpaceBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #0f0f0f 25%, #0d0d0d 50%, #0f0f0f 75%, #0a0a0a 100%)' }}
    />
  );
};

export default SpaceBackground;
