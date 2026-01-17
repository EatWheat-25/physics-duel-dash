import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "@/components/Dashboard";
import BattlePageNew from "@/components/BattlePageNew";
import PostMatchResults from "@/components/PostMatchResults";
import RankUpModal from "@/components/RankUpModal";
import PhysicsLevelSelector from "@/components/PhysicsLevelSelector";
import ChapterSelector from "@/components/ChapterSelector";
import { useRanking } from "@/hooks/useRanking";
import { getRandomQuestions } from "@/data/questions";
import { Question } from "@/data/questions";
import { Chapter, getQuestionsFromChapters, getQuestionsByRank } from "@/types/physics";
import { MathQuestion, getMathQuestionsByRank } from "@/types/math";
import { RankName, getRankByPoints, getPointsForWin, getPointsForLoss } from "@/types/ranking";
import { toast } from "@/hooks/use-toast";
import { StepBasedQuestion } from "@/types/questions";
import { getStepMathQuestions } from "@/data/stepMathQuestions";
import StepBattlePage from "@/components/StepBattlePage";
import { A2_INTEGRATION_QUESTIONS } from "@/data/questionPools/a2IntegrationQuestions";

interface MatchStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  playerScore: number;
  opponentScore: number;
  pointsEarned: number;
  won: boolean;
  outcome?: "win" | "loss" | "draw";
}

interface StepMatchStats {
  totalQuestions: number;
  totalSteps: number;
  playerMarks: number;
  opponentMarks: number;
  totalPossibleMarks: number;
  accuracy: number;
  won: boolean;
}

