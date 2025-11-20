export interface GameStartEvent {
  type: 'game_start';
  question: any; // Single question object with steps
  ordinal: number;
  total_questions: number;
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

export interface NextQuestionEvent {
  type: 'next_question';
  question: any;
  ordinal: number;
  total_questions: number;
}

export interface AnswerResultEvent {
  type: 'answer_result';
  player: 'p1' | 'p2';
  is_correct: boolean;
  marks_earned: number;
  explanation: string;
}

export type ServerEvent =
  | ConnectedEvent
  | PlayerReadyEvent
  | GameStartEvent
  | NextQuestionEvent
  | AnswerResultEvent
  | ScoreUpdateEvent
  | OpponentDisconnectEvent
  | MatchEndEvent;

export interface ReadyMessage {
  type: 'ready';
}

export interface AnswerSubmitMessage {
  type: 'answer_submit';
  question_id: string;
  step_id: string;
  answer: number;
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
  onNextQuestion?: (event: NextQuestionEvent) => void;
  onAnswerResult?: (event: AnswerResultEvent) => void;
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
    onNextQuestion,
    onAnswerResult,
    onScoreUpdate,
    onOpponentDisconnect,
    onMatchEnd,
    onError,
    onClose,
  } = options;

  const supabaseUrl = 'https://qvunaswogfwhixecjpcn.supabase.co';
  const wsUrl = supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  const fullUrl = `${wsUrl}/functions/v1/game-ws?token=${encodeURIComponent(token)}&match_id=${encodeURIComponent(matchId)}`;

  console.log(`WS: Connecting to game-ws for match ${matchId}`);
  console.log('WS: Full URL:', fullUrl.substring(0, 100) + '...');

  const ws = new WebSocket(fullUrl);

  // Add timeout for connection
  const connectionTimeout = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      console.error('WS: Connection timeout after 10 seconds');
      ws.close();
      onError?.(new Error('WebSocket connection timeout'));
    }
  }, 10000);

  ws.onopen = () => {
    clearTimeout(connectionTimeout);
    console.log('WS: Connected successfully, readyState:', ws.readyState);
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
          console.log('WS: game_start message:', JSON.stringify(message, null, 2));
          console.log('WS: question exists:', !!message.question);
          console.log('WS: question.steps exists:', !!message.question?.steps);
          console.log('WS: question.steps length:', message.question?.steps?.length);
          onGameStart?.(message);
          break;

        case 'next_question':
          console.log('WS: Next question received');
          onNextQuestion?.(message);
          break;

        case 'answer_result':
          console.log(`WS: Answer result - correct: ${message.is_correct}, marks: ${message.marks_earned}`);
          onAnswerResult?.(message);
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
    clearTimeout(connectionTimeout);
    console.error('WS: Connection error:', event);
    console.error('WS: Error type:', event.type);
    console.error('WS: ReadyState:', ws.readyState);
    onError?.(new Error('WebSocket connection failed'));
  };

  ws.onclose = (event) => {
    clearTimeout(connectionTimeout);
    console.log(`WS: Connection closed (code: ${event.code}, reason: ${event.reason || 'none'}, wasClean: ${event.wasClean})`);
    onClose?.();
  };

  return ws;
}

export function sendReady(ws: WebSocket): void {
  const message: ReadyMessage = { type: 'ready' };
  ws.send(JSON.stringify(message));
  console.log('WS: Sent ready signal');
}

export function sendAnswer(ws: WebSocket, questionId: string, stepId: string, answer: number): void {
  const message: AnswerSubmitMessage = {
    type: 'answer_submit',
    question_id: questionId,
    step_id: stepId,
    answer,
  };
  ws.send(JSON.stringify(message));
  console.log(`WS: Submitted answer for question ${questionId}, step ${stepId}`);
}

export function sendQuestionComplete(ws: WebSocket): void {
  const message: QuestionCompleteMessage = { type: 'question_complete' };
  ws.send(JSON.stringify(message));
  console.log('WS: Sent question complete');
}
