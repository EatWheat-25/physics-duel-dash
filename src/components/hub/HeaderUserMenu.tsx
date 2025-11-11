import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function HeaderUserMenu() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const playerId = profile?.id?.slice(0, 8) || 'XXXXXXXX';

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-primary)',
        }}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">ID: {playerId}</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              className="absolute right-0 top-full mt-2 w-48 z-50"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              role="menu"
              aria-label="User menu options"
            >
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(40px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
              >
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--violet)]"
                  style={{ color: 'var(--text-primary)' }}
                  role="menuitem"
                >
                  <User className="w-4 h-4" />
                  <span className="font-medium text-sm">Profile</span>
                </button>

                <div
                  className="h-px"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                  role="separator"
                />

                <button
                  onClick={() => {
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--violet)]"
                  style={{ color: 'var(--text-primary)' }}
                  role="menuitem"
                >
                  <Settings className="w-4 h-4" />
                  <span className="font-medium text-sm">Settings</span>
                </button>

                <div
                  className="h-px"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                  role="separator"
                />

                <button
                  onClick={() => {
                    setIsOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--violet)]"
                  style={{ color: 'var(--text-primary)' }}
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium text-sm">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
