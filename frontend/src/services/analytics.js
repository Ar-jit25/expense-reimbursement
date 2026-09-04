import { apiClient } from './apiClient';

export const analyticsService = {
  getDashboardAnalytics: async () => {
    const res = await apiClient('/analytics');
    return res;
  }
};
