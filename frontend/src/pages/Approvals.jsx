import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsService } from '../services/reports';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Badge } from '../components/common/Badge';

export default function Approvals() {
  const navigate = useNavigate();
  const [queueType, setQueueType] = useState('assigned'); // 'assigned' or 'submitted'
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsService.getReports({ queue: queueType, page, limit: 10, sort: 'submittedAt' });
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
  }, [queueType, page]);

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Approval Queues</h1>

      <div className="flex gap-4 mb-6">
        <button 
          className={`btn ${queueType === 'assigned' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setQueueType('assigned'); setPage(1); }}
        >
          Assigned to Me
        </button>
        <button 
          className={`btn ${queueType === 'submitted' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setQueueType('submitted'); setPage(1); }}
        >
          Global Submitted Queue
        </button>
      </div>

      {error && <div className="card bg-red-100 text-red-800 mb-6">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="p-6 text-center text-muted">Loading queue...</div>
        ) : reports.length === 0 ? (
          <div className="p-6 text-center text-muted">No reports found in this queue.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Owner ID</th>
                <th>Total</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/reports/${r.id}`)}>
                  <td style={{ fontWeight: 500 }}>{r.title}</td>
                  <td><span className="text-muted text-sm">{r.ownerId}</span></td>
                  <td>{formatCurrency(r.total)}</td>
                  <td>{formatDate(r.submittedAt)}</td>
                  <td><Badge status={r.status} /></td>
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

