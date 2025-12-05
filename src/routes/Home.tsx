import { useEffect } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { HeaderUserMenu } from '@/components/hub/HeaderUserMenu';
import { PlayerCard } from '@/components/hub/PlayerCard';
import '@/styles/lobby.css';

export default function Home() {
  useEffect(() => {
    document.title = 'A-Levels Battle - Lobby';
  }, []);

  return (
    <div className="match-container" style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
      {/* Player Card Section */}
      <div className="flex-center" style={{ minHeight: '60vh' }}>
        <PlayerCard />
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
