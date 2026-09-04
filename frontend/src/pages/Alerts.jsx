import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { alertsService } from '../services/alerts';
import { formatCurrency } from '../utils/formatters';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await alertsService.getAlerts();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleDismiss = async (reportId) => {
    try {
      await alertsService.dismissAlert(reportId);
      // Remove from list or reload
      await loadAlerts();
    } catch (err) {
      alert(err.message || 'Failed to dismiss alert');
    }
  };

  if (loading) return <div className="p-6 text-center text-muted">Loading alerts...</div>;
  if (error) return <div className="p-6 text-center" style={{ color: 'var(--danger-color)' }}>{error}</div>;

  return (
    <div className="alerts-page" style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Stale Approval Alerts</h1>
      
      {alerts.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
          No stale reports requiring your attention. You're all caught up!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{
              background: 'var(--card-bg)', border: '1px solid var(--danger-color)', 
              borderRadius: '8px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  <Link to={`/reports/${alert.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
                    {alert.title}
                  </Link>
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Submitted by {alert.owner.name} ({alert.owner.email}) on {new Date(alert.submittedAt).toLocaleDateString()}
                </p>
                <p style={{ fontWeight: '500', marginTop: '0.5rem' }}>
                  Total: {formatCurrency(alert.total)}
                </p>
              </div>
              <div>
                <button 
                  onClick={() => handleDismiss(alert.id)}
                  className="btn"
                  style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
