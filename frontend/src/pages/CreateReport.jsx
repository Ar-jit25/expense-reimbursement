import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsService } from '../services/reports';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function CreateReport() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState([{ date: '', amount: '', category: 'TRAVEL', description: '' }]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) return setError('Title is required');
    
    try {
      setSaving(true);
      setError(null);
      
      const report = await reportsService.createReport({ title });
      
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

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-6">
          <label className="text-sm font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Report Title</label>
          <input className="input" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Q3 Sales Trip to NYC" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Expense Lines</h3>
        
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
                <option value="OFFICE_SUPPLIES">Office Supplies</option>
                <option value="OTHER">Other</option>
              </select>
              <input className="input" required placeholder="Description" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
            </div>
            {lines.length > 1 && (
              <button type="button" className="btn btn-outline" style={{ color: '#ef4444' }} onClick={() => removeLine(idx)}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}

        <div className="flex justify-between items-center mt-6 pt-6 border-b" style={{ borderTop: '1px solid #e2e8f0', borderBottom: 'none' }}>
          <button type="button" className="btn btn-outline" onClick={addLine}>+ Add Another Expense</button>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>Total: {formatCurrency(total)}</div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/dashboard')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft Report'}
          </button>
        </div>
      </form>
    </div>
  );
}

