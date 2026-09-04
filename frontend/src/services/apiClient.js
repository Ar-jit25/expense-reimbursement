const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const apiClient = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const config = { ...options, headers };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (response.status === 204) return null;

    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(data?.error || data?.message || response.statusText || 'API Request Failed');
    }
    return data;
  } catch (err) {
    throw err;
  }
};
