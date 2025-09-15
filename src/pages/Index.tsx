import React, { useState } from 'react';
import Dashboard from '@/components/Dashboard';
import BattlePageNew from '@/components/BattlePageNew';
import PostMatchResults from '@/components/PostMatchResults';
import RankUpModal from '@/components/RankUpModal';
import PhysicsLevelSelector from '@/components/PhysicsLevelSelector';
import ChapterSelector from '@/components/ChapterSelector';
import { useRanking } from '@/hooks/useRanking';
import { getRandomQuestions } from '@/data/questions';
import { Question } from '@/data/questions';
import { Chapter, getQuestionsFromChapters, getQuestionsByRank } from '@/types/physics';
import { MathQuestion, getMathQuestionsByRank } from '@/types/math';
import { RankName, getRankByPoints, getPointsForWin, getPointsForLoss } from '@/types/ranking';

interface MatchStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  playerScore: number;
  opponentScore: number;
  pointsEarned: number;
  won: boolean;
}

type PageState = 'dashboard' | 'battle' | 'results' | 'physics-levels' | 'chapters';

const Index = () => {
  const [currentPage, setCurrentPage] = useState<PageState>('dashboard');
  const [battleQuestions, setBattleQuestions] = useState<Question[]>(getRandomQuestions(5));
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [showRankUpModal, setShowRankUpModal] = useState(false);
  const [rankUpData, setRankUpData] = useState<{ newRank: RankName; pointsGained: number } | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<'A1' | 'A2' | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [battleContext, setBattleContext] = useState<'regular' | 'physics-study' | 'math-battle'>('regular');
  
  const { userData, updateAfterBattle } = useRanking();

  const handleBattleEnd = (won: boolean, stats: MatchStats) => {
    const previousRank = userData.currentRank;
    const pointsGained = won ? getPointsForWin() : getPointsForLoss();
    
    // Create final match stats with points
    const finalStats: MatchStats = {
      ...stats,
      pointsEarned: pointsGained
    };
    
    setMatchStats(finalStats);
    
    // Update battle results
    updateAfterBattle(won);
    
    // Check for rank up
    setTimeout(() => {
      const newPoints = Math.max(0, userData.currentPoints + pointsGained);
      const newRank = getRankByPoints(newPoints);
      
      if ((previousRank.tier !== newRank.tier || previousRank.subRank !== newRank.subRank) && won) {
        setRankUpData({ newRank: { tier: newRank.tier, subRank: newRank.subRank }, pointsGained });
        setShowRankUpModal(true);
      }
    }, 100);
    
    setCurrentPage('results');
  };

  const handleSelectLevel = (levelId: 'A1' | 'A2_ONLY' | 'A2') => {
    setSelectedLevel(levelId as 'A1' | 'A2');
    setBattleContext('physics-study');
    // Get questions based on current rank and start battle directly
    const questions = getQuestionsByRank(levelId, userData.currentPoints, 5);
    if (questions.length > 0) {
      setBattleQuestions(questions);
      setCurrentPage('battle');
    }
  };

  const handleSelectChapter = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    // For now, just start a battle with chapter questions
    // TODO: Implement chapter-specific study mode
    setCurrentPage('battle');
  };

  const handleStartMathBattle = (level: 'A1' | 'A2_ONLY' | 'A2') => {
    setBattleContext('math-battle');
    // Get math questions based on current rank and level
    const mathQuestions = getMathQuestionsByRank(level, userData.currentPoints, 5);
    if (mathQuestions.length > 0) {
      // Convert MathQuestion to Question format for compatibility with battle system
      const convertedQuestions: Question[] = mathQuestions.map(mq => ({
        q: mq.q,
        options: mq.options,
        answer: mq.answer
      }));
      setBattleQuestions(convertedQuestions);
      setCurrentPage('battle');
    }
  };

  const handleStartPhysicsBattle = (level: 'A1' | 'A2_ONLY' | 'A2') => {
    setBattleContext('regular');
    // Get physics questions based on current rank and level
    const physicsQuestions = getQuestionsByRank(level, userData.currentPoints, 5);
    if (physicsQuestions.length > 0) {
      setBattleQuestions(physicsQuestions);
      setCurrentPage('battle');
    }
  };

  return (
    <div className="min-h-screen">
      {currentPage === 'dashboard' && (
        <Dashboard 
          onStartBattle={() => {
            setBattleQuestions(getRandomQuestions(5));
            setBattleContext('regular');
            setCurrentPage('battle');
          }} 
          onStartMathBattle={handleStartMathBattle}
          onStartPhysicsBattle={handleStartPhysicsBattle}
          userData={userData}
        />
      )}
      
      {currentPage === 'physics-levels' && (
        <div className="min-h-screen relative">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90" />
          <div className="relative z-10 p-6">
            <PhysicsLevelSelector
              userData={userData}
              onPlayLevel={handleSelectLevel}
              onBack={() => setCurrentPage('dashboard')}
            />
          </div>
        </div>
      )}
      
      {currentPage === 'chapters' && selectedLevel && (
        <div className="min-h-screen relative">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90" />
          <div className="relative z-10 p-6">
            <ChapterSelector
              levelId={selectedLevel}
              userData={userData}
              onSelectChapter={handleSelectChapter}
              onBack={() => setCurrentPage('physics-levels')}
            />
          </div>
        </div>
      )}
      
      {currentPage === 'battle' && (
        <BattlePageNew
          onGoBack={() => {
            if (battleContext === 'physics-study') {
              setCurrentPage('physics-levels');
            } else if (battleContext === 'math-battle') {
              setCurrentPage('dashboard');
            } else {
              setCurrentPage('dashboard');
            }
          }}
          questions={battleQuestions}
          onBattleEnd={handleBattleEnd}
        />
      )}
      
      {currentPage === 'results' && matchStats && (
        <PostMatchResults
          matchStats={matchStats}
          userData={userData}
          onPlayAgain={() => setCurrentPage('battle')}
          onContinue={() => setCurrentPage('dashboard')}
        />
      )}

      {/* Rank Up Modal */}
      {rankUpData && (
        <RankUpModal
          isOpen={showRankUpModal}
          onClose={() => {
            setShowRankUpModal(false);
            setRankUpData(null);
          }}
          newRank={rankUpData.newRank}
          pointsGained={rankUpData.pointsGained}
        />
      )}
    </div>
  );
};

export default Index;