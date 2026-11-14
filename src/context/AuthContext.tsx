import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface SyncedProfile {
  id: number;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  profile: SyncedProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SyncedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncUserToBackend = useCallback(async (firebaseUser: User) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          displayName: firebaseUser.displayName || '',
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { user?: SyncedProfile };
        if (data.user) setProfile(data.user);
      }
    } catch {
      // Keep Firebase user signed in even if backend sync retries later
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await syncUserToBackend(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [syncUserToBackend]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (result.user) {
        await syncUserToBackend(result.user);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in could not be completed.';
      setError(message);
    }
  }, [syncUserToBackend]);

  const logout = useCallback(async () => {
    setError(null);
    await signOut(auth);
    setProfile(null);
  }, []);

  const getToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        signInWithGoogle,
        logout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
