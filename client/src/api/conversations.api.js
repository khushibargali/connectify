import api from './client.js';

export const conversationsApi = {
  list: () => api.get('/conversations').then((r) => r.data.conversations),
  get: (id) => api.get(`/conversations/${id}`).then((r) => r.data.conversation),
  createDirect: (userId) => api.post('/conversations/direct', { userId }).then((r) => r.data),
  createGroup: (data) => api.post('/conversations/group', data).then((r) => r.data),
  update: (id, patch) => api.patch(`/conversations/${id}`, patch).then((r) => r.data),
  addMembers: (id, memberIds) => api.post(`/conversations/${id}/members`, { memberIds }).then((r) => r.data),
  removeMember: (id, userId) => api.delete(`/conversations/${id}/members/${userId}`).then((r) => r.data),
  leave: (id) => api.delete(`/conversations/${id}/members/me`).then((r) => r.data),
  markRead: (id) => api.post(`/conversations/${id}/read`).then((r) => r.data),
  setMuted: (id, muted) => api.post(`/conversations/${id}/mute`, { muted }).then((r) => r.data),
};
