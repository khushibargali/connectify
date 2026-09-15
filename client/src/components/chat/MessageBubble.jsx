import { useState } from 'react';
import { formatTime } from '../../lib/format.js';
import { formatBytes, formatDuration, messageSummary, resolveMediaUrl } from '../../lib/media.js';
import Icon from '../common/Icon.jsx';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EDIT_WINDOW_MS = 15 * 60 * 1000;

function Ticks({ message, tick }) {
  if (message.pending) return <Icon name="clock" size={13} className="tick" />;
  if (message.failed) return <Icon name="alert" size={13} className="tick tick--failed" />;
  if (tick === 'read') return <Icon name="check-double" size={15} className="tick tick--read" />;
  if (tick === 'delivered') return <Icon name="check-double" size={15} className="tick" />;
  return <Icon name="check" size={14} className="tick" />;
}

function Media({ message, onOpen }) {
  const { attachment } = message;
  if (!attachment) return null;
  const src = resolveMediaUrl(attachment.url);

  switch (message.type) {
    case 'image':
      return (
        <button type="button" className="msg__media" onClick={() => onOpen(message)} aria-label="Open photo">
          <img src={src} alt={message.content || attachment.name} loading="lazy" />
        </button>
      );
    case 'video':
      return (
        <div className="msg__media msg__media--video">
          <video src={src} controls preload="metadata" playsInline />
          <button type="button" className="msg__expand" onClick={() => onOpen(message)} aria-label="Open video">
            <Icon name="maximize" size={14} />
          </button>
        </div>
      );
    case 'audio':
      return (
        <div className="msg__audio">
          <span className="msg__audio-icon">
            <Icon name="mic" size={18} />
          </span>
          <audio src={src} controls preload="metadata" />
          {attachment.duration != null && <span className="msg__audio-duration">{formatDuration(attachment.duration)}</span>}
        </div>
      );
    default:
      return (
        <a className="msg__file" href={src} target="_blank" rel="noreferrer" download={attachment.name}>
          <span className="msg__file-icon">
            <Icon name="file" size={22} />
          </span>
          <span className="msg__file-text">
            <strong>{attachment.name}</strong>
            <span>{formatBytes(attachment.size)}</span>
          </span>
          <Icon name="download" size={18} className="msg__file-dl" />
        </a>
      );
  }
}

/** Groups reactions by emoji: [{ emoji, count, mine }] */
function groupReactions(reactions = [], meId) {
  const map = new Map();
  for (const r of reactions) {
    const entry = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    entry.count += 1;
    if (r.user === meId) entry.mine = true;
    map.set(r.emoji, entry);
  }
  return [...map.values()];
}

export default function MessageBubble({
  message,
  isMine,
  meId,
  showMeta,
  tick,
  highlighted,
  onDelete,
  onRetry,
  onDiscard,
  onOpenMedia,
  onReact,
  onReply,
  onEdit,
  onJumpTo,
}) {
  const [showReactions, setShowReactions] = useState(false);

  if (message.type === 'system') {
    return (
      <div className="msg-system" data-message-id={message.id}>
        <span>
          <strong>{message.sender?.displayName || 'Someone'}</strong> {message.content}
        </span>
      </div>
    );
  }

  const deleted = Boolean(message.deletedAt);
  const isMedia = !deleted && message.type !== 'text' && message.attachment;
  const uploading = message.pending && typeof message.progress === 'number' && message.progress < 1;
  // Time/ticks float over the picture only for photos and videos without a caption.
  const overlayMeta = isMedia && ['image', 'video'].includes(message.type) && !message.content;
  const settled = !message.pending && !message.failed && !deleted;
  const canEdit = settled && isMine && message.type === 'text' && Date.now() - new Date(message.createdAt) < EDIT_WINDOW_MS;
  const reactions = groupReactions(message.reactions, meId);

  return (
    <div
      className={`msg ${isMine ? 'msg--mine' : 'msg--theirs'} ${showMeta ? 'msg--first' : ''} ${message.failed ? 'msg--failed' : ''} ${isMedia ? `msg--${message.type}` : ''} ${highlighted ? 'msg--highlight' : ''}`}
      data-message-id={message.id}
      onMouseLeave={() => setShowReactions(false)}
    >
      {!isMine && showMeta && <span className="msg__sender">{message.sender?.displayName}</span>}
      <div className="msg__row">
        <div className="msg__bubble">
          {message.replyTo && !deleted && (
            <button type="button" className="msg__quote" onClick={() => onJumpTo?.(message.replyTo.id)}>
              <strong>{message.replyTo.sender?.displayName || 'Message'}</strong>
              <span>{messageSummary(message.replyTo) || '…'}</span>
            </button>
          )}
          {isMedia && <Media message={message} onOpen={onOpenMedia} />}
          {uploading && (
            <div className="msg__progress" aria-label="Uploading">
              <div style={{ width: `${Math.round(message.progress * 100)}%` }} />
            </div>
          )}
          {deleted ? (
            <em className="msg__deleted">
              <Icon name="alert" size={13} /> This message was deleted
            </em>
          ) : (
            message.content && <span className="msg__text">{message.content}</span>
          )}
          <span className={`msg__meta ${overlayMeta ? 'msg__meta--overlay' : ''}`}>
            {message.editedAt && !deleted && <span className="msg__edited">edited</span>}
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
            {isMine && !deleted && <Ticks message={message} tick={tick} />}
          </span>
        </div>

        {settled && (
          <div className="msg__tools">
            <button type="button" className="msg__tool" onClick={() => setShowReactions((v) => !v)} aria-label="React" title="React">
              <Icon name="smile" size={15} />
            </button>
            <button type="button" className="msg__tool" onClick={() => onReply?.(message)} aria-label="Reply" title="Reply">
              <Icon name="reply" size={15} />
            </button>
            {canEdit && (
              <button type="button" className="msg__tool" onClick={() => onEdit?.(message)} aria-label="Edit" title="Edit">
                <Icon name="edit-2" size={14} />
              </button>
            )}
            {isMine && (
              <button type="button" className="msg__tool msg__tool--danger" onClick={() => onDelete(message)} aria-label="Delete message" title="Delete">
                <Icon name="trash" size={14} />
              </button>
            )}
            {showReactions && (
              <div className="react-bar" role="menu">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    role="menuitem"
                    onClick={() => {
                      setShowReactions(false);
                      onReact?.(message, emoji);
                    }}
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {reactions.length > 0 && (
        <div className="msg__reactions">
          {reactions.map((r) => (
            <button
              type="button"
              key={r.emoji}
              className={`reaction ${r.mine ? 'is-mine' : ''}`}
              onClick={() => onReact?.(message, r.emoji)}
              title={r.mine ? 'Remove your reaction' : `React ${r.emoji}`}
            >
              {r.emoji} {r.count > 1 && <span>{r.count}</span>}
            </button>
          ))}
        </div>
      )}

      {message.failed && (
        <div className="msg__failed">
          Not sent ·{' '}
          <button type="button" className="link" onClick={() => onRetry(message)}>
            Retry
          </button>{' '}
          ·{' '}
          <button type="button" className="link" onClick={() => onDiscard(message)}>
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
