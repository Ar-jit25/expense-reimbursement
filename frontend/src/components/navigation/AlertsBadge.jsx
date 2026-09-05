import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { alertsService } from '../../services/alerts';

export function AlertsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchAlerts = async () => {
      try {
        const data = await alertsService.getAlerts();
        if (mounted) setCount(data.count || 0);
      } catch (err) {
        console.error('Failed to fetch alerts count', err);
      }
    };
    
    fetchAlerts();
    // Poll every 5 hours (5 * 60 * 60 * 1000 ms) to recalculate stale reports and recurrence
    const interval = setInterval(fetchAlerts, 5 * 60 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <NavLink to="/alerts" className={({isActive}) => isActive ? "sidebar-link active" : "sidebar-link"} style={{ position: 'relative' }}>
      <Bell size={18} /> 
      <span>Alerts</span>
      {count > 0 && (
        <span style={{
          background: '#ef4444',
          color: 'white',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          padding: '2px 6px',
          borderRadius: '9999px',
          marginLeft: 'auto'
        }}>
          {count}
        </span>
      )}
    </NavLink>
  );
}