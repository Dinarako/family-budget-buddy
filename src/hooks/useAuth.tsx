import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { LocalUser } from '@/lib/types';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: LocalUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const stored = localStorage.getItem('auth_user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiRequest<{ token: string; user: LocalUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      setUser(data.user);
      toast({ title: 'Welcome back!', description: "You've been logged in successfully." });
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Login failed');
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      });
      toast({
        title: 'Account created!',
        description: 'Your account has been created. You can now log in.',
      });
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Signup failed');
      toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
      return { error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    toast({ title: 'Signed out', description: 'You have been signed out successfully.' });
  };

  const resetPassword = async (email: string, newPassword: string) => {
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, newPassword }),
      });
      toast({
        title: 'Password reset!',
        description: 'Your password has been updated. You can now log in.',
      });
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Reset failed');
      toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      await apiRequest('/api/auth/update-password', {
        method: 'PUT',
        body: JSON.stringify({ newPassword }),
      });
      toast({ title: 'Success!', description: 'Your password has been updated.' });
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Password update failed');
      toast({ title: 'Password update failed', description: error.message, variant: 'destructive' });
      return { error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
