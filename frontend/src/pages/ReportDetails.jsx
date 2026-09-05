import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportsService } from '../services/reports';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Badge } from '../components/common/Badge';

export default function ReportDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await reportsService.getReport(id);
      setReport(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  const handleAction = async (actionFn, ...args) => {
    try {
      setIsProcessing(true);
      setActionError(null);
      await actionFn(id, ...args);
      await fetchReport();
      setShowRejectInput(false);
      setRejectReason('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-muted">Loading report details...</div>;
  if (error) return <div className="p-6 card bg-red-100 text-red-800 m-6">{error}</div>;
  if (!report) return <div className="p-6 text-center">Report not found</div>;

  const total = report.lines?.reduce((acc, line) => acc + parseFloat(line.amount), 0) || 0;
  
  // Authorization rules
  const isOwner = report.ownerId === user.id;
  const isApprover = user.role === 'APPROVER';
  const isAssigned = report.approvers?.some(a => a.approverId === user.id);

  // Find latest rejection reason from history
  const rejectionEntry = report.history?.find(h => h.toStatus === 'REJECTED');
  const rejectionReason = rejectionEntry?.reason;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{report.title}</h1>
          <p className="text-muted mt-2">
            {formatDate(report.dateFrom)} - {formatDate(report.dateTo)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge status={report.status} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(total)}</h2>
        </div>
      </div>

      {report.status === 'REJECTED' && rejectionReason && (
        <div className="card mb-6" style={{ borderLeft: '4px solid #ef4444', backgroundColor: '#fef2f2', padding: '1rem 1.5rem' }}>
          <strong style={{ color: '#dc2626' }}>Rejection Reason:</strong>
          <p className="mt-1" style={{ color: '#991b1b' }}>{rejectionReason}</p>
        </div>
      )}

      {actionError && <div className="card bg-red-100 text-red-800 mb-6">{actionError}</div>}

      <div className="card mb-6">
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Expense Lines</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {report.lines?.map((line) => (
              <tr key={line.id}>
                <td>{formatDate(line.date)}</td>
                <td>{line.category}</td>
                <td>{line.description}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(line.amount)}</td>
              </tr>
            ))}
            {(!report.lines || report.lines.length === 0) && (
              <tr><td colSpan="4" className="text-center text-muted p-4">No expense lines attached.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {report.history && report.history.length > 0 && (
        <div className="card mb-6">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>History</h3>
          {report.history.map((entry, idx) => (
            <div key={idx} className="flex items-start gap-3 mb-3 pb-3" style={{ borderBottom: idx < report.history.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: entry.toStatus === 'REJECTED' ? '#ef4444' : entry.toStatus === 'APPROVED' || entry.toStatus === 'PAID' ? '#22c55e' : '#6366f1', marginTop: '4px', flexShrink: 0 }} />
              <div>
                <p className="text-sm">
                  <strong>{formatDate(entry.createdAt)}</strong>{' '}
                  {entry.fromStatus ? `${entry.fromStatus} ? ` : ''}<strong>{entry.toStatus}</strong>
                  {' '}by <strong>{entry.actor?.name || entry.actorId}</strong>
                </p>
                {entry.reason && (
                  <p className="text-sm mt-1" style={{ color: '#dc2626' }}>
                    Reason: {entry.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ACTION BAR */}
      <div className="flex gap-4 border-t pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>Back</button>

        {/* Draft owner can edit or submit */}
        {isOwner && report.status === 'DRAFT' && (
          <>
            <button className="btn btn-outline" onClick={() => navigate(`/reports/${id}/edit`)}>
              Edit Report
            </button>
            <button className="btn btn-primary" disabled={isProcessing} onClick={() => handleAction(reportsService.submitReport)}>
              Submit Report
            </button>
          </>
        )}

        {/* Owner can archive submitted / approved / paid */}
        {isOwner && ['SUBMITTED', 'APPROVED', 'PAID'].includes(report.status) && !report.archived && (
          <button className="btn btn-outline" disabled={isProcessing} onClick={() => handleAction(reportsService.archiveReport)}>
            Archive
          </button>
        )}

        {/* Owner can restore archived */}
        {isOwner && report.archived && (
          <button className="btn btn-outline" disabled={isProcessing} onClick={() => handleAction(reportsService.restoreReport)}>
            Restore
          </button>
        )}

        {/* Owner can reset rejected to draft */}
        {isOwner && report.status === 'REJECTED' && (
          <button className="btn btn-outline" disabled={isProcessing} onClick={() => handleAction(reportsService.resetToDraft)}>
            Reset to Draft
          </button>
        )}

        {/* Assigned approver actions */}
        {isApprover && isAssigned && report.status === 'SUBMITTED' && !showRejectInput && (
          <>
            <button className="btn btn-success" disabled={isProcessing} onClick={() => handleAction(reportsService.approveReport)}>
              Approve
            </button>
            <button className="btn btn-danger" disabled={isProcessing} onClick={() => setShowRejectInput(true)}>
              Reject...
            </button>
          </>
        )}

        {isApprover && isAssigned && report.status === 'APPROVED' && (
          <button className="btn btn-primary" disabled={isProcessing} onClick={() => handleAction(reportsService.payReport)}>
            Mark as Paid
          </button>
        )}

        {showRejectInput && (
          <div className="flex gap-2 items-center">
            <input 
              className="input" placeholder="Rejection reason (required)..." 
              value={rejectReason} onChange={e => setRejectReason(e.target.value)} 
            />
            <button className="btn btn-danger" disabled={isProcessing || !rejectReason.trim()} onClick={() => handleAction(reportsService.rejectReport, rejectReason)}>Confirm Reject</button>
            <button className="btn btn-outline" onClick={() => setShowRejectInput(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
