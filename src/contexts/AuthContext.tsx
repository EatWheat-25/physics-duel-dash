import { createContext, useContext, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type Profile = {
  id: string;
  username: string;
  age: number;
  subjects: { subject: string; level: string }[];
  onboarding_completed: boolean;
};

type AuthContextType = {
  user: any | null;
  session: any | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: auth0User, isAuthenticated, isLoading, logout } = useAuth0();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    
    if (data) {
      setProfile({
        ...data,
        subjects: data.subjects as { subject: string; level: string }[]
      });
    }
    return data;
  };

  const syncAuth0UserToSupabase = async (auth0User: any) => {
    if (!auth0User?.sub) return;

    const userId = auth0User.sub;
    
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile for new Auth0 user
      const { error } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          username: auth0User.name || auth0User.email?.split('@')[0] || 'User',
          age: 18,
          subjects: [],
          onboarding_completed: false
        });

      if (error) {
        console.error("Error creating profile:", error);
      }
    }

    await fetchProfile(userId);
  };

  useEffect(() => {
    if (isLoading) {
      setLoading(true);
      return;
    }

    if (isAuthenticated && auth0User) {
      syncAuth0UserToSupabase(auth0User).finally(() => setLoading(false));
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [isAuthenticated, auth0User, isLoading]);

  const signOut = async () => {
    setProfile(null);
    logout({ logoutParams: { returnTo: window.location.origin + "/auth" } });
  };

  const refreshProfile = async () => {
    if (auth0User?.sub) {
      await fetchProfile(auth0User.sub);
    }
  };

  return (
    <AuthContext.Provider
      value={{ 
        user: auth0User, 
        session: isAuthenticated ? { user: auth0User } : null, 
        profile, 
        loading, 
        signOut, 
        refreshProfile 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
