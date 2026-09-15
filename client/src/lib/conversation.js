import { messageSummary } from './media.js';

/** Helpers for reading conversation objects as returned by the API. */

export function participantUsers(conversation) {
  return (conversation?.participants ?? []).map((p) => p.user).filter(Boolean);
}

export function otherParticipant(conversation, meId) {
  if (!conversation || conversation.type !== 'direct') return null;
  return participantUsers(conversation).find((u) => u.id !== meId) || null;
}

export function conversationTitle(conversation, meId) {
  if (!conversation) return '';
  if (conversation.type === 'group') return conversation.name || 'Group';
  return otherParticipant(conversation, meId)?.displayName || 'Unknown user';
}

export function isAdmin(conversation, userId) {
  return (conversation?.admins ?? []).some((a) => (typeof a === 'string' ? a : a?.id) === userId);
}

export function typingLabel(users) {
  const names = users.map((u) => u.displayName?.split(' ')[0] || 'Someone');
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

/** Human summary of the last message for the sidebar. */
export function previewText(conversation, meId) {
  const message = conversation?.lastMessage;
  if (!message) return 'No messages yet';
  const mine = message.sender?.id === meId;
  const sender = mine ? 'You' : message.sender?.displayName || '';
  if (message.type === 'system') return `${sender} ${message.content}`;
  const prefix = conversation.type === 'group' || mine ? `${sender}: ` : '';
  return `${prefix}${messageSummary(message)}`;
}
