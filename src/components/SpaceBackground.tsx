import React from 'react';

const SpaceBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 25%, #1f1f1f 50%, #2a2a2a 75%, #1a1a1a 100%)' }}
    />
  );
};

export default SpaceBackground;
