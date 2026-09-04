import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

/**
 * Fetches the authorized application profile from the backend /api/me endpoint.
 * The role comes EXCLUSIVELY from the application database — never from the client.
 * Returns null if the user is not an authorized application member.
 */
const fetchAppProfile = async (accessToken) => {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  try {
    const response = await fetch(`${apiBase}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return null; // 401, 403, etc.
    return await response.json(); // { id, email, name, role }
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);   // { token, id, email, name, role }
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // On mount: restore existing Supabase session (handles page refresh)
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        const profile = await fetchAppProfile(session.access_token);
        if (profile && mounted) {
          setUser({ token: session.access_token, ...profile });
          localStorage.setItem('authToken', session.access_token);
        }
      }
      if (mounted) setLoading(false);
    };

    initSession();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        localStorage.removeItem('authToken');
        return;
      }
      if (event === 'TOKEN_REFRESHED' && session && user) {
        // Update stored token on refresh
        localStorage.setItem('authToken', session.access_token);
        setUser(prev => prev ? { ...prev, token: session.access_token } : null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Called by Login page after successful supabase.auth.signInWithPassword().
   * Fetches the application profile from backend to verify authorization and get role.
   * Returns { success, error } — Login page handles the error display.
   */
  const login = async (accessToken) => {
    setAuthError(null);
    const profile = await fetchAppProfile(accessToken);
    if (!profile) {
      // Authenticated with Supabase but not an authorized application user.
      await supabase.auth.signOut();
      const msg = 'Access denied: your account is not authorized to access this application.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
    localStorage.setItem('authToken', accessToken);
    setUser({ token: accessToken, ...profile });
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
