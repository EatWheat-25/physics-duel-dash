import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUserRole = () => {
  return useQuery({
    queryKey: ['userRole'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user?.id);
      
      if (!user) {
        console.log('No user found');
        return null;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      console.log('User role data:', data, 'Error:', error);
      
      if (error) {
        console.error('Role fetch error:', error);
        return null;
      }
      return data?.role || null;
    },
    staleTime: 0, // Always refetch
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
};

export const useIsAdmin = () => {
  const { data: role, isLoading } = useUserRole();
  return { isAdmin: role === 'admin', isLoading };
};
