import api from './client.js';

export const messagesApi = {
  list: (conversationId, { before, limit = 40 } = {}) =>
    api
      .get(`/conversations/${conversationId}/messages`, { params: { before, limit } })
      .then((r) => r.data),
  send: (conversationId, data) =>
    api.post(`/conversations/${conversationId}/messages`, data).then((r) => r.data.message),
  remove: (messageId) => api.delete(`/messages/${messageId}`).then((r) => r.data),
};
