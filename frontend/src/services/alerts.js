import { apiClient } from './apiClient';

export const alertsService = {
  getAlerts: async () => {
    return await apiClient('/alerts');
  },
  dismissAlert: async (reportId) => {
    return await apiClient(`/alerts/${reportId}/dismiss`, { method: 'POST' });
  }
};
