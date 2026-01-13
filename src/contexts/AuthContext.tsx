import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string, username?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize user from cache for immediate offline access
function getCachedUser(): User | null {
  const cachedUserId = localStorage.getItem("reppy_user_id");
  const cachedEmail = localStorage.getItem("reppy_user_email");
  if (cachedUserId) {
    return { id: cachedUserId, email: cachedEmail } as User;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with cached user for immediate offline access
  const [user, setUser] = useState<User | null>(getCachedUser);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Cache user ID for offline access
      if (currentUser) {
        localStorage.setItem("reppy_user_id", currentUser.id);
        localStorage.setItem("reppy_user_email", currentUser.email || "");
      }

      setLoading(false);
    }).catch(() => {
      // If offline, try to restore from cache
      const cachedUserId = localStorage.getItem("reppy_user_id");
      const cachedEmail = localStorage.getItem("reppy_user_email");
      if (cachedUserId) {
        // Create minimal user object for offline use
        setUser({ id: cachedUserId, email: cachedEmail } as User);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // Cache user ID for offline access
        if (currentUser) {
          localStorage.setItem("reppy_user_id", currentUser.id);
          localStorage.setItem("reppy_user_email", currentUser.email || "");
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string, username?: string) => {
    // Generate username from email if not provided
    const generatedUsername = username || email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") + Math.floor(Math.random() * 1000);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          username: generatedUsername,
        },
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    // Используем local scope чтобы избежать 403 ошибок при истекшей сессии
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    // Игнорируем ошибку "Auth session missing" - пользователь уже вышел
    if (error && error.message !== 'Auth session missing!') {
      throw error;
    }
    // Clear cached user data
    localStorage.removeItem("reppy_user_id");
    localStorage.removeItem("reppy_user_email");
    // Принудительно очищаем состояние на клиенте
    setSession(null);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword }}>
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
