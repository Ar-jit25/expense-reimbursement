import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    
    // In Phase 11, we are still using Mock Auth. 
    // In Phase 12, this will be replaced with supabase.auth.signInWithPassword()
    if (email === 'emp@example.com' && password === 'TOKEN_EMP') {
      login('TOKEN_EMP', 'EMPLOYEE');
      navigate('/dashboard');
    } else if (email === 'app@example.com' && password === 'TOKEN_APP1') {
      login('TOKEN_APP1', 'APPROVER');
      navigate('/dashboard');
    } else {
      setError('Invalid mock credentials. Use emp@example.com / TOKEN_EMP or app@example.com / TOKEN_APP1.');
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem 2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0f172a' }}>Expense Reimbursement</h1>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>Sign in to your account</p>
        </div>
        
        {error && <div className="card bg-red-100 text-red-800" style={{ marginBottom: '1.5rem', padding: '0.75rem', fontSize: '0.875rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium" style={{ display: 'block', marginBottom: '0.5rem', color: '#334155' }}>Email Address</label>
            <input 
              type="email" 
              className="input" 
              required 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ display: 'block', marginBottom: '0.5rem', color: '#334155' }}>Password</label>
            <input 
              type="password" 
              className="input" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', marginTop: '1rem' }}>
            Sign In
          </button>
        </form>
        
        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
          <p>Mock Auth Mode Active</p>
        </div>
      </div>
    </div>
  );
}
