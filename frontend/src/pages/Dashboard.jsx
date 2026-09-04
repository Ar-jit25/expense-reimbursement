import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsService } from '../services/reports';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Badge } from '../components/common/Badge';
import { AnalyticsOverview } from '../components/dashboard/AnalyticsOverview';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsService.getReports({ page, limit: 10, search, status, sort });
      setReports(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [page, status, sort]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReports();
  };

  return (
    <div>
      <AnalyticsOverview />

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
              await reportsService.downloadCsv({ status: filterStatus !== 'ALL' ? filterStatus : undefined, search: searchQuery || undefined });
            } catch(e) { alert("Failed to export: " + e.message); }
          }}>
            Export CSV
          </button>
        </div>

        )}
      </div>

      <div className="card mb-6 flex gap-4">
        <form onSubmit={handleSearch} className="flex gap-2" style={{ flex: 1 }}>
          <input 
            className="input" placeholder="Search title..." 
            value={search} onChange={(e) => setSearch(e.target.value)} 
          />
          <button type="submit" className="btn btn-outline">Search</button>
        </form>
        <select className="select" style={{ width: '200px' }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PAID">Paid</option>
        </select>
        <select className="select" style={{ width: '200px' }} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          <option value="createdAt">Newest First</option>
          <option value="submittedAt">Submitted Date</option>
          <option value="total">Total Amount</option>
        </select>
      </div>

      {error && <div className="card bg-red-100 text-red-800 mb-6">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="p-6 text-center text-muted">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-6 text-center text-muted">No reports found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Total</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/reports/${r.id}`)}>
                  <td style={{ fontWeight: 500 }}>{r.title}</td>
                  <td><Badge status={r.status} /></td>
                  <td>{formatCurrency(r.total)}</td>
                  <td>{formatDate(r.createdAt)}</td>
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


