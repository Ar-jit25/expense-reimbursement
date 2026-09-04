import { useState, useEffect } from 'react';
import { analyticsService } from '../../services/analytics';
import { formatCurrency } from '../../utils/formatters';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import './AnalyticsOverview.css';

export function AnalyticsOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        const res = await analyticsService.getDashboardAnalytics();
        setData(res);
      } catch (err) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytics...</div>;
  if (error) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger-color)', background: '#fee2e2', borderRadius: '8px', marginBottom: '2rem' }}>{error}</div>;
  if (!data) return null;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const categoryData = Object.entries(data.categoryBreakdown).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  const trendData = data.eightWeekTrend.map(t => ({ name: t.week.split('-')[1], total: t.total }));

  return (
    <div className="analytics-container">
      <div className="kpi-grid">
        <div className="kpi-card">
          <h3 className="kpi-label">Awaiting Approval</h3>
          <p className="kpi-value">{data.awaitingApproval}</p>
        </div>
        <div className="kpi-card">
          <h3 className="kpi-label">Reimbursements Due</h3>
          <p className="kpi-value">{formatCurrency(data.reimbursementsDue)}</p>
        </div>
        <div className="kpi-card">
          <h3 className="kpi-label">Approved This Week</h3>
          <p className="kpi-value">{data.approvedThisWeek}</p>
        </div>
        <div className="kpi-card">
          <h3 className="kpi-label">Paid This Week</h3>
          <p className="kpi-value">{data.paidThisWeek}</p>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-title">Paid Trailing 8 Weeks</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Category Breakdown</h3>
          <div className="chart-container">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No category data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
