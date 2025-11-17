import { useNavigate } from 'react-router-dom';
import { useMatchStart } from '@/hooks/useMatchStart';

export default function ArenaStart({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { start } = useMatchStart(userId, (id) => navigate(`/battle/${id}`));
  return (
    <button onClick={() => start({ subject: 'Math', mode: 'Ranked' })}>
      Start Battle
    </button>
  );
}
