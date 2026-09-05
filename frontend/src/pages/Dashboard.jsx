import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsService } from '../services/reports';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Badge } from '../components/common/Badge';
import { AnalyticsOverview } from '../components/dashboard/AnalyticsOverview';
import { checkPolicyViolation } from '../utils/policyLimits';
import { AlertTriangle } from 'lucide-react';
import { Filter } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState('active'); // 'active' | 'archived'
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoring, setRestoring] = useState(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 10, search, sort };
      if (view === 'archived') {
        params.queue = 'archived';
      } else if (status) {
        params.status = status;
      }
      const res = await reportsService.getReports(params);
      setReports(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchReports();
  }, [view, status, sort]);

  useEffect(() => {
    fetchReports();
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReports();
  };

  const handleRestore = async (reportId) => {
    try {
      setRestoring(reportId);
      await reportsService.restoreReport(reportId);
      await fetchReports();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div>
      {user.role === 'APPROVER' && <AnalyticsOverview />}

      <div className="flex justify-between items-center mb-6">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          {user.role === 'EMPLOYEE' ? 'My Reports' : 'All Reports Dashboard'}
        </h1>
        {user.role === 'EMPLOYEE' && (
          <div>
            <button className="btn btn-primary mr-2" onClick={() => navigate('/reports/new')}>
              Create Report
            </button>
            <button className="btn btn-outline" onClick={async () => {
              try {
                await reportsService.downloadCsv({ status: status || undefined, search: search || undefined });
              } catch(e) { alert("Failed to export: " + e.message); }
            }}>
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Active / Archived tabs */}
      <div className="flex gap-2 mb-6">
        <button
          className={`btn ${view === 'active' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setView('active'); setPage(1); }}
        >
          Active Reports
        </button>
        <button
          className={`btn ${view === 'archived' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setView('archived'); setPage(1); setStatus(''); }}
        >
          Archived
        </button>
      </div>

      {view === 'active' && (
        <div className="card mb-6 flex gap-4" style={{ alignItems: 'center' }}>
          <form onSubmit={handleSearch} className="flex gap-2" style={{ flex: 1 }}>
            <input
              className="input search-input-custom" placeholder="Search title..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-search-green">Search</button>
          </form>

          {/* Status filter with grey background and filter symbol */}
          <div className="filter-badge-wrapper" title="Filter by Status">
            <Filter size={15} color="#64748b" />
            <select
              className="filter-select-inline"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAID">Paid</option>
            </select>
          </div>

          {/* Sort filter with grey background and filter symbol */}
          <div className="filter-badge-wrapper" title="Sort Order">
            <Filter size={15} color="#64748b" />
            <select
              className="filter-select-inline"
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
            >
              <option value="createdAt">Newest First</option>
              <option value="submittedAt">Submitted Date</option>
              <option value="total">Total Amount</option>
            </select>
          </div>
        </div>
      )}

      {error && <div className="card bg-red-100 text-red-800 mb-6">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="p-6 text-center text-muted">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-6 text-center text-muted">
            {view === 'archived' ? 'No archived reports.' : 'No reports found.'}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Total</th>
                <th>Created</th>
                {view === 'archived' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  style={{ cursor: view === 'active' ? 'pointer' : 'default' }}
                  onClick={() => { if (view === 'active') navigate(`/reports/${r.id}`); }}
                >
                  <td style={{ fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{r.title}</span>
                      {r.lines && r.lines.some(l => checkPolicyViolation(l.category, l.amount)) && (
                        <span
                          title="⚠️ Exceeds budget policy limits — review carefully"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            color: '#b45309',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fcd34d',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.72rem',
                            fontWeight: 600
                          }}
                        >
                          <AlertTriangle size={13} color="#d97706" />
                          <span>⚠️ Over Budget</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td><Badge status={r.status} /></td>
                  <td>{formatCurrency(r.total)}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  {view === 'archived' && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
                        disabled={restoring === r.id}
                        onClick={() => handleRestore(r.id)}
                      >
                        {restoring === r.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-muted">
            Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-outline" disabled={page * 10 >= total} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
