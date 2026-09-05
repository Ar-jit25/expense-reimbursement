import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsService } from '../services/reports';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Badge } from '../components/common/Badge';

export default function Approvals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [queueType, setQueueType] = useState('assigned'); // 'assigned' or 'submitted'
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

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
    setSelectedIds([]);
    setBulkResult(null);
    fetchReports();
  }, [queueType, page]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(reports.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBulkLoading(true);
      setBulkResult(null);
      const res = await reportsService.bulkApprove(selectedIds);
      setBulkResult(res);
      setSelectedIds([]);
      fetchReports();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    if (!rejectReason || rejectReason.trim() === '') {
      alert("Rejection reason is required.");
      return;
    }
    try {
      setBulkLoading(true);
      setBulkResult(null);
      const res = await reportsService.bulkReject(selectedIds, rejectReason);
      setBulkResult(res);
      setSelectedIds([]);
      setShowRejectInput(false);
      setRejectReason('');
      fetchReports();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setBulkLoading(true);
      await reportsService.downloadCsv({ queue: queueType });
    } catch (err) {
      setError("Failed to export CSV: " + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Approval Queues</h1>
        <button className="btn btn-outline" onClick={handleExportCsv} disabled={bulkLoading}>
          Export CSV (Current Queue)
        </button>
      </div>

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
      
      {bulkResult && (
        <div className="card bg-gray-100 mb-6" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6' }}>
          <h3 className="font-bold mb-2">Bulk Operation Results</h3>
          <p className="text-green-600 mb-1">Successful: {bulkResult.successful?.length || 0}</p>
          <p className="text-red-600 mb-2">Failed: {bulkResult.failed?.length || 0}</p>
          {bulkResult.failed?.length > 0 && (
            <ul className="text-sm text-red-600 list-disc ml-4">
              {bulkResult.failed.map(f => (
                <li key={f.reportId}>Report #{f.reportId}: {f.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="card mb-6 flex justify-between items-center" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
          <span className="font-medium text-blue-800">{selectedIds.length} reports selected</span>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={handleBulkApprove} disabled={bulkLoading}>
              {bulkLoading ? 'Processing...' : 'Approve'}
            </button>
            {!showRejectInput ? (
              <button className="btn btn-danger" onClick={() => setShowRejectInput(true)} disabled={bulkLoading}>
                {bulkLoading ? 'Processing...' : 'Reject'}
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input 
                  className="input" 
                  placeholder="Rejection reason..." 
                  value={rejectReason} 
                  onChange={e => setRejectReason(e.target.value)} 
                />
                <button className="btn btn-danger" disabled={bulkLoading || !rejectReason.trim()} onClick={handleBulkReject}>
                  Confirm Reject
                </button>
                <button className="btn btn-outline" onClick={() => setShowRejectInput(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading && !bulkLoading ? (
          <div className="p-6 text-center text-muted">Loading queue...</div>
        ) : reports.length === 0 ? (
          <div className="p-6 text-center text-muted">No reports found in this queue.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll} 
                    checked={reports.length > 0 && selectedIds.length === reports.length}
                  />
                </th>
                <th>Title</th>
                <th>Owner ID</th>
                <th>Total</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const canOpen = queueType === 'assigned' || (r.approvers && r.approvers.some(a => a.approverId === user.id));
                const rowClick = () => { if (canOpen) navigate(`/reports/${r.id}`) };
                return (
                <tr key={r.id} style={{ cursor: canOpen ? 'pointer' : 'not-allowed', backgroundColor: selectedIds.includes(r.id) ? '#f8fafc' : 'transparent', opacity: canOpen ? 1 : 0.6 }}>
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      disabled={!canOpen}
                      checked={selectedIds.includes(r.id)} 
                      onChange={() => handleSelect(r.id)} 
                    />
                  </td>
                  <td onClick={rowClick} style={{ fontWeight: 500 }}>{r.title}</td>
                  <td onClick={rowClick}><span className="text-muted text-sm">{r.ownerId}</span></td>
                  <td onClick={rowClick}>{formatCurrency(r.total)}</td>
                  <td onClick={rowClick}>{formatDate(r.submittedAt)}</td>
                  <td onClick={rowClick}><Badge status={r.status} /></td>
                </tr>
              )})}
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
