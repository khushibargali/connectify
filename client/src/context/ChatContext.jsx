import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { conversationsApi } from '../api/conversations.api.js';
import { messagesApi } from '../api/messages.api.js';
import { uploadsApi } from '../api/uploads.api.js';
import { newClientId } from '../lib/ids.js';
import { fileKind, messageSummary } from '../lib/media.js';
import { useAuth } from './AuthContext.jsx';
import { chatReducer, initialState } from './chatReducer.js';
import { useSocket } from './SocketContext.jsx';

const ChatContext = createContext(null);

const TYPING_TTL = 4000;

/**
 * Holds every piece of chat state (conversations, messages, typing, presence, toasts)
 * and translates socket events + API calls into reducer actions.
 */
export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const meId = user?.id;
  const activeRef = useRef(null);
  const typingTimers = useRef(new Map());
  const connectedBefore = useRef(false);
  /** clientId → { file, kind, duration, blobUrl } for optimistic media messages (retry support). */
  const pendingFiles = useRef(new Map());
  /** Latest state for socket handlers and async loops without re-subscribing. */
  const stateRef = useRef(state);
  stateRef.current = state;

  // useNavigate() returns a new function on every route change; keep it in a ref so the
  // socket subscriptions below are not torn down and re-created on each navigation.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const isViewing = useCallback(
    (conversationId) => activeRef.current === conversationId && document.visibilityState === 'visible',
    [],
  );

  const loadConversations = useCallback(async () => {
    const conversations = await conversationsApi.list();
    dispatch({ type: 'conversations/set', conversations });
  }, []);

  useEffect(() => {
    if (!meId) return;
    loadConversations().catch((err) => console.error('Failed to load conversations', err));
  }, [meId, loadConversations]);

  const markReadLocally = useCallback(
    (conversationId) =>
      dispatch({ type: 'conversations/read', conversationId, userId: meId, readAt: new Date().toISOString(), isMe: true }),
    [meId],
  );

  const showDesktopNotification = useCallback((title, body, conversationId) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    try {
      const note = new Notification(title, { body, tag: conversationId });
      note.onclick = () => {
        window.focus();
        navigateRef.current(`/c/${conversationId}`);
        note.close();
      };
    } catch {
      /* notifications blocked by the browser */
    }
  }, []);

  // ---- Socket subscriptions -------------------------------------------------
  useEffect(() => {
    if (!socket || !meId) return undefined;

    const setTyping = (conversationId, userId, isTyping) => {
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.current.get(key));
      dispatch({ type: 'typing/set', conversationId, userId, isTyping });
      if (isTyping) {
        typingTimers.current.set(
          key,
          setTimeout(() => dispatch({ type: 'typing/set', conversationId, userId, isTyping: false }), TYPING_TTL),
        );
      }
    };

    const handlers = {
      'message:new': (message) => {
        const conversationId = message.conversation;
        const mine = message.sender?.id === meId;
        const viewing = isViewing(conversationId);
        dispatch({ type: 'messages/add', message, incrementUnread: !mine && !viewing });
        if (mine) return;
        setTyping(conversationId, message.sender?.id, false);
        // Tell the sender it reached us (✓✓); reading it as well when the chat is open (blue ✓✓).
        socket.emit('conversation:delivered', { conversationId });
        if (viewing) {
          socket.emit('conversation:read', { conversationId });
          markReadLocally(conversationId);
        }
      },
      'message:deleted': ({ conversationId, messageId }) => dispatch({ type: 'messages/deleted', conversationId, messageId }),
      'message:updated': (message) => dispatch({ type: 'messages/updated', message }),
      'conversation:new': (conversation) => dispatch({ type: 'conversations/upsert', conversation }),
      'conversation:updated': (conversation) => dispatch({ type: 'conversations/upsert', conversation }),
      'conversation:removed': ({ conversationId }) => {
        dispatch({ type: 'conversations/remove', conversationId });
        if (activeRef.current === conversationId) navigateRef.current('/');
      },
      'conversation:read': ({ conversationId, userId, readAt }) =>
        dispatch({ type: 'conversations/read', conversationId, userId, readAt, isMe: userId === meId }),
      'conversation:delivered': ({ conversationId, userId, deliveredAt }) =>
        dispatch({ type: 'conversations/delivered', conversationId, userId, deliveredAt }),
      typing: ({ conversationId, userId, isTyping }) => setTyping(conversationId, userId, isTyping),
      'presence:list': (ids) => dispatch({ type: 'presence/list', ids }),
      'presence:update': (payload) => dispatch({ type: 'presence/update', ...payload }),
      notification: (note) => {
        if (note.type === 'message') {
          if (isViewing(note.conversationId)) return;
          const conversation = stateRef.current.conversations.find((c) => c.id === note.conversationId);
          if (conversation?.participants.some((p) => p.user?.id === meId && p.muted)) return;
          const { message } = note;
          const title = message.sender?.displayName || 'New message';
          const body = message.type === 'system' ? `${title} ${message.content}` : messageSummary(message);
          dispatch({ type: 'toasts/add', toast: { id: message.id, title, body, conversationId: note.conversationId } });
          showDesktopNotification(title, body, note.conversationId);
        } else if (note.type === 'conversation:added') {
          const body = note.conversation?.name ? `You were added to "${note.conversation.name}"` : 'You were added to a group';
          dispatch({ type: 'toasts/add', toast: { id: `added:${note.conversationId}`, title: 'New group', body, conversationId: note.conversationId } });
          showDesktopNotification('New group', body, note.conversationId);
        }
      },
    };

    // If the socket is already connected when we subscribe, the next 'connect' is a reconnect.
    connectedBefore.current = socket.connected;
    const onConnect = () => {
      // After a reconnect the client may have missed events: reload everything from the API.
      if (connectedBefore.current) {
        dispatch({ type: 'messages/reset' });
        loadConversations().catch(() => {});
      }
      connectedBefore.current = true;
    };

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    socket.on('connect', onConnect);

    const timers = typingTimers.current;
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
      socket.off('connect', onConnect);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [socket, meId, isViewing, loadConversations, markReadLocally, showDesktopNotification]);

  // ---- Tab title badge ------------------------------------------------------
  const totalUnread = state.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Connectify` : 'Connectify';
  }, [totalUnread]);

  // ---- Actions --------------------------------------------------------------
  const openConversation = useCallback((conversationId) => {
    activeRef.current = conversationId;
    dispatch({ type: 'active/set', conversationId });
  }, []);

  const loadMessages = useCallback(async (conversationId, { before } = {}) => {
    dispatch({ type: 'messages/loading', conversationId });
    try {
      const { messages, hasMore } = await messagesApi.list(conversationId, { before, limit: 40 });
      dispatch({ type: 'messages/loaded', conversationId, messages, hasMore });
    } catch (err) {
      dispatch({ type: 'messages/error', conversationId, error: err.message });
      throw err;
    }
  }, []);

  /**
   * Sends text or media. Media is shown immediately from a local preview, uploaded with
   * progress, then delivered over the socket; the ack (or broadcast) replaces the optimistic row.
   */
  const sendMessage = useCallback(
    (conversationId, input) => {
      const { content = '', file = null, kind, duration, replyTo = null } = typeof input === 'string' ? { content: input } : input || {};
      const text = content.trim();
      if (!text && !file) return;

      const clientId = newClientId();
      const type = file ? kind || fileKind(file) : 'text';
      const blobUrl = file ? URL.createObjectURL(file) : null;
      if (file) pendingFiles.current.set(clientId, { file, kind: type, duration, blobUrl });

      dispatch({
        type: 'messages/add',
        incrementUnread: false,
        message: {
          id: clientId,
          clientId,
          conversation: conversationId,
          sender: user,
          type,
          content: text,
          createdAt: new Date().toISOString(),
          pending: true,
          replyTo,
          ...(file && {
            attachment: { url: blobUrl, name: file.name, mimeType: file.type, size: file.size, duration },
            progress: 0,
          }),
        },
      });

      const forget = () => {
        const pending = pendingFiles.current.get(clientId);
        if (pending?.blobUrl) URL.revokeObjectURL(pending.blobUrl);
        pendingFiles.current.delete(clientId);
      };
      const settle = (message) => {
        dispatch({ type: 'messages/add', message, incrementUnread: false });
        forget();
      };
      const fail = () => dispatch({ type: 'messages/failed', conversationId, clientId });

      const deliver = (attachment) => {
        const payload = {
          conversationId,
          type,
          content: text,
          clientId,
          ...(attachment && { attachment }),
          ...(replyTo && { replyTo: replyTo.id }),
        };
        if (socket?.connected) {
          socket.timeout(15000).emit('message:send', payload, (err, res) => (err || !res?.ok ? fail() : settle(res.message)));
        } else {
          messagesApi.send(conversationId, payload).then(settle).catch(fail);
        }
      };

      if (!file) {
        deliver();
        return;
      }
      uploadsApi
        .upload(file, {
          onProgress: (progress) => dispatch({ type: 'messages/progress', conversationId, clientId, progress }),
        })
        .then((stored) =>
          deliver({
            url: stored.url,
            name: stored.name,
            mimeType: stored.mimeType,
            size: stored.size,
            ...(duration != null && { duration }),
          }),
        )
        .catch(fail);
    },
    [socket, user],
  );

  const retryMessage = useCallback(
    (message) => {
      const pending = pendingFiles.current.get(message.clientId);
      dispatch({ type: 'messages/discard', conversationId: message.conversation, messageId: message.id });
      if (message.type !== 'text' && !pending) return;
      if (pending) {
        pendingFiles.current.delete(message.clientId);
        sendMessage(message.conversation, { content: message.content, file: pending.file, kind: pending.kind, duration: pending.duration });
        URL.revokeObjectURL(pending.blobUrl);
      } else {
        sendMessage(message.conversation, { content: message.content });
      }
    },
    [sendMessage],
  );

  const discardMessage = useCallback((message) => {
    const pending = pendingFiles.current.get(message.clientId);
    if (pending?.blobUrl) URL.revokeObjectURL(pending.blobUrl);
    pendingFiles.current.delete(message.clientId);
    dispatch({ type: 'messages/discard', conversationId: message.conversation, messageId: message.id });
  }, []);

  const markRead = useCallback(
    (conversationId) => {
      markReadLocally(conversationId);
      if (socket?.connected) socket.emit('conversation:read', { conversationId });
      else conversationsApi.markRead(conversationId).catch(() => {});
    },
    [socket, markReadLocally],
  );

  const sendTyping = useCallback(
    (conversationId, isTyping) => {
      socket?.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
    },
    [socket],
  );

  const reactToMessage = useCallback(async (message, emoji) => {
    const updated = await messagesApi.react(message.id, emoji);
    dispatch({ type: 'messages/updated', message: updated });
  }, []);

  const editMessage = useCallback(async (message, content) => {
    const updated = await messagesApi.edit(message.id, content);
    dispatch({ type: 'messages/updated', message: updated });
  }, []);

  const searchMessages = useCallback((conversationId, q) => messagesApi.search(conversationId, q), []);

  /** Loads older pages until the message is in memory (for quote and search-result jumps). */
  const jumpToMessage = useCallback(
    async (conversationId, messageId) => {
      const has = () => stateRef.current.messages[conversationId]?.items.some((m) => m.id === messageId);
      for (let page = 0; page < 12 && !has(); page += 1) {
        const bucket = stateRef.current.messages[conversationId];
        const oldest = bucket?.items.find((m) => !m.pending && !m.failed);
        if (!bucket?.hasMore || !oldest) break;
        await loadMessages(conversationId, { before: oldest.id });
      }
      return has();
    },
    [loadMessages],
  );

  const updateGroup = useCallback(async (conversationId, patch) => {
    const { conversation } = await conversationsApi.update(conversationId, patch);
    dispatch({ type: 'conversations/upsert', conversation });
    return conversation;
  }, []);

  const removeMember = useCallback(async (conversationId, userId) => {
    const { conversation } = await conversationsApi.removeMember(conversationId, userId);
    dispatch({ type: 'conversations/upsert', conversation });
    return conversation;
  }, []);

  const setMuted = useCallback(async (conversationId, muted) => {
    const { conversation } = await conversationsApi.setMuted(conversationId, muted);
    dispatch({ type: 'conversations/upsert', conversation });
    return conversation;
  }, []);

  const deleteMessage = useCallback(async (message) => {
    const { message: updated } = await messagesApi.remove(message.id);
    dispatch({ type: 'messages/deleted', conversationId: updated.conversation, messageId: updated.id });
  }, []);

  const startDirect = useCallback(async (userId) => {
    const { conversation } = await conversationsApi.createDirect(userId);
    dispatch({ type: 'conversations/upsert', conversation });
    return conversation;
  }, []);

  const createGroup = useCallback(async (data) => {
    const { conversation } = await conversationsApi.createGroup(data);
    dispatch({ type: 'conversations/upsert', conversation });
    return conversation;
  }, []);

  const addMembers = useCallback(async (conversationId, memberIds) => {
    const { conversation } = await conversationsApi.addMembers(conversationId, memberIds);
    dispatch({ type: 'conversations/upsert', conversation });
    return conversation;
  }, []);

  const leaveGroup = useCallback(async (conversationId) => {
    await conversationsApi.leave(conversationId);
    dispatch({ type: 'conversations/remove', conversationId });
  }, []);

  const dismissToast = useCallback((id) => dispatch({ type: 'toasts/remove', id }), []);

  const value = useMemo(
    () => ({
      ...state,
      totalUnread,
      openConversation,
      loadConversations,
      loadMessages,
      sendMessage,
      retryMessage,
      discardMessage,
      markRead,
      sendTyping,
      deleteMessage,
      reactToMessage,
      editMessage,
      searchMessages,
      jumpToMessage,
      updateGroup,
      removeMember,
      setMuted,
      startDirect,
      createGroup,
      addMembers,
      leaveGroup,
      dismissToast,
    }),
    [
      state,
      totalUnread,
      openConversation,
      loadConversations,
      loadMessages,
      sendMessage,
      retryMessage,
      discardMessage,
      markRead,
      sendTyping,
      deleteMessage,
      reactToMessage,
      editMessage,
      searchMessages,
      jumpToMessage,
      updateGroup,
      removeMember,
      setMuted,
      startDirect,
      createGroup,
      addMembers,
      leaveGroup,
      dismissToast,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
