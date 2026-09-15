import { useEffect } from 'react';
import { formatTime } from '../../lib/format.js';
import { resolveMediaUrl } from '../../lib/media.js';
import Icon from '../common/Icon.jsx';

export default function Lightbox({ message, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const src = resolveMediaUrl(message.attachment?.url);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Media viewer">
      <header className="lightbox__bar">
        <span>
          <strong>{message.sender?.displayName}</strong>
          <span className="lightbox__time">{formatTime(message.createdAt)}</span>
        </span>
        <span className="lightbox__actions">
          <a className="icon-btn" href={src} target="_blank" rel="noreferrer" download={message.attachment?.name} aria-label="Download">
            <Icon name="download" />
          </a>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </span>
      </header>
      <div className="lightbox__body" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {message.type === 'video' ? (
          <video src={src} controls autoPlay playsInline />
        ) : (
          <img src={src} alt={message.content || message.attachment?.name || ''} />
        )}
      </div>
      {message.content && <p className="lightbox__caption">{message.content}</p>}
    </div>
  );
}
