import { formatTime } from '../../lib/format.js';
import { formatBytes, formatDuration, resolveMediaUrl } from '../../lib/media.js';
import Icon from '../common/Icon.jsx';

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

export default function MessageBubble({ message, isMine, showMeta, tick, onDelete, onRetry, onDiscard, onOpenMedia }) {
  if (message.type === 'system') {
    return (
      <div className="msg-system">
        <span>
          <strong>{message.sender?.displayName || 'Someone'}</strong> {message.content}
        </span>
      </div>
    );
  }

  const deleted = Boolean(message.deletedAt);
  const isMedia = !deleted && message.type !== 'text' && message.attachment;
  const uploading = message.pending && typeof message.progress === 'number' && message.progress < 1;

  return (
    <div className={`msg ${isMine ? 'msg--mine' : 'msg--theirs'} ${showMeta ? 'msg--first' : ''} ${message.failed ? 'msg--failed' : ''} ${isMedia ? `msg--${message.type}` : ''}`}>
      {!isMine && showMeta && <span className="msg__sender">{message.sender?.displayName}</span>}
      <div className="msg__row">
        <div className="msg__bubble">
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
          <span className={`msg__meta ${isMedia && !message.content ? 'msg__meta--overlay' : ''}`}>
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
            {isMine && !deleted && <Ticks message={message} tick={tick} />}
          </span>
        </div>
        {isMine && !deleted && !message.pending && !message.failed && (
          <button type="button" className="msg__action" onClick={() => onDelete(message)} aria-label="Delete message" title="Delete">
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
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
