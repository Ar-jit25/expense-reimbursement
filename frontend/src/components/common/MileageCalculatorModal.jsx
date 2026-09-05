import { useState } from 'react';
import { Car, X } from 'lucide-react';

export default function MileageCalculatorModal({ isOpen, onClose, onApply }) {
  const [miles, setMiles] = useState('');
  const [rate, setRate] = useState('0.67'); // Standard IRS business mileage rate for 2024/2026 ($0.67/mi)
  const [startLoc, setStartLoc] = useState('');
  const [endLoc, setEndLoc] = useState('');
  const [tripPurpose, setTripPurpose] = useState('');

  if (!isOpen) return null;

  const calculatedAmount = (parseFloat(miles) || 0) * (parseFloat(rate) || 0);

  const handleApply = (e) => {
    e.preventDefault();
    if (!miles || parseFloat(miles) <= 0) return;
    
    let description = `Vehicle Mileage: ${miles} miles @ $${rate}/mi`;
    if (startLoc || endLoc) {
      description += ` (${startLoc || 'Origin'} -> ${endLoc || 'Destination'})`;
    }
    if (tripPurpose) {
      description += ` - ${tripPurpose}`;
    }

    onApply({
      amount: calculatedAmount.toFixed(2),
      category: 'TRAVEL',
      description
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '0.5rem',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#0f172a' }}>
            <Car size={20} color="#16a34a" />
            <span>Vehicle Mileage Calculator</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleApply} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.35rem', color: '#334155' }}>
                Distance (Miles) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                className="input"
                placeholder="e.g. 45.5"
                value={miles}
                onChange={e => setMiles(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.35rem', color: '#334155' }}>
                Rate ($/mile)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className="input"
                value={rate}
                onChange={e => setRate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.35rem', color: '#334155' }}>
                Starting Point
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Office HQ"
                value={startLoc}
                onChange={e => setStartLoc(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.35rem', color: '#334155' }}>
                Destination
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Airport / Client"
                value={endLoc}
                onChange={e => setEndLoc(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.35rem', color: '#334155' }}>
              Trip Purpose / Notes
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Onsite client project kickoff"
              value={tripPurpose}
              onChange={e => setTripPurpose(e.target.value)}
            />
          </div>

          <div style={{
            padding: '0.85rem 1rem',
            backgroundColor: '#ecfdf5',
            borderRadius: '0.375rem',
            border: '1px solid #a7f3d0',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.875rem', color: '#065f46', fontWeight: 500 }}>Reimbursement Total:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#047857' }}>
              ${calculatedAmount.toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={!miles || parseFloat(miles) <= 0}
              style={{ backgroundColor: '#16a34a', color: 'white' }}
            >
              Add Mileage Line
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