type PageState = "dashboard" | "battle" | "step-battle" | "results" | "physics-levels" | "chapters";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageState>("dashboard");
  const [battleQuestions, setBattleQuestions] = useState<Question[]>(getRandomQuestions(5));
  const [stepBattleQuestions, setStepBattleQuestions] = useState<StepBasedQuestion[]>([]);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [stepMatchStats, setStepMatchStats] = useState<StepMatchStats | null>(null);
  const [showRankUpModal, setShowRankUpModal] = useState(false);
  const [rankUpData, setRankUpData] = useState<{ newRank: RankName; pointsGained: number } | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<"A1" | "A2" | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [battleContext, setBattleContext] = useState<"regular" | "physics-study" | "math-battle">("regular");

  const { userData, updateAfterBattle } = useRanking();

  // Check auth and redirect if needed
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth");
      } else if (!profile?.onboarding_completed) {
        navigate("/onboarding");
      }
    }
  }, [user, profile, loading, navigate]);

  // Handle URL parameters for mode and level selection
  useEffect(() => {
    const mode = searchParams.get("mode");
    const level = searchParams.get("level");

    if (mode && level) {
      if (mode === "math") {
        // Map URL parameter to proper GameMode
        let mappedLevel: "A1-Only" | "A2-Only" | "All-Maths" | "A2-Integration";
        switch (level) {
          case "A1-Only":
            mappedLevel = "A1-Only";
            break;
          case "A2-Only":
            mappedLevel = "A2-Only";
            break;
          case "All-Maths":
            mappedLevel = "All-Maths";
            break;
          case "A2-Integration":
            mappedLevel = "A2-Integration";
            break;
          default:
            console.warn("Unknown math level:", level);
            return;
        }
        handleStartMathBattle(mappedLevel);
      } else if (mode === "physics") {
        handleStartPhysicsBattle(level as "A1" | "A2_ONLY" | "A2");
      }
      // Clear the URL parameters after processing
      setSearchParams({});
    }
  }, [searchParams]);

  const handleBattleEnd = (won: boolean, stats: MatchStats) => {
    const previousRank = userData.currentRank;
    const pointsGained = won ? getPointsForWin() : getPointsForLoss();
    const outcome: "win" | "loss" = won ? "win" : "loss";

    // Create final match stats with points
    const finalStats: MatchStats = {
      ...stats,
      pointsEarned: pointsGained,
      outcome,
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

    setCurrentPage("results");
  };

  const handleStepBattleEnd = (won: boolean, stats: StepMatchStats) => {
    // Calculate points based on accuracy for step battles
    const accuracyBonus = Math.floor(stats.accuracy / 10); // 1 point per 10% accuracy
    const basePoints = won ? getPointsForWin() : getPointsForLoss();
    const pointsEarned = won ? basePoints + accuracyBonus : Math.max(-10, basePoints); // Cap loss at -10

    setStepMatchStats(stats);

    // Update ranking with step battle results
    updateAfterBattle(won);

    // Check for rank up (similar to regular battle)
    const previousRank = userData.currentRank;
    setTimeout(() => {
      const newPoints = Math.max(0, userData.currentPoints + pointsEarned);
      const newRank = getRankByPoints(newPoints);

      if ((previousRank.tier !== newRank.tier || previousRank.subRank !== newRank.subRank) && won) {
        setRankUpData({ newRank: { tier: newRank.tier, subRank: newRank.subRank }, pointsGained: pointsEarned });
        setShowRankUpModal(true);
      }
    }, 100);

    setCurrentPage("results");
  };

  const handleSelectLevel = (levelId: "A1" | "A2_ONLY" | "A2") => {
    setSelectedLevel(levelId as "A1" | "A2");
    setBattleContext("physics-study");
    // Get questions based on current rank and start battle directly
    const questions = getQuestionsByRank(levelId, userData.currentPoints, 5);
    if (questions.length > 0) {
      setBattleQuestions(questions);
      setCurrentPage("battle");
    }
  };

  const handleSelectChapter = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    // For now, just start a battle with chapter questions
    // TODO: Implement chapter-specific study mode
    setCurrentPage("battle");
  };

  const handleStartMathBattle = async (level: "A1-Only" | "A2-Only" | "All-Maths" | "A2-Integration") => {
    console.log(`Starting Step-based Math battle for level: ${level}`);
    setBattleContext("math-battle");

    // Get step-based math questions based on level
    let stepQuestions: StepBasedQuestion[] = [];

    if (level === "A1-Only") {
      // A1 level: differentiation, integration, quadratic functions
      const q1 = await getStepMathQuestions({ subject: 'math', chapter: 'differentiation', level: 'A1', limit: 1 });
      const q2 = await getStepMathQuestions({ subject: 'math', chapter: 'integration', level: 'A1', limit: 1 });
      const q3 = await getStepMathQuestions({ subject: 'math', chapter: 'quadratic-functions', level: 'A1', limit: 1 });
      stepQuestions = [...q1, ...q2, ...q3];
  } else if (level === "A2-Only") {
  // Use any A2 maths questions from the DB
  stepQuestions = await getStepMathQuestions({ subject: 'math', level: 'A2', limit: 5 });
} else if (level === "A2-Integration") {
      // A2 Integration mode is currently unavailable
      toast({
        title: "A2 Integration Unavailable",
        description: "A2 Integration questions are coming soon! Try A2-Only mode instead.",
        variant: "destructive",
      });
      return;
    } else {
      // All-Maths: mix of A1 and A2 questions
      const q1 = await getStepMathQuestions({ subject: 'math', chapter: 'differentiation', level: 'A1', limit: 1 });
      const q2 = await getStepMathQuestions({ subject: 'math', chapter: 'parametric-equations', level: 'A2', limit: 1 });
      stepQuestions = [...q1, ...q2];
    }

    if (stepQuestions.length > 0) {
      setStepBattleQuestions(stepQuestions);
      setCurrentPage("step-battle");
    } else {
      toast({
        title: `${level} Not Available`,
        description: `No questions available for ${level} yet. Try another level or come back later!`,
        variant: "destructive",
      });
    }
  };

  const handleStartPhysicsBattle = (level: "A1" | "A2_ONLY" | "A2") => {
    setBattleContext("regular");
    // Get physics questions based on current rank and level
    const physicsQuestions = getQuestionsByRank(level, userData.currentPoints, 5);
    if (physicsQuestions.length > 0) {
      setBattleQuestions(physicsQuestions);
      setCurrentPage("battle");
    }
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Filter content based on user's selected subjects
  const userSubjects = profile?.subjects || [];
  const hasSubject = (subject: string, level?: string) => {
    if (!level) {
      return userSubjects.some((s) => s.subject === subject);
    }
    return userSubjects.some((s) => s.subject === subject && s.level === level);
  };

  return (
    <div className="min-h-screen">
      {currentPage === "dashboard" && (
        <Dashboard
          onStartBattle={() => {
            setBattleQuestions(getRandomQuestions(5));
            setBattleContext("regular");
            setCurrentPage("battle");
          }}
          onStartMathBattle={(level: "A1" | "A2_ONLY" | "A2") => {
            // This is for backward compatibility - Dashboard still uses old format
            // but we don't actually call it directly since we use URL routing
            console.log("Dashboard onStartMathBattle called with:", level);
          }}
          onStartPhysicsBattle={handleStartPhysicsBattle}
          userData={userData}
        />
      )}

      {currentPage === "physics-levels" && (
        <div className="min-h-screen relative">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90" />
          <div className="relative z-10 p-6">
            <PhysicsLevelSelector
              userData={userData}
              onPlayLevel={handleSelectLevel}
              onBack={() => setCurrentPage("dashboard")}
            />
          </div>
        </div>
      )}

      {currentPage === "chapters" && selectedLevel && (
        <div className="min-h-screen relative">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90" />
          <div className="relative z-10 p-6">
            <ChapterSelector
              levelId={selectedLevel}
              userData={userData}
              onSelectChapter={handleSelectChapter}
              onBack={() => setCurrentPage("physics-levels")}
            />
          </div>
        </div>
      )}

      {currentPage === "battle" && (
        <BattlePageNew
          onGoBack={() => {
            if (battleContext === "physics-study") {
              setCurrentPage("physics-levels");
            } else if (battleContext === "math-battle") {
              setCurrentPage("dashboard");
            } else {
              setCurrentPage("dashboard");
            }
          }}
          questions={battleQuestions}
          onBattleEnd={handleBattleEnd}
        />
      )}

      {currentPage === "step-battle" && (
        <StepBattlePage
          onGoBack={() => setCurrentPage("dashboard")}
          questions={stepBattleQuestions}
          onBattleEnd={handleStepBattleEnd}
        />
      )}

      {currentPage === "results" && (matchStats || stepMatchStats) && (
        <PostMatchResults
          matchStats={
            matchStats || {
              totalQuestions: stepMatchStats?.totalQuestions || 0,
              correctAnswers: Math.round(((stepMatchStats?.accuracy || 0) / 100) * (stepMatchStats?.totalSteps || 0)),
              wrongAnswers:
                (stepMatchStats?.totalSteps || 0) -
                Math.round(((stepMatchStats?.accuracy || 0) / 100) * (stepMatchStats?.totalSteps || 0)),
              playerScore: stepMatchStats?.playerMarks || 0,
              opponentScore: stepMatchStats?.opponentMarks || 0,
              pointsEarned: stepMatchStats?.won ? getPointsForWin() : getPointsForLoss(),
              won: stepMatchStats?.won || false,
              outcome: stepMatchStats?.won ? "win" : "loss",
            }
          }
          userData={userData}
          onPlayAgain={() => setCurrentPage("battle")}
          onContinue={() => {
            setCurrentPage("dashboard");
            setMatchStats(null);
            setStepMatchStats(null);
          }}
          stepStats={stepMatchStats}
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
