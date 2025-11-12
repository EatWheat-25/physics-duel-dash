import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';
import { HeaderUserMenu } from '@/components/hub/HeaderUserMenu';
import { PlayerCard } from '@/components/hub/PlayerCard';
import { FindingOpponentPopup } from '@/components/FindingOpponentPopup';
import { useBattleQueueStore } from '@/store/useBattleQueueStore';
import { useMatchmaking } from '@/hooks/useMatchmaking';


export default function Home() {
  const { pendingBattle, clearPendingBattle } = useBattleQueueStore();
  const { status, joinQueue, leaveQueue, queueStartTime } = useMatchmaking();
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    document.title = 'Player Hub | BattleNerds';
  }, []);

  useEffect(() => {
    if (status === 'queuing' && queueStartTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - queueStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, queueStartTime]);

  const handleBattleClick = async () => {
    if (!pendingBattle) return;
    
    await joinQueue({
      subject: pendingBattle.subject,
      chapter: pendingBattle.mode,
    });
  };

  const handleCancelSearch = async () => {
    await leaveQueue();
    clearPendingBattle();
    setElapsedTime(0);
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col justify-between">
      <Starfield />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)',
        }}
      />

      <header className="relative z-20 w-full max-w-[1200px] mx-auto px-6 pt-6 flex justify-end">
        <HeaderUserMenu />
      </header>

      <AnimatePresence>
        {status === 'queuing' && (
          <FindingOpponentPopup
            elapsedTime={elapsedTime}
            onCancel={handleCancelSearch}
          />
        )}
      </AnimatePresence>

      <main className="relative z-10 flex flex-col items-center justify-center gap-6 px-4 py-8">
        <PlayerCard />
      </main>

      <footer className="relative z-20 pb-8">
        <BottomNav onBattleClick={pendingBattle ? handleBattleClick : undefined} />
      </footer>
    </div>
  );
}
