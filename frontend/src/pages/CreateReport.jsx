import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsService } from '../services/reports';
import { Trash2, Car, AlertTriangle } from 'lucide-react';
import MileageCalculatorModal from '../components/common/MileageCalculatorModal';
import { checkPolicyViolation } from '../utils/policyLimits';
import { formatCurrency } from '../utils/formatters';

export default function CreateReport() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lines, setLines] = useState([{ date: '', amount: '', category: 'TRAVEL', description: '' }]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showMileageModal, setShowMileageModal] = useState(false);

  const total = lines.reduce((acc, line) => acc + (parseFloat(line.amount) || 0), 0);

  const addLine = () => setLines([...lines, { date: '', amount: '', category: 'TRAVEL', description: '' }]);
  
  const removeLine = (idx) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const updateLine = (idx, field, value) => {
    const newLines = [...lines];
    newLines[idx][field] = value;
    setLines(newLines);
  };
  const handleApplyMileage = (mileageData) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = dateFrom || todayStr;
    
    // If the first line is empty, replace it, otherwise append
    if (lines.length === 1 && !lines[0].date && !lines[0].amount && !lines[0].description) {
      setLines([{ date: targetDate, ...mileageData }]);
    } else {
      setLines([...lines, { date: targetDate, ...mileageData }]);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) return setError('Title is required');
    
    try {
      setSaving(true);
      setError(null);
      
      if (!dateFrom) return setError('Date From is required');
    if (!dateTo) return setError('Date To is required');
      if (new Date(dateFrom) > new Date(dateTo)) return setError('Date From cannot be after Date To');
    const report = await reportsService.createReport({ title, dateFrom, dateTo });
      
      for (const line of lines) {
        if (line.date && line.amount && line.category && line.description) {
          await reportsService.addExpenseLine(report.id, {
            ...line,
            amount: parseFloat(line.amount)
          });
        }
      }
      navigate(`/reports/${report.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Create New Expense Report</h1>
      
      {error && <div className="card bg-red-100 text-red-800 mb-6">{error}</div>}

      <form onSubmit={handleSubmit} className="card create-report-card">
        <div className="mb-6">
          <label className="text-sm font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Report Title</label>
          <input className="input" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Q3 Sales Trip to NYC" />
        </div>

        <div className="flex gap-4 mb-6">
          <div style={{ flex: 1 }}>
            <label className="text-sm font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Date From</label>
            <input type="date" className="input" required value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="text-sm font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Date To</label>
            <input type="date" className="input" required value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Expense Lines</h3>
          <button
            type="button"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', borderColor: '#16a34a', color: '#16a34a' }}
            onClick={() => setShowMileageModal(true)}
          >
            <Car size={16} /> Calculate Mileage
          </button>
        </div>
        
        {lines.map((line, idx) => (
          <div key={idx} className="flex gap-4 items-center mb-4 p-4 bg-gray-100" style={{ borderRadius: '0.375rem' }}>
            <div className="flex flex-col gap-2" style={{ flex: 1 }}>
              <input type="date" className="input" required value={line.date} onChange={e => updateLine(idx, 'date', e.target.value)} />
              <input type="number" step="0.01" min="0.01" className="input" required placeholder="Amount" value={line.amount} onChange={e => updateLine(idx, 'amount', e.target.value)} />
            </div>
            <div className="flex flex-col gap-2" style={{ flex: 2 }}>
              <select className="select" value={line.category} onChange={e => updateLine(idx, 'category', e.target.value)}>
                <option value="TRAVEL">Travel</option>
                <option value="MEALS">Meals</option>
                <option value="ACCOMMODATION">Accommodation</option>
                <option value="SUPPLIES">Supplies</option>
                <option value="SOFTWARE">Software</option>
                <option value="EQUIPMENT">Equipment</option>
                <option value="OTHER">Other</option>
              </select>
              <input type="text" className="input" required placeholder="Description / Vendor" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
            </div>

            {/* Policy Warning if amount exceeds threshold */}
            {(() => {
              const warning = checkPolicyViolation(line.category, line.amount);
              if (!warning) return null;
              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.4rem',
                  fontSize: '0.72rem',
                  color: '#92400e',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.375rem',
                  maxWidth: '220px',
                  lineHeight: '1.25'
                }} title={warning.warningMessage}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Exceeds ${warning.limit} limit</div>
                    <div style={{ color: '#b45309' }}>Kindly document the reason in the description.</div>
                  </div>
                </div>
              );
            })()}

            <button type="button" onClick={() => removeLine(idx)} className="btn btn-outline" style={{ color: 'var(--danger-color)', border: 'none', padding: '0.5rem' }}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}

        <div className="flex justify-between items-center mt-4">
          <button type="button" onClick={addLine} className="btn btn-outline">+ Add Expense Line</button>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Total: ${total.toFixed(2)}</div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/dashboard')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft Report'}
          </button>
        </div>
      </form>
      <MileageCalculatorModal
        isOpen={showMileageModal}
        onClose={() => setShowMileageModal(false)}
        onApply={handleApplyMileage}
      />
    </div>
  );
}



