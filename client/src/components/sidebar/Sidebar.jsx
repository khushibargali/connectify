import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../context/ChatContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { conversationTitle } from '../../lib/conversation.js';
import Icon from '../common/Icon.jsx';
import ConversationList from './ConversationList.jsx';
import NewChatModal from './NewChatModal.jsx';
import ProfileModal from './ProfileModal.jsx';
import UserMenu from './UserMenu.jsx';

export default function Sidebar({ activeId }) {
  const { user } = useAuth();
  const { connected } = useSocket();
  const { conversations, conversationsLoaded } = useChat();
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => conversationTitle(c, user.id).toLowerCase().includes(q));
  }, [conversations, query, user.id]);

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div className="brand">
          <span className="brand__logo" aria-hidden="true">
            ◎
          </span>
          Connectify
        </div>
        <div className="sidebar__actions">
          <button type="button" className="icon-btn icon-btn--primary" onClick={() => setModal('new')} title="New chat" aria-label="New chat">
            <Icon name="plus" />
          </button>
          <UserMenu onProfile={() => setModal('profile')} />
        </div>
      </header>

      <div className="sidebar__search search">
        <Icon name="search" size={16} />
        <input
          type="search"
          placeholder="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search conversations"
        />
      </div>

      {!connected && (
        <div className="status-banner" role="status">
          <span className="status-banner__dot" /> Connecting…
        </div>
      )}

      <ConversationList
        conversations={filtered}
        activeId={activeId}
        loaded={conversationsLoaded}
        filtering={Boolean(query.trim())}
        onNew={() => setModal('new')}
      />

      {modal === 'new' && <NewChatModal onClose={() => setModal(null)} />}
      {modal === 'profile' && <ProfileModal onClose={() => setModal(null)} />}
    </aside>
  );
}
