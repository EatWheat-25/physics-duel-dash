import { useEffect, useState } from 'react';
import type { RoundResult } from '@/types/roundState';
import './RoundTransition.css';

interface RoundTransitionProps {
  roundResult: RoundResult;
  currentUserId: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  totalPossiblePoints: number;
}

export function RoundTransition({
  roundResult,
  currentUserId,
  player1Id,
  player2Id,
  player1Name,
  player2Name,
  totalPossiblePoints,
}: RoundTransitionProps) {
  const youIsP1 = currentUserId === player1Id;
  const yourScore = youIsP1 ? roundResult.player1RoundScore : roundResult.player2RoundScore;
  const oppScore = youIsP1 ? roundResult.player2RoundScore : roundResult.player1RoundScore;
  const yourName = youIsP1 ? player1Name : player2Name;
  const oppName = youIsP1 ? player2Name : player1Name;

  const isYouWinner = yourScore > oppScore;
  const isOpponentWinner = oppScore > yourScore;
  const isDraw = yourScore === oppScore;

  // Animated score counters
  const [displayYourScore, setDisplayYourScore] = useState(0);
  const [displayOppScore, setDisplayOppScore] = useState(0);

  useEffect(() => {
    // Animate scores counting up
    const duration = 1000; // 1 second animation
    const steps = 30;
    const stepDuration = duration / steps;
    const yourStep = yourScore / steps;
    const oppStep = oppScore / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep <= steps) {
        setDisplayYourScore(Math.min(yourScore, Math.round(yourStep * currentStep)));
        setDisplayOppScore(Math.min(oppScore, Math.round(oppStep * currentStep)));
      } else {
        clearInterval(interval);
        setDisplayYourScore(yourScore);
        setDisplayOppScore(oppScore);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [yourScore, oppScore]);

  return (
    <div className="round-transition-overlay">
      <div className="round-transition-content">
        {/* Winner/Draw announcement */}
        <div className="transition-header">
          {isDraw ? (
            <h2 className="transition-title draw">Round Draw!</h2>
          ) : isYouWinner ? (
            <h2 className="transition-title winner">You Won This Round! 🎉</h2>
          ) : (
            <h2 className="transition-title loser">Opponent Won This Round</h2>
          )}
        </div>

        {/* Score cards */}
        <div className="transition-scores">
          {/* Your card */}
          <div className={`score-card ${isYouWinner ? 'winner-card' : ''} ${isDraw ? 'draw-card' : ''}`}>
            <div className="score-card-header">
              <div className="score-card-avatar">👤</div>
              <h3 className="score-card-name">{yourName}</h3>
            </div>
            <div className="score-card-value">
              <span className="score-number">{displayYourScore}</span>
              <span className="score-divider">/</span>
              <span className="score-total">{totalPossiblePoints}</span>
            </div>
          </div>

          {/* VS badge */}
          <div className="transition-vs">VS</div>

          {/* Opponent card */}
          <div className={`score-card ${isOpponentWinner ? 'winner-card' : ''} ${isDraw ? 'draw-card' : ''}`}>
            <div className="score-card-header">
              <div className="score-card-avatar">🤖</div>
              <h3 className="score-card-name">{oppName}</h3>
            </div>
            <div className="score-card-value">
              <span className="score-number">{displayOppScore}</span>
              <span className="score-divider">/</span>
              <span className="score-total">{totalPossiblePoints}</span>
            </div>
          </div>
        </div>

        {/* Next round indicator */}
        <div className="transition-footer">
          <p className="transition-next">Next round starting soon...</p>
          <div className="transition-progress">
            <div className="transition-progress-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}


