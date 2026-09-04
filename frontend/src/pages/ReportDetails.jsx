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
      setActionError(null);
      await actionFn(id, ...args);
      await fetchReport();
      setShowRejectInput(false);
      setRejectReason('');
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) return <div className="p-6 text-center text-muted">Loading report details...</div>;
  if (error) return <div className="p-6 card bg-red-100 text-red-800 m-6">{error}</div>;
  if (!report) return <div className="p-6 text-center">Report not found</div>;

  const total = report.lines?.reduce((acc, line) => acc + parseFloat(line.amount), 0) || 0;
  
  // Authorization rules
  const isOwner = user.role === 'EMPLOYEE' && report.ownerId === user.token; // we use token as id in mock
  const isApprover = user.role === 'APPROVER';
  
  // Actually the backend checks req.user.id. Since token == user.id in our mock, we check if the user is in the approvers list.
  const isAssigned = report.approvers?.some(a => a.approverId === user.token);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{report.title}</h1>
          <p className="text-muted mt-2">Owner ID: {report.ownerId}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge status={report.status} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(total)}</h2>
        </div>
      </div>

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
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Latest History</h3>
          <p className="text-sm">
            <strong>{formatDate(report.history[0].createdAt)}</strong> - 
            Moved from {report.history[0].oldStatus} to {report.history[0].newStatus} 
            by {report.history[0].actorId}
            {report.history[0].reason && ` (Reason: ${report.history[0].reason})`}
          </p>
        </div>
      )}

      {/* ACTION BAR */}
      <div className="flex gap-4 border-t pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>Back</button>

        {isOwner && report.status === 'DRAFT' && (
          <button className="btn btn-primary" disabled={isProcessing} onClick={() => handleAction(reportsService.submitReport)}>
            Submit Report
          </button>
        )}

        {isApprover && report.status === 'SUBMITTED' && (
          <>
            {!isAssigned ? (
              <button className="btn btn-primary" disabled={isProcessing} onClick={() => handleAction(reportsService.assignApprover, user.token)}>
                Assign to Me
              </button>
            ) : (
              <button className="btn btn-outline" disabled={isProcessing} onClick={() => handleAction(reportsService.removeApprover, user.token)}>
                Remove Assignment
              </button>
            )}
          </>
        )}

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

        {showRejectInput && (
          <div className="flex gap-2 items-center">
            <input 
              className="input" placeholder="Rejection reason..." 
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


