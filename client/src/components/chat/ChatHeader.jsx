import { Link } from 'react-router-dom';
import { conversationTitle, otherParticipant, typingLabel } from '../../lib/conversation.js';
import { formatLastSeen } from '../../lib/format.js';
import Avatar from '../common/Avatar.jsx';
import Icon from '../common/Icon.jsx';

export default function ChatHeader({ conversation, meId, online, lastSeen, typingUsers, muted, onInfo, onSearch }) {
  const title = conversationTitle(conversation, meId);
  const other = otherParticipant(conversation, meId);

  let subtitle;
  let subtitleClass = 'muted';
  if (typingUsers.length > 0) {
    subtitle = typingLabel(typingUsers);
    subtitleClass = 'typing-text';
  } else if (other) {
    const isOnline = Boolean(online[other.id]);
    subtitle = isOnline ? 'Online' : formatLastSeen(lastSeen[other.id] || other.lastSeenAt);
    if (isOnline) subtitleClass = 'online-text';
  } else {
    const count = conversation.participants.length;
    const onlineCount = conversation.participants.filter((p) => online[p.user?.id]).length;
    subtitle = `${count} member${count === 1 ? '' : 's'}${onlineCount ? ` · ${onlineCount} online` : ''}`;
  }

  return (
    <header className="chat__header">
      <Link to="/" className="icon-btn chat__back" aria-label="Back to conversations">
        <Icon name="arrow-left" />
      </Link>
      <Avatar
        name={title}
        src={other ? other.avatarUrl : conversation.avatarUrl}
        group={conversation.type === 'group'}
        online={other ? Boolean(online[other.id]) : undefined}
        size={40}
      />
      <div
        className="chat__title"
        role="button"
        tabIndex={0}
        onClick={onInfo}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onInfo()}
      >
        <h2>
          {title}
          {muted && <Icon name="bell-off" size={14} className="chat__muted" />}
        </h2>
        <p className={subtitleClass}>{subtitle}</p>
      </div>
      <button type="button" className="icon-btn" onClick={onSearch} aria-label="Search messages" title="Search">
        <Icon name="search" />
      </button>
      <button type="button" className="icon-btn" onClick={onInfo} aria-label="Conversation details" title="Details">
        <Icon name="info" />
      </button>
    </header>
  );
}
