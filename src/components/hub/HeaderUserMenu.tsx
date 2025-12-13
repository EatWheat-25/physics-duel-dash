import { Settings, LogOut, User, Shield, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/hooks/useUserRole';

export function HeaderUserMenu() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, isLoading } = useIsAdmin();

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/')}
        className="gap-2 font-medium text-white hover:bg-white/10"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
        aria-label="Home"
      >
        <Home className="w-4 h-4" />
        <span className="hidden sm:inline text-sm">Home</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/profile')}
        className="gap-2 font-medium text-white hover:bg-white/10"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
        aria-label="Profile"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline text-sm">Profile</span>
      </Button>

      {/* Admin Button - Only show for users with admin role */}
      {!isLoading && isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/questions')}
          className="gap-2 font-medium text-white hover:bg-white/10"
          style={{
            background: 'rgba(220, 38, 38, 0.2)',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            color: 'rgb(254, 202, 202)',
          }}
          aria-label="Admin Panel"
        >
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline text-sm">Admin</span>
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => { }}
        className="gap-2 font-medium text-white hover:bg-white/10"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
        aria-label="Settings"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline text-sm">Settings</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        className="gap-2 font-medium text-white hover:bg-white/10"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
        aria-label="Sign Out"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline text-sm">Sign Out</span>
      </Button>
    </div>
  );
}
