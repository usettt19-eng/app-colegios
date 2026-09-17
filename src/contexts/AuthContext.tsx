import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface AuthProfile {
  id: string;
  tenant_id: string;
  role: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthChild {
  id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
  section: string | null;
  photo_url: string | null;
  relationship: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: AuthProfile | null;
  children: AuthChild[];
  loading: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children: reactChildren }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [children, setChildrenList] = useState<AuthChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = async (accessToken: string) => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setProfile(data.profile);
        setChildrenList(data.children || []);
        setError('');
      } else {
        setError(data.error || 'No se pudo cargar el perfil.');
      }
    } catch {
      setError('No se pudo conectar con el servidor SIS.');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.access_token);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.access_token);
      } else {
        setProfile(null);
        setChildrenList([]);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      const message = signInError.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : signInError.message;
      setError(message);
      return { success: false, error: message };
    }
    return { success: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setChildrenList([]);
  };

  return (
    <AuthContext.Provider value={{ session, profile, children, loading, error, signIn, signOut }}>
      {reactChildren}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
