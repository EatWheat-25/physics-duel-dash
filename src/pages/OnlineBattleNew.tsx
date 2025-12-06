import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';

/**
 * New OnlineBattle component - Clean, production-ready
 * 
 * Flow:
 * 1. Get match from navigation state (fast) or fetch from DB
 * 2. Connect to game-ws via useGame hook
 * 3. Display question when received
 */
export default function OnlineBattleNew() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Try to use match from navigation state first (fastest path)
  useEffect(() => {
    const stateMatch = location.state?.match as MatchRow | undefined;
    if (stateMatch && stateMatch.id === matchId) {
      console.log('[BattleNew] ✅ Using match from navigation state:', stateMatch.id);
      setMatch(stateMatch);
      return;
    }
  }, [location.state, matchId]);

  // Fetch match from database if not in state
  useEffect(() => {
    if (match) return; // Already have match from state

    if (!matchId) {
      toast.error('No match ID provided');
      navigate('/matchmaking-new');
      return;
    }

    const fetchMatch = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('[BattleNew] User not authenticated:', userError);
        toast.error('Please log in to view match');
        navigate('/matchmaking-new');
        return;
      }

      setCurrentUser(user.id);
      console.log('[BattleNew] Fetching match from DB:', matchId);

      // Simple retry logic
      let retries = 3;
      let delay = 1000;

      while (retries > 0) {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .maybeSingle();

        if (error) {
          console.error('[BattleNew] Error fetching match:', error);
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          toast.error(`Failed to load match: ${error.message}`);
          navigate('/matchmaking-new');
          return;
        }

        if (!data) {
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          toast.error('Match not found');
          navigate('/matchmaking-new');
          return;
        }

        // Verify user is part of match
        if (data.player1_id !== user.id && data.player2_id !== user.id) {
          toast.error('You are not part of this match');
          navigate('/matchmaking-new');
          return;
        }

        console.log('[BattleNew] ✅ Match loaded:', data.id);
        setMatch(data as MatchRow);
        return;
      }
    };

    fetchMatch();
  }, [matchId, navigate, match]);

  // Get current user if not set
  useEffect(() => {
    if (!currentUser) {
      const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user.id);
        }
      };
      getUser();
    }
  }, [currentUser]);

  // Use game hook to connect and get question
  const { question, gameStatus, errorMessage } = useGame(match);

  // Render loading state
  if (!match || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Loading match...</h2>
        </div>
      </div>
    );
  }

  // Render error state
  if (gameStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-xl">⚠️ Error</div>
          <p className="text-white">{errorMessage || 'Unknown error'}</p>
          <Button
            onClick={() => navigate('/matchmaking-new')}
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Render connecting/waiting state
  if (gameStatus === 'connecting' || gameStatus === 'waiting_for_round') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">
            {gameStatus === 'connecting' ? 'Connecting to battle...' : 'Waiting for question...'}
          </h2>
        </div>
      </div>
    );
  }

  // Render question when active
  if (gameStatus === 'round_active' && question) {
    const steps = question.steps;
    const options = steps?.options || [];
    const correctAnswer = steps?.answer ?? 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/matchmaking-new')}
              className="text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-white">Battle</h1>
            <p className="text-gray-400">Match ID: {match.id}</p>
          </div>

          {/* Question Card */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20">
            <div className="mb-8">
              <p className="text-xl text-white mb-6">{question.text}</p>
            </div>

            {/* Multiple Choice Options */}
            {steps?.type === 'mcq' && options.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Select your answer:</h3>
                <div className="grid gap-4">
                  {options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        // TODO: Implement answer submission
                        toast.info(`Selected: ${option} (Answer ${index})`);
                      }}
                      className="p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-left text-white transition-colors"
                    >
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Info */}
            <div className="mt-8 text-sm text-slate-400">
              <p>Question ID: {question.id}</p>
              <p>Match ID: {match.id}</p>
              <p>Status: {gameStatus}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <h2 className="text-2xl font-bold text-white">Loading...</h2>
      </div>
    </div>
  );
}

