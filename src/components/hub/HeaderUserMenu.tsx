import { Settings, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function HeaderUserMenu() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/profile')}
        className="gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-primary)',
        }}
        aria-label="Profile"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">Profile</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {}}
        className="gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-primary)',
        }}
        aria-label="Settings"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Settings</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        className="gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-primary)',
        }}
        aria-label="Sign Out"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Sign Out</span>
      </Button>
    </div>
  );
}
