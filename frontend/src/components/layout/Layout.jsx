import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FileText, PlusCircle, CheckSquare, LogOut, LayoutDashboard } from 'lucide-react';

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
              <NavLink to="/reports/new" className={({isActive}) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <PlusCircle size={18} /> Create Report
              </NavLink>
            </>
          )}
        </nav>
      </div>
      
      <div className="main-content">
        <header className="header">
          <div className="font-medium text-muted">Role: {user.role}</div>
          <button onClick={handleLogout} className="btn btn-outline" style={{ border: 'none', color: '#ef4444' }}>
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

