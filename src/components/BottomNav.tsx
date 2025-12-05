import { useNavigate, useLocation } from 'react-router-dom';
import { useSubjectStore } from '@/store/useSubjectStore';

interface BottomNavProps {
  onBattleClick?: () => void;
}

export function BottomNav({ onBattleClick }: BottomNavProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { subject } = useSubjectStore();

  const handleNavigation = (path: string, excludeSubject = false) => {
    if (excludeSubject) {
      navigate(path);
    } else {
      navigate(`${path}?subject=${subject}`);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { label: '📚 Practice', path: '/practice' },
    { label: '📦 Modules', path: '/modules' },
    { label: '⚡ BATTLE!', path: '/matchmaking-new', emphasized: true, excludeSubject: true },
    { label: '📊 Progression', path: '/progression' },
    { label: '🛒 Shop', path: '/shop', excludeSubject: true },
  ];

  return (
    <nav style={{ position: 'fixed', bottom: 'var(--spacing-lg)', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
      <div className="glass-card" style={{ display: 'flex', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm) var(--spacing-md)' }}>
        {navItems.map((item) => {
          const active = isActive(item.path);

          if (item.emphasized) {
            return (
              <button
                key={item.label}
                className="nav-item active"
                onClick={() => {
                  if (onBattleClick) {
                    onBattleClick();
                  } else {
                    handleNavigation(item.path, item.excludeSubject);
                  }
                }}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </button>
            );
          }

          return (
            <button
              key={item.label}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => handleNavigation(item.path, item.excludeSubject)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
