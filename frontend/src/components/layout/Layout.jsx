import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FileText, PlusCircle, CheckSquare, LogOut, LayoutDashboard } from 'lucide-react';
import { AlertsBadge } from '../navigation/AlertsBadge';

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="p-6 text-center text-muted">Loading application...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2 style={{ marginBottom: '2rem', fontSize: '1.25rem', fontWeight: 'bold' }}>Expensify</h2>
        
        <nav className="flex flex-col">
          {user.role === 'EMPLOYEE' ? (
            <>
              <NavLink to="/dashboard" className={({isActive}) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <LayoutDashboard size={18} /> My Reports
              </NavLink>
              <NavLink to="/reports/new" className={({isActive}) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <PlusCircle size={18} /> Create Report
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/dashboard" className={({isActive}) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <LayoutDashboard size={18} /> Dashboard
              </NavLink>
              <NavLink to="/approvals" className={({isActive}) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <CheckSquare size={18} /> Approvals Queues
              </NavLink>
              <AlertsBadge />
              <NavLink to="/reports/new" className={({isActive}) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <PlusCircle size={18} /> Create Report
              </NavLink>
            </>
          )}
        </nav>
      </div>
      
      <div className="main-content">
        <header className="header" style={{
          backgroundColor: '#15803d', /* rich green */
          borderBottom: '1px solid #166534',
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem' }}>
            <span>
              {user.name || (user.email ? user.email.split('@')[0] : 'User')}
              {' '}
              <span style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 500,
                textTransform: 'capitalize'
              }}>
                ({user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()) : 'Employee'})
              </span>
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-outline"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              padding: '0.4rem 0.85rem'
            }}
          >
            <LogOut size={16} /> Logout
          </button>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


