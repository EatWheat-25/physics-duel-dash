import BattleConnected from '@/pages/BattleConnected';

/**
 * Simplified OnlineBattle component - redirects to BattleConnected
 * 
 * This is kept for backwards compatibility with existing routes.
 * All game logic has been removed.
 */
export const OnlineBattle = () => {
  return <BattleConnected />;
};
