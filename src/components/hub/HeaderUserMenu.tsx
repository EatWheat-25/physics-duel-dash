import { Settings, LogOut, User, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function HeaderUserMenu() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // TEMPORARY: Show admin button for ALL logged-in users (for testing)
  // TODO: Fix proper admin role check once Supabase metadata is working
  const isAdmin = !!user; // Show for anyone logged in

  // DEBUG: Log to console
  console.log('[HeaderUserMenu] User:', user?.email);
  console.log('[HeaderUserMenu] Showing admin button:', isAdmin);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/profile')}
        className="gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
        style={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
        }}
        aria-label="Profile"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">Profile</span>
      </Button>

      {/* Admin Button - Shows for all logged-in users (TEMPORARY for testing) */}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/questions')}
          className="gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
          style={{
            background: 'rgba(147, 51, 234, 0.25)',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(147, 51, 234, 0.5)',
            color: 'rgb(196, 181, 253)',
            boxShadow: '0 0 15px rgba(147, 51, 234, 0.4)',
          }}
          aria-label="Admin Panel"
        >
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">Admin</span>
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => { }}
        className="gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
        style={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
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
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
        }}
        aria-label="Sign Out"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Sign Out</span>
      </Button>
    </div>
  );
}
