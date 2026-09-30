import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Gate } from '../types.ts';
import { auth, googleProvider, db } from '../firebase/config.ts';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  token: string | null;
  currentGate: Gate | null;
  gates: Gate[];
  isLoading: boolean;
  login: (email: string, password: string, gateId?: string) => Promise<boolean>;
  loginAsDemo: (role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'SECURITY') => Promise<boolean>;
  loginWithGoogle: (gateId?: string) => Promise<boolean>;
  logout: () => void;
  switchGate: (gateId: string) => Promise<void>;
  fetchGates: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fp_token'));
  const [gates, setGates] = useState<Gate[]>([]);
  const [currentGate, setCurrentGate] = useState<Gate | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchGates = async () => {
    try {
      const res = await fetch('/api/gates');
      if (res.ok) {
        const data = await res.json();
        setGates(data);
        if (data.length > 0 && !currentGate) {
          const userGate = user?.assignedGateId
            ? data.find((g: Gate) => g.id === user.assignedGateId) || data[0]
            : data[0];
          setCurrentGate(userGate);
        }
      }
    } catch (err) {
      console.error('Failed to load gates:', err);
    }
  };

  useEffect(() => {
    fetchGates();
  }, []);

  useEffect(() => {
    const checkMe = async () => {
      const storedToken = localStorage.getItem('fp_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
        } else {
          localStorage.removeItem('fp_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkMe();
  }, []);

  useEffect(() => {
    if (gates.length > 0 && user?.assignedGateId) {
      const match = gates.find((g) => g.id === user.assignedGateId);
      if (match) setCurrentGate(match);
    }
  }, [gates, user]);

  const login = async (email: string, password: string, gateId?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, gateId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Login failed');
      }

      const data = await res.json();
      localStorage.setItem('fp_token', data.token);
      setToken(data.token);
      setUser(data.user);

      if (data.user.assignedGateId && gates.length > 0) {
        const match = gates.find((g) => g.id === data.user.assignedGateId);
        if (match) setCurrentGate(match);
      }

      return true;
    } catch (err: any) {
      console.error('Login failed:', err.message);
      throw err;
    }
  };

  const loginAsDemo = async (role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'SECURITY'): Promise<boolean> => {
    const creds: Record<string, { email: string; pass: string }> = {
      ADMIN: { email: 'admin@example.com', pass: 'admin123' },
      MANAGER: { email: 'manager@example.com', pass: 'manager123' },
      RECEPTION: { email: 'reception@example.com', pass: 'reception123' },
      SECURITY: { email: 'security@example.com', pass: 'security123' },
    };
    const c = creds[role];
    return await login(c.email, c.pass);
  };

  // Google Sign-In with Firebase Auth + Firestore Persistence
  const loginWithGoogle = async (gateId?: string): Promise<boolean> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const email = fbUser.email || '';
      const name = fbUser.displayName || 'Google User';

      // 1. Sync to Firestore (Data persistence requirement)
      try {
        await setDoc(
          doc(db, 'users', fbUser.uid),
          {
            id: fbUser.uid,
            email,
            name,
            photoURL: fbUser.photoURL || '',
            lastLogin: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Firestore user sync fallback:', fsErr);
      }

      // 2. Establish app session with backend
      const res = await fetch('/api/auth/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          photoURL: fbUser.photoURL,
          uid: fbUser.uid,
          gateId: gateId || currentGate?.id || 'gate_main',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Firebase auth session failed');
      }

      const data = await res.json();
      localStorage.setItem('fp_token', data.token);
      setToken(data.token);
      setUser(data.user);

      if (data.user.assignedGateId && gates.length > 0) {
        const match = gates.find((g) => g.id === data.user.assignedGateId);
        if (match) setCurrentGate(match);
      }

      return true;
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      throw err;
    }
  };

  const switchGate = async (gateId: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/switch-gate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gateId }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('fp_token', data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.gate) {
          setCurrentGate(data.gate);
        } else {
          const match = gates.find((g) => g.id === gateId);
          if (match) setCurrentGate(match);
        }
      }
    } catch (err) {
      console.error('Failed to switch gate:', err);
    }
  };

  const logout = () => {
    firebaseSignOut(auth).catch(() => {});
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('fp_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        currentGate,
        gates,
        isLoading,
        login,
        loginAsDemo,
        loginWithGoogle,
        logout,
        switchGate,
        fetchGates,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
