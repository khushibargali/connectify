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
  } = useChat();
  const [showInfo, setShowInfo] = useState(false);
  const [media, setMedia] = useState(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const bucket = messages[conversationId];

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
        onInfo={() => setShowInfo(true)}
      />
      <MessageList
        conversation={conversation}
        bucket={bucket}
        meId={user.id}
        onLoadOlder={loadOlder}
        onDelete={(message) => deleteMessage(message).catch((err) => console.error(err))}
        onRetry={retryMessage}
        onDiscard={discardMessage}
        onOpenMedia={setMedia}
      />
      <TypingIndicator users={typingUsers} />
      <MessageInput
        key={conversationId}
        onSend={(input) => sendMessage(conversationId, input)}
        onTyping={(isTyping) => sendTyping(conversationId, isTyping)}
      />
      {showInfo && <ConversationInfoModal conversation={conversation} onClose={() => setShowInfo(false)} />}
      {media && <Lightbox message={media} onClose={() => setMedia(null)} />}
    </div>
  );
}
