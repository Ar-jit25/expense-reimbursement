import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { alertsService } from '../services/alerts';
import { formatCurrency } from '../utils/formatters';
import { RefreshCw } from 'lucide-react';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dismissingId, setDismissingId] = useState(null);

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
    // Poll every 5 hours (5 * 60 * 60 * 1000 ms) for periodic recalculation
    const interval = setInterval(loadAlerts, 5 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (reportId) => {
    try {
      setDismissingId(reportId);
      await alertsService.dismissAlert(reportId);
      await loadAlerts();
    } catch (err) {
      alert(err.message || 'Failed to dismiss alert');
    } finally {
      setDismissingId(null);
    }
  };

  const getTimeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays >= 1) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    }
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours >= 1) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    return `${diffMins} minutes ago`;
  };

  return (
    <div className="alerts-page" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Stale Approval Alerts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Reports submitted &gt; 5 days ago without decision. Stale calculations and recurrence repeat every 5 hours.
          </p>
        </div>
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && alerts.length === 0 ? (
        <div className="p-6 text-center text-muted">Loading alerts...</div>
      ) : error ? (
        <div className="p-6 text-center" style={{ color: 'var(--danger-color)' }}>{error}</div>
      ) : alerts.length === 0 ? (
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
                  Submitted by {alert.owner?.name || 'Unknown'} ({alert.owner?.email || ''}) &bull; {getTimeAgo(alert.submittedAt)} ({new Date(alert.submittedAt).toLocaleDateString()})
                </p>
                <p style={{ fontWeight: '500', marginTop: '0.5rem' }}>
                  Total: {formatCurrency(alert.total)}
                </p>
              </div>
              <div>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  disabled={dismissingId === alert.id}
                  className="btn"
                  style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                >
                  {dismissingId === alert.id ? 'Dismissing...' : 'Dismiss'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}