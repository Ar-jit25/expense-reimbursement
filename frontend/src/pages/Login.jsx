import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Step 1: Authenticate with Supabase
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (supabaseError) {
        setError(supabaseError.message);
        return;
      }

      // Step 2: Send the real JWT to the backend. AuthContext.login() calls /api/me
      // to verify the user is an authorized application member and retrieves their role.
      const result = await login(data.session.access_token);

      if (!result.success) {
        // Supabase authenticated them, but they are not an authorized application user.
        setError(result.error);
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: '100vh', backgroundColor: '#f1f5f9' }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem 2rem',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
        }}
      >
        {/* Application Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em' }}>
            Expense Reimbursement
          </h1>
          <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Sign in to your account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#334155' }}
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="input"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#334155' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.75rem', marginTop: '0.5rem', fontSize: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* No signup link — this is an invite-only internal portal */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          Access is limited to authorized personnel only.
        </p>
      </div>
    </div>
  );
}
