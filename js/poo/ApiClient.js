// ============================================
// CLASSE BASE - API CLIENT
// ============================================

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.timeout = 10000;
  }

  async request(endpoint, options = {}) {
    const url = this.baseURL + endpoint;
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token && { 'Authorization': 'Bearer ' + options.token })
      },
      ...(options.body && { body: JSON.stringify(options.body) })
    };

    try {
      const response = await fetch(url, config);
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async get(endpoint, token = null) {
    return this.request(endpoint, { method: 'GET', token });
  }

  async post(endpoint, data, token = null) {
    return this.request(endpoint, { method: 'POST', body: data, token });
  }

  async put(endpoint, data, token = null) {
    return this.request(endpoint, { method: 'PUT', body: data, token });
  }

  async delete(endpoint, token = null) {
    return this.request(endpoint, { method: 'DELETE', token });
  }
}

// Instância global da API
const API = new ApiClient('http://localhost:3000/api');
