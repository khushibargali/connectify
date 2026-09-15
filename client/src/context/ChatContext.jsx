import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { conversationsApi } from '../api/conversations.api.js';
import { messagesApi } from '../api/messages.api.js';
import { newClientId } from '../lib/ids.js';
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

  const showDesktopNotification = useCallback(
    (title, body, conversationId) => {
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
    },
    [],
  );

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
        if (!mine) setTyping(conversationId, message.sender?.id, false);
        if (!mine && viewing) {
          socket.emit('conversation:read', { conversationId });
          markReadLocally(conversationId);
        }
      },
      'message:deleted': ({ conversationId, messageId }) => dispatch({ type: 'messages/deleted', conversationId, messageId }),
      'conversation:new': (conversation) => dispatch({ type: 'conversations/upsert', conversation }),
      'conversation:updated': (conversation) => dispatch({ type: 'conversations/upsert', conversation }),
      'conversation:removed': ({ conversationId }) => {
        dispatch({ type: 'conversations/remove', conversationId });
        if (activeRef.current === conversationId) navigateRef.current('/');
      },
      'conversation:read': ({ conversationId, userId, readAt }) =>
        dispatch({ type: 'conversations/read', conversationId, userId, readAt, isMe: userId === meId }),
      typing: ({ conversationId, userId, isTyping }) => setTyping(conversationId, userId, isTyping),
      'presence:list': (ids) => dispatch({ type: 'presence/list', ids }),
      'presence:update': (payload) => dispatch({ type: 'presence/update', ...payload }),
      notification: (note) => {
        if (note.type === 'message') {
          if (isViewing(note.conversationId)) return;
          const { message } = note;
          const title = message.sender?.displayName || 'New message';
          const body = message.type === 'system' ? `${title} ${message.content}` : message.content;
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

  const sendMessage = useCallback(
    (conversationId, content) => {
      const clientId = newClientId();
      const optimistic = {
        id: clientId,
        clientId,
        conversation: conversationId,
        sender: user,
        type: 'text',
        content,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      dispatch({ type: 'messages/add', message: optimistic, incrementUnread: false });

      const settle = (message) => dispatch({ type: 'messages/add', message, incrementUnread: false });
      const fail = () => dispatch({ type: 'messages/failed', conversationId, clientId });

      if (socket?.connected) {
        socket.timeout(10000).emit('message:send', { conversationId, content, clientId }, (err, res) => {
          if (err || !res?.ok) fail();
          else settle(res.message);
        });
      } else {
        messagesApi.send(conversationId, { content, clientId }).then(settle).catch(fail);
      }
    },
    [socket, user],
  );

  const retryMessage = useCallback(
    (message) => {
      dispatch({ type: 'messages/discard', conversationId: message.conversation, messageId: message.id });
      sendMessage(message.conversation, message.content);
    },
    [sendMessage],
  );

  const discardMessage = useCallback(
    (message) => dispatch({ type: 'messages/discard', conversationId: message.conversation, messageId: message.id }),
    [],
  );

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
