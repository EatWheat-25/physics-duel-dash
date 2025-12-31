import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MatchupIntro } from '@/components/battle/MatchupIntro';
import { useElevatorShutter } from '@/components/transitions/ElevatorShutterTransition';
import { createShutterGate } from '@/lib/shutterGate';
import { BattleHudShell } from '@/components/battle/BattleHudShell';
import type { MatchRow } from '@/types/schema';

export default function VersusScreen() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { startMatch: startShutterMatch } = useElevatorShutter();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [myDisplayName, setMyDisplayName] = useState<string>('YOU');
  const [oppDisplayName, setOppDisplayName] = useState<string>('OPPONENT');
  const [matchupActive, setMatchupActive] = useState<boolean>(false);
  const [hasNavigated, setHasNavigated] = useState<boolean>(false);

  console.log('[VersusScreen] Component rendered', { matchId, hasMatch: !!match, hasUser: !!currentUser });

  // Fetch match data
  useEffect(() => {
    console.log('[VersusScreen] Mounted with matchId:', matchId, 'location.state:', location.state);
    
    const stateMatch = location.state?.match as MatchRow | undefined;
    if (stateMatch && stateMatch.id === matchId) {
      console.log('[VersusScreen] Using match from location.state:', stateMatch.id);
      setMatch(stateMatch);
      return;
    }

    if (!matchId) {
      console.error('[VersusScreen] No match ID provided');
      toast.error('No match ID provided');
      navigate('/matchmaking-new');
      return;
    }

    const fetchMatch = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        navigate('/matchmaking-new');
        return;
      }
      setCurrentUser(user.id);

      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      console.log('[VersusScreen] Fetched match:', { data: data?.id, error });

      if (error || !data) {
        console.error('[VersusScreen] Match not found:', error);
        toast.error('Match not found');
        navigate('/matchmaking-new');
        return;
      }

      if (data.player1_id !== user.id && data.player2_id !== user.id) {
        toast.error('You are not part of this match');
        navigate('/matchmaking-new');
        return;
      }

      setMatch(data as MatchRow);
    };

    fetchMatch();
  }, [matchId, navigate, location.state]);

  // Fetch current user if not set
  useEffect(() => {
    if (!currentUser) {
      const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUser(user.id);
      };
      getUser();
    }
  }, [currentUser]);

  // Fetch display names for both players
  useEffect(() => {
    if (!match || !currentUser) return;

    const myId = currentUser;
    const opponentUserId = match.player1_id === myId ? match.player2_id : match.player1_id;
    const ids = [myId, opponentUserId].filter(Boolean) as string[];
    if (ids.length === 0) return;

    let cancelled = false;

    const fetchNames = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', ids);

      if (cancelled) return;

      if (error || !data) {
        console.warn('[VersusScreen] Failed to fetch profile names', error);
        setMyDisplayName('YOU');
        setOppDisplayName('OPPONENT');
        return;
      }

      const byId = new Map<string, string>();
      data.forEach((p: any) => {
        const name = (p.display_name ?? p.username ?? 'Player') as string;
        byId.set(p.id, name);
      });

      setMyDisplayName(byId.get(myId) ?? 'YOU');
      if (opponentUserId) {
        setOppDisplayName(byId.get(opponentUserId) ?? 'OPPONENT');
      } else {
        setOppDisplayName('OPPONENT');
      }
    };

    fetchNames();
    return () => {
      cancelled = true;
    };
  }, [match, currentUser]);

  // Activate matchup animation after a brief delay
  useEffect(() => {
    if (!match || !currentUser) return;
    const timer = setTimeout(() => {
      setMatchupActive(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [match, currentUser]);

  // Navigate to battle after animation completes
  const handleAnimationComplete = () => {
    if (hasNavigated || !match) return;
    
    // Wait a bit longer (total ~4-5 seconds) before navigating
    setTimeout(() => {
      if (hasNavigated) return;
      setHasNavigated(true);

      const { id: shutterGateId, promise } = createShutterGate();

      startShutterMatch({
        message: 'STARTING BATTLE',
        waitFor: promise,
        onClosed: () => {
          navigate(`/online-battle-new/${match.id}`, {
            state: { match, shutterGateId },
          });
        },
      }).catch((err) => {
        console.error('[VersusScreen] Shutter transition failed, falling back to direct navigation', err);
        navigate(`/online-battle-new/${match.id}`, {
          state: { match },
        });
      });
    }, 3500); // Additional 3.5 seconds after animation completes (~0.9s animation + 3.5s = ~4.4s total)
  };

  if (!match || !currentUser) {
    return (
      <BattleHudShell className="font-sans selection:bg-blue-500/30">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full animate-pulse" />
              </div>
            </div>
            <p className="text-blue-200/70 font-mono tracking-widest text-sm">MATCH FOUND</p>
          </div>
        </div>
      </BattleHudShell>
    );
  }

  return (
    <BattleHudShell className="font-sans selection:bg-blue-500/30">
      <main className="flex-1 flex items-center justify-center">
        <MatchupIntro
          left={{ name: myDisplayName, subtitle: 'YOU' }}
          right={{ name: oppDisplayName, subtitle: 'OPPONENT' }}
          active={matchupActive}
          onComplete={handleAnimationComplete}
        />
      </main>
    </BattleHudShell>
  );
}

