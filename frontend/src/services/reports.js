import { apiClient } from './apiClient';

export const reportsService = {
  async getReports(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    });
    
    const qs = query.toString();
    const endpoint = `/reports${qs ? '?' + qs : ''}`;
    const response = await apiClient(endpoint);
    
    if (Array.isArray(response)) {
      return { data: response, total: response.length, page: 1, limit: response.length || 10 };
    }
    return response;
  },
  async getReport(id) { return apiClient(`/reports/${id}`); },
  async createReport(data) { return apiClient('/reports', { method: 'POST', body: JSON.stringify(data) }); },
  async addExpenseLine(reportId, data) { return apiClient(`/reports/${reportId}/lines`, { method: 'POST', body: JSON.stringify(data) }); },
  async removeExpenseLine(reportId, lineId) { return apiClient(`/reports/${reportId}/lines/${lineId}`, { method: 'DELETE' }); },
  async submitReport(id) { return apiClient(`/reports/${id}/submit`, { method: 'POST' }); },
  async approveReport(id) { return apiClient(`/reports/${id}/approve`, { method: 'POST' }); },
  async rejectReport(id, reason) { return apiClient(`/reports/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); },
  async assignApprover(id, approverId) { return apiClient(`/reports/${id}/assignments`, { method: 'POST', body: JSON.stringify({ approverId }) }); },
  async removeApprover(id, approverId) { return apiClient(`/reports/${id}/assignments/${approverId}`, { method: 'DELETE' }); }
};
