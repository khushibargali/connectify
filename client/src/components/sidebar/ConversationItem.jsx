import { Link } from 'react-router-dom';
import { conversationTitle, otherParticipant, previewText } from '../../lib/conversation.js';
import { formatConversationTime } from '../../lib/format.js';
import Avatar from '../common/Avatar.jsx';
import Icon from '../common/Icon.jsx';

export default function ConversationItem({ conversation, active, meId, online, typing }) {
  const title = conversationTitle(conversation, meId);
  const other = otherParticipant(conversation, meId);
  const someoneTyping = Object.keys(typing || {}).some((id) => id !== meId);
  const unread = conversation.unreadCount || 0;
  const muted = conversation.participants.some((p) => p.user?.id === meId && p.muted);

  return (
    <li>
      <Link
        to={`/c/${conversation.id}`}
        className={`conv-item ${active ? 'is-active' : ''} ${unread > 0 ? 'is-unread' : ''}`}
      >
        <Avatar
          name={title}
          src={other ? other.avatarUrl : conversation.avatarUrl}
          group={conversation.type === 'group'}
          online={other ? Boolean(online[other.id]) : undefined}
          size={44}
        />
        <div className="conv-item__body">
          <div className="conv-item__row">
            <span className="conv-item__title">{title}</span>
            {conversation.lastMessageAt && (
              <time className="conv-item__time" dateTime={conversation.lastMessageAt}>
                {formatConversationTime(conversation.lastMessageAt)}
              </time>
            )}
          </div>
          <div className="conv-item__row">
            <span className="conv-item__preview">
              {someoneTyping ? <em className="typing-text">typing…</em> : previewText(conversation, meId)}
            </span>
            {muted && <Icon name="bell-off" size={14} className="conv-item__muted" />}
            {unread > 0 && <span className={`badge ${muted ? 'badge--muted' : ''}`}>{unread > 99 ? '99+' : unread}</span>}
          </div>
        </div>
      </Link>
    </li>
  );
}
