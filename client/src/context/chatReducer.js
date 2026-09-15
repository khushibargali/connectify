export const initialState = {
  conversations: [],
  conversationsLoaded: false,
  /** conversationId → { items, hasMore, loading, loaded, error } */
  messages: {},
  /** conversationId → { [userId]: true } */
  typing: {},
  /** userId → true */
  online: {},
  /** userId → ISO timestamp */
  lastSeen: {},
  activeId: null,
  toasts: [],
};

const byActivity = (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
const byTime = (a, b) =>
  new Date(a.createdAt) - new Date(b.createdAt) || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0);

const latest = (a, b) => (!a || new Date(b) > new Date(a) ? b : a);

const emptyBucket = () => ({ items: [], hasMore: true, loading: false, loaded: false, error: null });

/** Union of two message lists, de-duplicated by id (and by clientId for optimistic rows), sorted. */
function mergeMessages(existing, incoming) {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const message of incoming) {
    if (message.clientId && map.has(message.clientId)) map.delete(message.clientId);
    map.set(message.id, message);
  }
  return [...map.values()].sort(byTime);
}

function updateBucket(state, conversationId, updater) {
  const bucket = state.messages[conversationId] ?? emptyBucket();
  return { ...state, messages: { ...state.messages, [conversationId]: updater(bucket) } };
}

function updateConversation(state, conversationId, updater) {
  if (!state.conversations.some((c) => c.id === conversationId)) return state;
  const conversations = state.conversations.map((c) => (c.id === conversationId ? updater(c) : c)).sort(byActivity);
  return { ...state, conversations };
}

export function chatReducer(state, action) {
  switch (action.type) {
    case 'conversations/set':
      return { ...state, conversations: [...action.conversations].sort(byActivity), conversationsLoaded: true };

    case 'conversations/upsert': {
      const incoming = action.conversation;
      const existing = state.conversations.find((c) => c.id === incoming.id);
      // Unread counts are tracked locally from message events; only trust the API's initial value.
      const merged = existing
        ? { ...existing, ...incoming, unreadCount: existing.unreadCount ?? 0 }
        : { ...incoming, unreadCount: incoming.unreadCount ?? 0 };
      const rest = state.conversations.filter((c) => c.id !== incoming.id);
      return { ...state, conversations: [merged, ...rest].sort(byActivity) };
    }

    case 'conversations/remove': {
      const { [action.conversationId]: _dropped, ...messages } = state.messages;
      return {
        ...state,
        conversations: state.conversations.filter((c) => c.id !== action.conversationId),
        messages,
      };
    }

    case 'conversations/read': {
      const { conversationId, userId, readAt, isMe } = action;
      return updateConversation(state, conversationId, (c) => ({
        ...c,
        unreadCount: isMe ? 0 : c.unreadCount,
        participants: c.participants.map((p) =>
          p.user?.id === userId ? { ...p, lastReadAt: readAt, lastDeliveredAt: latest(p.lastDeliveredAt, readAt) } : p,
        ),
      }));
    }

    case 'conversations/delivered': {
      const { conversationId, userId, deliveredAt } = action;
      return updateConversation(state, conversationId, (c) => ({
        ...c,
        participants: c.participants.map((p) =>
          p.user?.id === userId ? { ...p, lastDeliveredAt: latest(p.lastDeliveredAt, deliveredAt) } : p,
        ),
      }));
    }

    case 'messages/progress':
      return updateBucket(state, action.conversationId, (b) => ({
        ...b,
        items: b.items.map((m) => (m.id === action.clientId ? { ...m, progress: action.progress } : m)),
      }));

    case 'messages/loading':
      return updateBucket(state, action.conversationId, (b) => ({ ...b, loading: true, error: null }));

    case 'messages/loaded':
      return updateBucket(state, action.conversationId, (b) => ({
        ...b,
        items: mergeMessages(b.items, action.messages),
        hasMore: action.hasMore,
        loading: false,
        loaded: true,
      }));

    case 'messages/error':
      return updateBucket(state, action.conversationId, (b) => ({ ...b, loading: false, error: action.error }));

    case 'messages/add': {
      const { message, incrementUnread } = action;
      const conversationId = message.conversation;
      const bucket = state.messages[conversationId];
      const alreadyKnown = bucket?.items.some((m) => m.id === message.id);

      let next = bucket ? updateBucket(state, conversationId, (b) => ({ ...b, items: mergeMessages(b.items, [message]) })) : state;

      return updateConversation(next, conversationId, (c) => {
        const newer = !c.lastMessageAt || new Date(message.createdAt) >= new Date(c.lastMessageAt);
        return {
          ...c,
          lastMessage: newer ? message : c.lastMessage,
          lastMessageAt: newer ? message.createdAt : c.lastMessageAt,
          unreadCount: (c.unreadCount || 0) + (incrementUnread && !alreadyKnown ? 1 : 0),
        };
      });
    }

    case 'messages/failed':
      return updateBucket(state, action.conversationId, (b) => ({
        ...b,
        items: b.items.map((m) => (m.id === action.clientId ? { ...m, pending: false, failed: true } : m)),
      }));

    case 'messages/discard':
      return updateBucket(state, action.conversationId, (b) => ({
        ...b,
        items: b.items.filter((m) => m.id !== action.messageId),
      }));

    case 'messages/deleted': {
      const { conversationId, messageId } = action;
      const deletedAt = new Date().toISOString();
      const tombstone = (m) => (m.id === messageId ? { ...m, content: '', deletedAt } : m);
      let next = state.messages[conversationId]
        ? updateBucket(state, conversationId, (b) => ({ ...b, items: b.items.map(tombstone) }))
        : state;
      return updateConversation(next, conversationId, (c) =>
        c.lastMessage?.id === messageId ? { ...c, lastMessage: tombstone(c.lastMessage) } : c,
      );
    }

    case 'messages/updated': {
      const { message } = action;
      const conversationId = message.conversation;
      const next = state.messages[conversationId]
        ? updateBucket(state, conversationId, (b) => ({
            ...b,
            items: b.items.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
          }))
        : state;
      return updateConversation(next, conversationId, (c) =>
        c.lastMessage?.id === message.id ? { ...c, lastMessage: { ...c.lastMessage, ...message } } : c,
      );
    }

    case 'messages/reset':
      return { ...state, messages: {} };

    case 'typing/set': {
      const { conversationId, userId, isTyping } = action;
      const current = { ...(state.typing[conversationId] || {}) };
      if (isTyping) current[userId] = true;
      else delete current[userId];
      return { ...state, typing: { ...state.typing, [conversationId]: current } };
    }

    case 'presence/list':
      return { ...state, online: Object.fromEntries(action.ids.map((id) => [id, true])) };

    case 'presence/update': {
      const online = { ...state.online };
      if (action.online) online[action.userId] = true;
      else delete online[action.userId];
      const lastSeen = action.lastSeenAt ? { ...state.lastSeen, [action.userId]: action.lastSeenAt } : state.lastSeen;
      return { ...state, online, lastSeen };
    }

    case 'active/set':
      return { ...state, activeId: action.conversationId };

    case 'toasts/add':
      return { ...state, toasts: [...state.toasts.filter((t) => t.id !== action.toast.id), action.toast].slice(-4) };

    case 'toasts/remove':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    default:
      return state;
  }
}
