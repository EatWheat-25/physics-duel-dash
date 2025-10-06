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

const ADMIN_CODE = "NEURAL2024"; // Admin access code

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

    if (code !== ADMIN_CODE) {
      toast.error('Invalid admin code');
      return;
    }

    setLoading(true);

    try {
      // Add user to admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'admin' });

      if (error) {
        // Check if already admin
        if (error.code === '23505') { // Unique constraint violation
          toast.success('You already have admin access!');
        } else {
          throw error;
        }
      } else {
        toast.success('Admin access granted!');
      }

      // Redirect to admin dashboard
      setTimeout(() => {
        navigate('/admin/questions');
      }, 1000);
    } catch (error) {
      console.error('Error granting admin access:', error);
      toast.error('Failed to grant admin access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-background/90 p-4">
      <Card className="w-full max-w-md p-8">
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

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            Admin code: <span className="font-mono font-bold">NEURAL2024</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
