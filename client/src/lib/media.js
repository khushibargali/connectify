import { API_URL } from '../api/client.js';

export const MAX_UPLOAD_MB = 25;
export const ACCEPT_MEDIA = 'image/*,video/*';
export const ACCEPT_DOCS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,audio/*';

/** Uploaded files are stored on the API origin; make relative "/uploads/..." paths absolute. */
export function resolveMediaUrl(url) {
  if (!url) return '';
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  return `${API_URL}${url}`;
}

export function fileKind(file) {
  const type = (file?.type || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'file';
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** One-line description of a message for the sidebar, toasts and notifications. */
export function messageSummary(message) {
  if (!message) return '';
  if (message.deletedAt) return 'This message was deleted';
  switch (message.type) {
    case 'image':
      return message.content ? `📷 ${message.content}` : '📷 Photo';
    case 'video':
      return message.content ? `🎥 ${message.content}` : '🎥 Video';
    case 'audio':
      return message.attachment?.duration != null
        ? `🎤 Voice message (${formatDuration(message.attachment.duration)})`
        : '🎵 Audio';
    case 'file':
      return `📄 ${message.attachment?.name || 'Document'}`;
    default:
      return message.content;
  }
}
