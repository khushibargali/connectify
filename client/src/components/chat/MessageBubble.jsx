import { formatTime } from '../../lib/format.js';
import Icon from '../common/Icon.jsx';

export default function MessageBubble({ message, isMine, showMeta, status, onDelete, onRetry, onDiscard }) {
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

  return (
    <div className={`msg ${isMine ? 'msg--mine' : 'msg--theirs'} ${showMeta ? 'msg--first' : ''} ${message.failed ? 'msg--failed' : ''}`}>
      {!isMine && showMeta && <span className="msg__sender">{message.sender?.displayName}</span>}
      <div className="msg__row">
        <div className="msg__bubble">
          {deleted ? (
            <em className="msg__deleted">This message was deleted</em>
          ) : (
            <span className="msg__text">{message.content}</span>
          )}
          <span className="msg__meta">
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
            {isMine && !deleted && (
              <span className="msg__tick" aria-hidden="true">
                {message.pending ? (
                  <Icon name="clock" size={12} />
                ) : message.failed ? (
                  <Icon name="alert" size={12} />
                ) : status === 'Delivered' ? (
                  <Icon name="check" size={12} />
                ) : status ? (
                  <Icon name="check-double" size={12} />
                ) : (
                  <Icon name="check" size={12} />
                )}
              </span>
            )}
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
      {status && !message.failed && <span className="msg__status">{status}</span>}
    </div>
  );
}
