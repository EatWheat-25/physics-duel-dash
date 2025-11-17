import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, ArrowLeft } from 'lucide-react';
import { Starfield } from '@/components/Starfield';

export default function AdminLogin() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login first before accessing admin');
      navigate('/auth');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: { adminCode: code }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Admin access granted!');
        setTimeout(() => {
          navigate('/admin/questions');
        }, 1000);
      } else {
        toast.error('Invalid admin code');
      }
    } catch (error) {
      toast.error('Failed to verify admin code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      <Starfield />
      
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black pointer-events-none" />
      
      {/* Circuit Grid */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(0, 217, 255, 0.2) 1px, transparent 1px),
            linear-gradient(0deg, rgba(0, 217, 255, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }} />
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute w-1 h-1 bg-game-neon rounded-full animate-pulse opacity-30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${Math.random() * 15 + 10}s`,
              filter: 'blur(0.5px)'
            }}
          />
        ))}
      </div>
      
      {/* Holographic orbs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle, rgba(0, 217, 255, 0.15) 0%, transparent 70%)`,
          filter: 'blur(40px)'
        }} 
      />
      
      <Card className="relative z-10 w-full max-w-md p-8 bg-card/80 backdrop-blur-sm border-game-border">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/auth')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Admin Access</h1>
          </div>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        <p className="text-muted-foreground text-center mb-6">
          Enter the admin code to gain access to the question management dashboard
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code">Admin Code</Label>
            <Input
              id="code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter admin code"
              required
              className="text-center text-lg tracking-widest"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !user}
          >
            {loading ? 'Verifying...' : 'Grant Admin Access'}
          </Button>

          {!user && (
            <p className="text-sm text-destructive text-center">
              Please login first before accessing admin
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
