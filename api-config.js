// ============================================
// CONFIGURAÇÃO DA API
// ============================================

const API_CONFIG = {
  baseURL: 'http://localhost:3000/api',
  timeout: 10000
};

// Helper para fazer requisições HTTP
const API = {
  // GET request
  get: async function(endpoint, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const response = await fetch(API_CONFIG.baseURL + endpoint, {
      method: 'GET',
      headers: headers
    });

    return await response.json();
  },

  // POST request
  post: async function(endpoint, data, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const response = await fetch(API_CONFIG.baseURL + endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });

    return await response.json();
  },

  // PUT request
  put: async function(endpoint, data, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const response = await fetch(API_CONFIG.baseURL + endpoint, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(data)
    });

    return await response.json();
  },

  // DELETE request
  delete: async function(endpoint, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const response = await fetch(API_CONFIG.baseURL + endpoint, {
      method: 'DELETE',
      headers: headers
    });

    return await response.json();
  }
};
