import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsAdmin } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';

export function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast.error('Access denied: Admin privileges required');
      navigate('/');
    }
  }, [isAdmin, isLoading, navigate]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-purple-400 animate-pulse" />
          <Loader2 className="w-8 h-8 mx-auto text-purple-400 animate-spin" />
          <p className="text-white/70 text-sm font-medium">Verifying admin access...</p>
        </div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }
  
  return <>{children}</>;
}


