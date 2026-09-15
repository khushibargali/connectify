import api from './client.js';

export const usersApi = {
  search: (q = '', limit = 20) => api.get('/users', { params: { q, limit } }).then((r) => r.data.users),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data.user),
  updateProfile: (patch) => api.patch('/users/me', patch).then((r) => r.data.user),
};
