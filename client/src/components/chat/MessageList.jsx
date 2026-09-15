import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { formatDayLabel, isSameDay } from '../../lib/format.js';
import Spinner from '../common/Spinner.jsx';
import MessageBubble from './MessageBubble.jsx';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Turns a flat message list into rows with day dividers, an unread divider and sender grouping. */
function buildRows(items, meId, unreadMarker) {
  const rows = [];
  let previous = null;
  let unreadInserted = false;
  const unreadCount = unreadMarker
    ? items.filter((m) => m.sender?.id !== meId && new Date(m.createdAt) > new Date(unreadMarker)).length
    : 0;

  for (const message of items) {
    if (!previous || !isSameDay(previous.createdAt, message.createdAt)) {
      rows.push({ kind: 'day', key: `day-${message.id}`, label: formatDayLabel(message.createdAt) });
      previous = null;
    }
    if (!unreadInserted && unreadCount > 0 && message.sender?.id !== meId && new Date(message.createdAt) > new Date(unreadMarker)) {
      rows.push({ kind: 'unread', key: 'unread-divider', count: unreadCount });
      unreadInserted = true;
      previous = null;
    }
    const sameSender = previous && previous.sender?.id === message.sender?.id && previous.type !== 'system';
    const closeInTime = previous && new Date(message.createdAt) - new Date(previous.createdAt) < GROUP_WINDOW_MS;
    rows.push({
      kind: 'message',
      key: message.id,
      message,
      isMine: message.sender?.id === meId,
      showMeta: !(sameSender && closeInTime) || message.type === 'system',
    });
    previous = message;
  }
  return rows;
}

/** WhatsApp ticks: ✓ sent · ✓✓ delivered to every other member · blue ✓✓ read by every other member. */
function tickFor(conversation, message, meId) {
  const others = conversation.participants.filter((p) => p.user?.id !== meId);
  if (others.length === 0) return 'sent';
  const at = new Date(message.createdAt);
  if (others.every((p) => p.lastReadAt && new Date(p.lastReadAt) >= at)) return 'read';
  if (others.every((p) => p.lastDeliveredAt && new Date(p.lastDeliveredAt) >= at)) return 'delivered';
  return 'sent';
}

export default function MessageList({
  conversation,
  bucket,
  meId,
  unreadMarker,
  highlightId,
  onLoadOlder,
  onDelete,
  onRetry,
  onDiscard,
  onOpenMedia,
  onReact,
  onReply,
  onEdit,
  onJumpTo,
}) {
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef(null);
  const items = bucket?.items ?? [];

  const rows = useMemo(() => buildRows(items, meId, unreadMarker), [items, meId, unreadMarker]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (restoreFrom.current != null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [rows]);

  // Scroll a quoted or searched message into view when asked.
  useEffect(() => {
    if (!highlightId) return;
    const target = listRef.current?.querySelector(`[data-message-id="${highlightId}"]`);
    if (target) {
      stickToBottom.current = false;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [highlightId, rows]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && bucket?.hasMore && !bucket?.loading && items.length > 0) {
      restoreFrom.current = el.scrollHeight;
      onLoadOlder();
    }
  };

  return (
    <div className="messages" ref={listRef} onScroll={handleScroll}>
      {bucket?.loading && (
        <div className="messages__state">
          <Spinner size={18} />
        </div>
      )}
      {bucket?.error && !bucket.loading && (
        <div className="messages__state messages__state--error">
          {bucket.error}{' '}
          <button type="button" className="link" onClick={onLoadOlder}>
            Retry
          </button>
        </div>
      )}
      {bucket?.loaded && !bucket.hasMore && items.length > 0 && (
        <div className="messages__state">
          <span className="pill">🔒 Messages are stored securely on Connectify</span>
        </div>
      )}
      {bucket?.loaded && items.length === 0 && (
        <div className="messages__state">
          <span className="pill">No messages yet — say hello 👋</span>
        </div>
      )}
      {rows.map((row) => {
        if (row.kind === 'day') {
          return (
            <div key={row.key} className="day-divider">
              <span>{row.label}</span>
            </div>
          );
        }
        if (row.kind === 'unread') {
          return (
            <div key={row.key} className="unread-divider">
              <span>
                {row.count} unread message{row.count === 1 ? '' : 's'}
              </span>
            </div>
          );
        }
        return (
          <MessageBubble
            key={row.key}
            message={row.message}
            isMine={row.isMine}
            meId={meId}
            showMeta={row.showMeta}
            tick={row.isMine ? tickFor(conversation, row.message, meId) : null}
            highlighted={row.message.id === highlightId}
            onDelete={onDelete}
            onRetry={onRetry}
            onDiscard={onDiscard}
            onOpenMedia={onOpenMedia}
            onReact={onReact}
            onReply={onReply}
            onEdit={onEdit}
            onJumpTo={onJumpTo}
          />
        );
      })}
    </div>
  );
}
