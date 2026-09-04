const analyticsService = require('../services/analytics.service');

class AnalyticsController {
  async getDashboardAnalytics(req, res) {
    try {
      const analytics = await analyticsService.getDashboardAnalytics(req.user.id, req.user.role);
      res.json(analytics);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
}

module.exports = new AnalyticsController();
