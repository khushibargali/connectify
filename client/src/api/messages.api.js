import api from './client.js';

export const messagesApi = {
  list: (conversationId, { before, limit = 40 } = {}) =>
    api
      .get(`/conversations/${conversationId}/messages`, { params: { before, limit } })
      .then((r) => r.data),
  search: (conversationId, q, limit = 30) =>
    api.get(`/conversations/${conversationId}/messages/search`, { params: { q, limit } }).then((r) => r.data.messages),
  send: (conversationId, data) =>
    api.post(`/conversations/${conversationId}/messages`, data).then((r) => r.data.message),
  react: (messageId, emoji) => api.put(`/messages/${messageId}/reactions`, { emoji }).then((r) => r.data.message),
  edit: (messageId, content) => api.patch(`/messages/${messageId}`, { content }).then((r) => r.data.message),
  remove: (messageId) => api.delete(`/messages/${messageId}`).then((r) => r.data),
};
