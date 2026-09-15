const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const shortDateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const fullDateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const longDayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

const DAY = 24 * 60 * 60 * 1000;

export const toDate = (value) => (value instanceof Date ? value : new Date(value));

export function isSameDay(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

const yesterdayOf = (now) => new Date(now.getTime() - DAY);

export function formatTime(value) {
  return timeFmt.format(toDate(value));
}

/** "Today", "Yesterday", "Monday, 3 March" or "3 Mar 2025" for day dividers. */
export function formatDayLabel(value) {
  const date = toDate(value);
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, yesterdayOf(now))) return 'Yesterday';
  return date.getFullYear() === now.getFullYear() ? longDayFmt.format(date) : fullDateFmt.format(date);
}

/** Compact timestamp for the conversation list. */
export function formatConversationTime(value) {
  const date = toDate(value);
  const now = new Date();
  if (isSameDay(date, now)) return formatTime(date);
  if (isSameDay(date, yesterdayOf(now))) return 'Yesterday';
  if (now - date < 6 * DAY) return weekdayFmt.format(date);
  return date.getFullYear() === now.getFullYear() ? shortDateFmt.format(date) : fullDateFmt.format(date);
}

export function formatLastSeen(value) {
  if (!value) return 'Offline';
  const date = toDate(value);
  const now = new Date();
  if (isSameDay(date, now)) return `Last seen today at ${formatTime(date)}`;
  if (isSameDay(date, yesterdayOf(now))) return `Last seen yesterday at ${formatTime(date)}`;
  return `Last seen ${formatConversationTime(date)}`;
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
