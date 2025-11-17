import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Starfield } from './Starfield';
import TugOfWarBar from './TugOfWarBar';
import { connectGameWS, sendReady, type ServerEvent } from '@/lib/ws';
import { toast } from 'sonner';

interface Match {
  id: string;
  p1: string;
  p2: string;
  subject: string;
  chapter: string;
  state: string;
  p1_score: number;
  p2_score: number;
  winner_id?: string;
  created_at: string;
  ended_at?: string;
}

export const OnlineBattle = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [yourUsername, setYourUsername] = useState<string>('You');
  const [opponentUsername, setOpponentUsername] = useState<string>('Opponent');
  const [connectionState, setConnectionState] = useState<'connecting' | 'waiting_ready' | 'playing' | 'ended'>('connecting');
  const [opponentReady, setOpponentReady] = useState(false);
  const [youReady, setYouReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (!matchId) return;

    const fetchMatch = async () => {
      const { data, error } = await supabase
        .from('matches_new')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching match:', error);
        toast.error('Failed to load match');
        return;
      }

      if (data) {
        console.log('Match loaded:', data);
        setMatch(data as Match);
      }
    };

    fetchMatch();
  }, [matchId]);

  useEffect(() => {
    const fetchUsernames = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !match) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) setYourUsername(profile.username);

      const opponentId = match.p1 === user.id ? match.p2 : match.p1;
      const { data: opponentProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', opponentId)
        .maybeSingle();
      if (opponentProfile) setOpponentUsername(opponentProfile.username);
    };

    fetchUsernames();
  }, [match]);

  useEffect(() => {
    if (!matchId || !currentUser || !match) return;

    const setupWebSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('WS: No access token found');
        toast.error('Authentication error');
        return;
      }

      console.log('WS: Setting up WebSocket connection');

      const ws = connectGameWS({
        matchId,
        token: session.access_token,
        onConnected: (event) => {
          console.log('WS: Connected as', event.player);
          setConnectionState('waiting_ready');
          sendReady(ws);
          setYouReady(true);
          toast.success('Connected to battle server');
        },
        onPlayerReady: (event) => {
          console.log('WS: Player ready event:', event.player);
          if (event.player === 'p1' || event.player === 'p2') {
            const isOpponent = (match.p1 === currentUser && event.player === 'p2') ||
                               (match.p2 === currentUser && event.player === 'p1');
            if (isOpponent) {
              setOpponentReady(true);
            }
          }
        },
        onGameStart: (event) => {
          console.log('WS: Game starting');
          toast.success('Battle begins!');
          setConnectionState('playing');
          setCountdown(3);
        },
        onScoreUpdate: (event) => {
          console.log(`WS: Score update - p1: ${event.p1_score}, p2: ${event.p2_score}`);
          setMatch(prev => prev ? {
            ...prev,
            p1_score: event.p1_score,
            p2_score: event.p2_score,
          } : null);
          if (event.time_left !== undefined) {
            setTimeLeft(event.time_left);
          }
        },
        onOpponentDisconnect: (event) => {
          console.log('WS: Opponent disconnected');
          toast.warning(`Opponent disconnected: ${event.reason}`);
          if (event.you_win) {
            toast.success('You win by forfeit!');
            setTimeout(() => navigate('/'), 5000);
          }
        },
        onMatchEnd: (event) => {
          console.log('WS: Match ended');
          setConnectionState('ended');
          setMatch(prev => prev ? {
            ...prev,
            state: 'ended',
            winner_id: event.winner_id || undefined,
            p1_score: event.final_scores.p1,
            p2_score: event.final_scores.p2,
          } : null);
        },
        onError: (error) => {
          console.error('WS: Error:', error);
          toast.error(`Connection error: ${error.message}`);
        },
        onClose: () => {
          console.log('WS: Connection closed');
          if (connectionState !== 'ended') {
            toast.error('Connection to server lost');
          }
        },
      });

      wsRef.current = ws;
    };

    setupWebSocket();

    return () => {
      if (wsRef.current) {
        console.log('WS: Cleaning up connection');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [matchId, currentUser, match, navigate, connectionState]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      setTimeLeft(300);
    }
  }, [countdown]);

  useEffect(() => {
    if (connectionState === 'playing' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [connectionState, timeLeft]);

  if (!match || !currentUser) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Starfield />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <div className="text-2xl">Loading battle...</div>
        </div>
      </div>
    );
  }

  if (countdown !== null) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Starfield />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 text-center">
          <h2 className="text-3xl font-bold mb-8">Get Ready!</h2>
          <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="text-9xl font-bold text-primary">
            {countdown === 0 ? 'START!' : countdown}
          </motion.div>
          <div className="mt-8 text-xl text-muted-foreground">
            {yourUsername} vs {opponentUsername}
          </div>
        </motion.div>
      </div>
    );
  }

  const isPlayer1 = currentUser === match.p1;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalTime = 300;
  const timeProgress = (timeLeft / totalTime) * 100;

  if (match.state === 'ended' || connectionState === 'ended') {
    const won = match.winner_id === currentUser;
    const draw = !match.winner_id;

    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Starfield />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 text-center">
          <h1 className="text-6xl font-bold mb-4">
            {draw ? 'DRAW!' : won ? 'VICTORY!' : 'DEFEAT'}
          </h1>
          <div className="text-3xl mb-8">
            {match.p1_score} - {match.p2_score}
          </div>
          <Button onClick={() => navigate('/')} size="lg">
            Return to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      <Starfield />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />

      <div className="relative z-10 container mx-auto px-4 py-8 flex-1">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="backdrop-blur-sm bg-card/50 border border-border/50 hover:bg-card/70 hover:border-border">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Leave Match
          </Button>
          <div className="text-2xl font-bold backdrop-blur-sm bg-card/50 px-6 py-2 rounded-xl border border-border/50">
            {match.subject} - {match.chapter}
          </div>
        </div>

        <div className="mb-8">
          <TugOfWarBar position={0} maxSteps={5} />
        </div>

        {connectionState === 'waiting_ready' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-sm bg-card/50 p-8 rounded-2xl border border-border/50 text-center shadow-lg mb-6">
            <h2 className="text-2xl font-bold mb-4">Waiting for players to ready up...</h2>
            <div className="flex justify-center gap-8">
              <div className={`flex items-center gap-2 ${youReady ? 'text-green-500' : 'text-muted-foreground'}`}>
                {youReady ? '✓' : '○'} You {youReady && '(Ready)'}
              </div>
              <div className={`flex items-center gap-2 ${opponentReady ? 'text-green-500' : 'text-muted-foreground'}`}>
                {opponentReady ? '✓' : '○'} {opponentUsername} {opponentReady && '(Ready)'}
              </div>
            </div>
          </motion.div>
        )}

        {connectionState === 'playing' && (
          <>
            <div className="mb-6 backdrop-blur-sm bg-card/50 p-6 rounded-2xl border border-border/50 relative shadow-lg">
              <div className="text-center mb-3">
                <div className="text-4xl font-bold">
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Time Remaining</div>
              </div>
              <Progress value={timeProgress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`p-6 rounded-2xl backdrop-blur-sm border-2 shadow-lg ${isPlayer1 ? 'bg-primary/10 border-primary/50' : 'bg-card/50 border-border/50'}`}>
                <div className="text-xs uppercase tracking-wide mb-2 text-muted-foreground">YOU</div>
                <div className="text-lg font-semibold mb-2 truncate">{yourUsername}</div>
                <div className="text-4xl font-bold">{isPlayer1 ? match.p1_score : match.p2_score}</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`p-6 rounded-2xl backdrop-blur-sm border-2 shadow-lg ${!isPlayer1 ? 'bg-primary/10 border-primary/50' : 'bg-card/50 border-border/50'}`}>
                <div className="text-xs uppercase tracking-wide mb-2 text-muted-foreground">OPPONENT</div>
                <div className="text-lg font-semibold mb-2 truncate">{opponentUsername}</div>
                <div className="text-4xl font-bold">{!isPlayer1 ? match.p1_score : match.p2_score}</div>
              </motion.div>
            </div>
          </>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-sm bg-card/50 p-8 rounded-2xl border border-border/50 text-center shadow-lg">
          <h2 className="text-3xl font-bold mb-4">Battle System Active</h2>
          <p className="text-muted-foreground mb-4">WebSocket connected. Question display and gameplay coming soon.</p>
          <p className="text-sm text-muted-foreground">Match ID: {matchId}</p>
        </motion.div>
      </div>
    </div>
  );
};
