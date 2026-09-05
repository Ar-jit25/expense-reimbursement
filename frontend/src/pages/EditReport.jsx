import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { reportsService } from '../services/reports';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function EditReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [title, setTitle] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lines, setLines] = useState([]);
  
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const report = await reportsService.getReport(id);
        if (report.status !== 'DRAFT') {
           navigate(`/reports/${id}`);
           return;
        }
        setTitle(report.title);
        setDateFrom(report.dateFrom.split('T')[0]);
        setDateTo(report.dateTo.split('T')[0]);
        if (report.lines && report.lines.length > 0) {
           setLines(report.lines.map(l => ({
             id: l.id,
             date: l.date.split('T')[0],
             amount: l.amount,
             category: l.category,
             description: l.description
           })));
        } else {
           setLines([{ date: '', amount: '', category: 'TRAVEL', description: '' }]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id, navigate]);

  const total = lines.reduce((acc, line) => acc + (parseFloat(line.amount) || 0), 0);

  const addLine = () => setLines([...lines, { date: '', amount: '', category: 'TRAVEL', description: '' }]);
  
  const removeLine = async (idx) => {
    const line = lines[idx];
    if (line.id) {
       try {
         await reportsService.removeExpenseLine(id, line.id);
       } catch(e) {
         setError(e.message);
         return;
       }
    }
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
    if (!dateFrom) return setError('Date From is required');
    if (!dateTo) return setError('Date To is required');
    if (new Date(dateFrom) > new Date(dateTo)) return setError('Date From cannot be after Date To');
    
    try {
      setSaving(true);
      setError(null);
      
      await reportsService.updateReport(id, { title, dateFrom, dateTo });
      
      for (const line of lines) {
        if (line.date && line.amount && line.category && line.description) {
          const payload = { ...line, amount: parseFloat(line.amount) };
          if (line.id) {
             await reportsService.updateExpenseLine(id, line.id, payload);
          } else {
             await reportsService.addExpenseLine(id, payload);
          }
        }
      }
      navigate(`/reports/${id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Edit Expense Report</h1>
      
      {error && <div className="card bg-red-100 text-red-800 mb-6">{error}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-6">
          <label className="text-sm font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Report Title</label>
          <input className="input" required value={title} onChange={e => setTitle(e.target.value)} />
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
                <option value="SUPPLIES">Supplies</option>
                <option value="SOFTWARE">Software</option>
                <option value="EQUIPMENT">Equipment</option>
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
          <button type="button" className="btn btn-outline" onClick={() => navigate(`/reports/${id}`)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft Report'}
          </button>
        </div>
      </form>
    </div>
  );
}
