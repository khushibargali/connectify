import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'connectify.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) — session lives in memory only */
  }
}

const unauthorizedListeners = new Set();

/** Subscribe to 401 responses (e.g. expired token) so the session can be cleared. */
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/** Turns an axios error into an Error with `.status` and `.details` from the API envelope. */
export function normalizeError(error) {
  const data = error.response?.data?.error;
  const err = new Error(data?.message || (error.response ? 'Request failed' : 'Network error — is the server running?'));
  err.status = error.response?.status;
  err.details = data?.details;
  return err;
}

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.startsWith('/auth/login') || error.config?.url?.startsWith('/auth/register');
    if (error.response?.status === 401 && !isAuthRoute && getToken()) {
      unauthorizedListeners.forEach((listener) => listener());
    }
    return Promise.reject(normalizeError(error));
  },
);

export default api;
