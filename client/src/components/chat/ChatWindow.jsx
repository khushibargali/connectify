import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../context/ChatContext.jsx';
import { participantUsers } from '../../lib/conversation.js';
import Spinner from '../common/Spinner.jsx';
import ChatHeader from './ChatHeader.jsx';
import ConversationInfoModal from './ConversationInfoModal.jsx';
import Lightbox from './Lightbox.jsx';
import MessageInput from './MessageInput.jsx';
import MessageList from './MessageList.jsx';
import SearchPanel from './SearchPanel.jsx';
import TypingIndicator from './TypingIndicator.jsx';

export default function ChatWindow({ conversationId }) {
  const { user } = useAuth();
  const {
    conversations,
    conversationsLoaded,
    messages,
    typing,
    online,
    lastSeen,
    loadMessages,
    markRead,
    sendMessage,
    retryMessage,
    discardMessage,
    sendTyping,
    deleteMessage,
    reactToMessage,
    editMessage,
    searchMessages,
    jumpToMessage,
  } = useChat();
  const [showInfo, setShowInfo] = useState(false);
  const [media, setMedia] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [unreadMarker, setUnreadMarker] = useState(undefined); // undefined = not decided yet

  const conversation = conversations.find((c) => c.id === conversationId);
  const bucket = messages[conversationId];
  const me = conversation?.participants.find((p) => p.user?.id === user.id);

  // Remember where "unread" started when the chat was opened, before the read marker moves.
  useEffect(() => {
    if (!conversation || unreadMarker !== undefined) return;
    setUnreadMarker(conversation.unreadCount > 0 ? me?.lastReadAt || null : null);
  }, [conversation, me, unreadMarker]);

  // Load the first page once per conversation (and again after a reconnect reset).
  useEffect(() => {
    if (!conversation || bucket?.loaded || bucket?.loading) return;
    loadMessages(conversationId).catch(() => {});
  }, [conversation, conversationId, bucket?.loaded, bucket?.loading, loadMessages]);

  // Clear unread state when the conversation is opened or the tab becomes visible.
  const unread = conversation?.unreadCount || 0;
  useEffect(() => {
    if (!conversation) return undefined;
    const read = () => {
      if (document.visibilityState === 'visible' && unread > 0) markRead(conversationId);
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [conversation, conversationId, unread, markRead]);

  // Highlight fades after a moment.
  useEffect(() => {
    if (!highlightId) return undefined;
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const typingUsers = useMemo(() => {
    if (!conversation) return [];
    const ids = Object.keys(typing[conversationId] || {}).filter((id) => id !== user.id);
    return participantUsers(conversation).filter((u) => ids.includes(u.id));
  }, [conversation, conversationId, typing, user.id]);

  const loadOlder = useCallback(() => {
    const oldest = bucket?.items.find((m) => !m.pending && !m.failed);
    if (!oldest) return;
    loadMessages(conversationId, { before: oldest.id }).catch(() => {});
  }, [bucket, conversationId, loadMessages]);

  const jumpTo = useCallback(
    async (messageId) => {
      const found = await jumpToMessage(conversationId, messageId).catch(() => false);
      if (found) setHighlightId(messageId);
    },
    [conversationId, jumpToMessage],
  );

  const search = useCallback((q) => searchMessages(conversationId, q), [conversationId, searchMessages]);

  if (!conversationsLoaded) {
    return (
      <div className="fullscreen-center">
        <Spinner size={28} />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="empty">
        <h2>Conversation not found</h2>
        <p className="muted">It may have been deleted, or you are no longer a member.</p>
        <Link to="/" className="btn btn--secondary btn--md">
          Back to conversations
        </Link>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <ChatHeader
        conversation={conversation}
        meId={user.id}
        online={online}
        lastSeen={lastSeen}
        typingUsers={typingUsers}
        muted={Boolean(me?.muted)}
        onInfo={() => setShowInfo(true)}
        onSearch={() => setSearchOpen((v) => !v)}
      />
      {searchOpen && (
        <SearchPanel
          onSearch={search}
          onPick={(message) => jumpTo(message.id)}
          onClose={() => setSearchOpen(false)}
        />
      )}
      <MessageList
        conversation={conversation}
        bucket={bucket}
        meId={user.id}
        unreadMarker={unreadMarker || null}
        highlightId={highlightId}
        onLoadOlder={loadOlder}
        onDelete={(message) => deleteMessage(message).catch((err) => console.error(err))}
        onRetry={retryMessage}
        onDiscard={discardMessage}
        onOpenMedia={setMedia}
        onReact={(message, emoji) => reactToMessage(message, emoji).catch((err) => console.error(err))}
        onReply={(message) => {
          setEditing(null);
          setReplyTo(message);
        }}
        onEdit={(message) => {
          setReplyTo(null);
          setEditing(message);
        }}
        onJumpTo={jumpTo}
      />
      <TypingIndicator users={typingUsers} />
      <MessageInput
        key={conversationId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onEdit={(message, content) => editMessage(message, content).then(() => setEditing(null))}
        onSend={(input) => {
          sendMessage(conversationId, { ...input, replyTo });
          setReplyTo(null);
        }}
        onTyping={(isTyping) => sendTyping(conversationId, isTyping)}
      />
      {showInfo && <ConversationInfoModal conversation={conversation} onClose={() => setShowInfo(false)} />}
      {media && <Lightbox message={media} onClose={() => setMedia(null)} />}
    </div>
  );
}
