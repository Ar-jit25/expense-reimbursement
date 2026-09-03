import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (token, role) => {
    login(token, role);
    navigate('/dashboard');
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>Expense Reimbursement</h1>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>Mock Authentication</p>
        
        <div className="flex flex-col gap-4">
          <button className="btn btn-primary" style={{ padding: '0.75rem' }} onClick={() => handleLogin('TOKEN_EMP', 'EMPLOYEE')}>
            Login as Employee
          </button>
          <button className="btn btn-outline" style={{ padding: '0.75rem' }} onClick={() => handleLogin('TOKEN_APP1', 'APPROVER')}>
            Login as Approver 1
          </button>
          <button className="btn btn-outline" style={{ padding: '0.75rem' }} onClick={() => handleLogin('TOKEN_APP2', 'APPROVER')}>
            Login as Approver 2
          </button>
        </div>
      </div>
    </div>
  );
}
