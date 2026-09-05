import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Approvals from './pages/Approvals';
import Alerts from './pages/Alerts';
import CreateReport from './pages/CreateReport';
import EditReport from './pages/EditReport';
import ReportDetails from './pages/ReportDetails';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="p-6 text-center text-muted">Authenticating...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route element={<Layout />}>
        {/* All authenticated users */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/reports/new" element={<ProtectedRoute><CreateReport /></ProtectedRoute>} />
        <Route path="/reports/:id/edit" element={<ProtectedRoute><EditReport /></ProtectedRoute>} />
        <Route path="/reports/:id" element={<ProtectedRoute><ReportDetails /></ProtectedRoute>} />
        
        {/* Approver only */}
        <Route path="/alerts" element={
          <ProtectedRoute allowedRoles={['APPROVER']}>
            <Alerts />
          </ProtectedRoute>
        } />
        <Route path="/approvals" element={
          <ProtectedRoute allowedRoles={['APPROVER']}>
            <Approvals />
          </ProtectedRoute>
        } />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}



