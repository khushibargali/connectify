import { useLayoutEffect, useMemo, useRef } from 'react';
import { formatDayLabel, isSameDay } from '../../lib/format.js';
import Spinner from '../common/Spinner.jsx';
import MessageBubble from './MessageBubble.jsx';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Turns a flat message list into rows with day dividers and sender grouping. */
function buildRows(items, meId) {
  const rows = [];
  let previous = null;
  for (const message of items) {
    if (!previous || !isSameDay(previous.createdAt, message.createdAt)) {
      rows.push({ kind: 'day', key: `day-${message.id}`, label: formatDayLabel(message.createdAt) });
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

export default function MessageList({ conversation, bucket, meId, onLoadOlder, onDelete, onRetry, onDiscard, onOpenMedia }) {
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef(null);
  const items = bucket?.items ?? [];

  const rows = useMemo(() => buildRows(items, meId), [items, meId]);

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
      {rows.map((row) =>
        row.kind === 'day' ? (
          <div key={row.key} className="day-divider">
            <span>{row.label}</span>
          </div>
        ) : (
          <MessageBubble
            key={row.key}
            message={row.message}
            isMine={row.isMine}
            showMeta={row.showMeta}
            tick={row.isMine ? tickFor(conversation, row.message, meId) : null}
            onDelete={onDelete}
            onRetry={onRetry}
            onDiscard={onDiscard}
            onOpenMedia={onOpenMedia}
          />
        ),
      )}
    </div>
  );
}
