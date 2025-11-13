import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchStart } from '@/hooks/useMatchStart';

export default function ArenaStart({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { start } = useMatchStart(userId, (id) => navigate(`/battle/${id}`));
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    await start({ subject: 'Math', chapter: 'A1' });
    setBusy(false);
  }

  return (
    <button disabled={busy} onClick={onClick}>
      {busy ? 'Starting…' : 'Start Battle'}
    </button>
  );
}
