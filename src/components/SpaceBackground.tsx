import React from 'react';

const SpaceBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(180deg, #000000 0%, #050505 25%, #020202 50%, #050505 75%, #000000 100%)' }}
    />
  );
};

export default SpaceBackground;
