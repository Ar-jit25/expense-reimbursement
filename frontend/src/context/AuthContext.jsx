import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const fetchAppProfile = async (accessToken) => {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  try {
    const response = await fetch(`${apiBase}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        error: true, 
        status: response.status, 
        message: errorData.error || 'Server rejected authorization.' 
      };
    }
    
    const data = await response.json();
    return { error: false, data };
  } catch (err) {
    console.error("fetchAppProfile network error:", err);
    return { 
      error: true, 
      status: 0, 
      message: 'Network or CORS error. Please check browser console and VITE_API_URL / FRONTEND_URL env vars.' 
    };
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        const result = await fetchAppProfile(session.access_token);
        if (!result.error && mounted) {
          setUser({ token: session.access_token, ...result.data });
          localStorage.setItem('authToken', session.access_token);
        }
      }
      if (mounted) setLoading(false);
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        localStorage.removeItem('authToken');
        return;
      }
      if (event === 'TOKEN_REFRESHED' && session && user) {
        localStorage.setItem('authToken', session.access_token);
        setUser(prev => prev ? { ...prev, token: session.access_token } : null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (accessToken) => {
    setAuthError(null);
    const result = await fetchAppProfile(accessToken);
    
    if (result.error) {
      await supabase.auth.signOut();
      
      let msg = result.message;
      if (result.status === 403) {
        msg = 'Access denied: your account is not authorized to access this application.';
      }
      
      setAuthError(msg);
      return { success: false, error: msg };
    }
    
    localStorage.setItem('authToken', accessToken);
    setUser({ token: accessToken, ...result.data });
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthError(null);
    localStorage.removeItem('authToken');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
};
