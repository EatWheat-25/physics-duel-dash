export interface GameStartEvent {
  type: 'game_start';
  question_ids?: string[];
}

export interface ScoreUpdateEvent {
  type: 'score_update';
  p1_score: number;
  p2_score: number;
  time_left?: number;
}

export interface MatchEndEvent {
  type: 'match_end';
  winner_id: string | null;
  final_scores: {
    p1: number;
    p2: number;
  };
  mmr_changes?: {
    [playerId: string]: {
      old: number;
      new: number;
    };
  };
}

export interface OpponentDisconnectEvent {
  type: 'opponent_disconnect';
  reason: string;
  you_win: boolean;
}

export interface PlayerReadyEvent {
  type: 'player_ready';
  player: 'p1' | 'p2';
}

export interface ConnectedEvent {
  type: 'connected';
  player: 'p1' | 'p2';
}

export type ServerEvent =
  | ConnectedEvent
  | PlayerReadyEvent
  | GameStartEvent
  | ScoreUpdateEvent
  | OpponentDisconnectEvent
  | MatchEndEvent;

export interface ReadyMessage {
  type: 'ready';
}

export interface AnswerSubmitMessage {
  type: 'answer_submit';
  question_id: string;
  answer: number;
  marks_earned: number;
}

export interface QuestionCompleteMessage {
  type: 'question_complete';
}

export type ClientMessage = ReadyMessage | AnswerSubmitMessage | QuestionCompleteMessage;

export interface ConnectGameWSOptions {
  matchId: string;
  token: string;
  onConnected?: (event: ConnectedEvent) => void;
  onPlayerReady?: (event: PlayerReadyEvent) => void;
  onGameStart?: (event: GameStartEvent) => void;
  onScoreUpdate?: (event: ScoreUpdateEvent) => void;
  onOpponentDisconnect?: (event: OpponentDisconnectEvent) => void;
  onMatchEnd?: (event: MatchEndEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export function connectGameWS(options: ConnectGameWSOptions): WebSocket {
  const {
    matchId,
    token,
    onConnected,
    onPlayerReady,
    onGameStart,
    onScoreUpdate,
    onOpponentDisconnect,
    onMatchEnd,
    onError,
    onClose,
  } = options;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL not configured');
  }

  const wsUrl = supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  const fullUrl = `${wsUrl}/functions/v1/game-ws?token=${encodeURIComponent(token)}&match_id=${encodeURIComponent(matchId)}`;

  console.log(`WS: Connecting to game-ws for match ${matchId}`);

  const ws = new WebSocket(fullUrl);

  ws.onopen = () => {
    console.log('WS: Connected successfully');
  };

  ws.onmessage = (event) => {
    try {
      const message: ServerEvent = JSON.parse(event.data);
      console.log('WS: Received message:', message.type);

      switch (message.type) {
        case 'connected':
          console.log('WS: Connection confirmed as player', message.player);
          onConnected?.(message);
          break;

        case 'player_ready':
          console.log('WS: Player ready:', message.player);
          onPlayerReady?.(message);
          break;

        case 'game_start':
          console.log('WS: Game started');
          onGameStart?.(message);
          break;

        case 'score_update':
          console.log(`WS: Score update - p1: ${message.p1_score}, p2: ${message.p2_score}`);
          onScoreUpdate?.(message);
          break;

        case 'opponent_disconnect':
          console.log(`WS: Opponent disconnected - reason: ${message.reason}`);
          onOpponentDisconnect?.(message);
          break;

        case 'match_end':
          console.log(`WS: Match ended - winner: ${message.winner_id || 'draw'}`);
          onMatchEnd?.(message);
          break;

        default:
          console.warn('WS: Unknown message type:', (message as any).type);
      }
    } catch (error) {
      console.error('WS: Error parsing message:', error);
      onError?.(new Error('Failed to parse server message'));
    }
  };

  ws.onerror = (event) => {
    console.error('WS: Connection error:', event);
    onError?.(new Error('WebSocket connection error'));
  };

  ws.onclose = (event) => {
    console.log(`WS: Connection closed (code: ${event.code}, reason: ${event.reason})`);
    onClose?.();
  };

  return ws;
}

export function sendReady(ws: WebSocket): void {
  const message: ReadyMessage = { type: 'ready' };
  ws.send(JSON.stringify(message));
  console.log('WS: Sent ready signal');
}

export function sendAnswer(ws: WebSocket, questionId: string, answer: number, marksEarned: number): void {
  const message: AnswerSubmitMessage = {
    type: 'answer_submit',
    question_id: questionId,
    answer,
    marks_earned: marksEarned,
  };
  ws.send(JSON.stringify(message));
  console.log(`WS: Submitted answer for question ${questionId}`);
}

export function sendQuestionComplete(ws: WebSocket): void {
  const message: QuestionCompleteMessage = { type: 'question_complete' };
  ws.send(JSON.stringify(message));
  console.log('WS: Sent question complete');
}
