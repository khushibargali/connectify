import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'));
export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;

/** Accepted MIME types → message kind and the extension used on disk. */
export const ALLOWED_TYPES = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/gif': { kind: 'image', ext: 'gif' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'image/heic': { kind: 'image', ext: 'heic' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/webm': { kind: 'video', ext: 'webm' },
  'video/quicktime': { kind: 'video', ext: 'mov' },
  'audio/mpeg': { kind: 'audio', ext: 'mp3' },
  'audio/mp4': { kind: 'audio', ext: 'm4a' },
  'audio/x-m4a': { kind: 'audio', ext: 'm4a' },
  'audio/aac': { kind: 'audio', ext: 'aac' },
  'audio/ogg': { kind: 'audio', ext: 'ogg' },
  'audio/webm': { kind: 'audio', ext: 'webm' },
  'audio/wav': { kind: 'audio', ext: 'wav' },
  'application/pdf': { kind: 'file', ext: 'pdf' },
  'application/msword': { kind: 'file', ext: 'doc' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { kind: 'file', ext: 'docx' },
  'application/vnd.ms-excel': { kind: 'file', ext: 'xls' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { kind: 'file', ext: 'xlsx' },
  'application/vnd.ms-powerpoint': { kind: 'file', ext: 'ppt' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { kind: 'file', ext: 'pptx' },
  'text/plain': { kind: 'file', ext: 'txt' },
  'application/zip': { kind: 'file', ext: 'zip' },
  'application/x-zip-compressed': { kind: 'file', ext: 'zip' },
};

/** Strips parameters such as ";codecs=opus" and lower-cases the type. */
export const baseMime = (value) => String(value || '').split(';')[0].trim().toLowerCase();

export function ensureUploadDir(sub = '') {
  const dir = path.join(UPLOAD_DIR, sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Maps a public "/uploads/..." URL to an absolute path inside UPLOAD_DIR, or null if it escapes. */
export function uploadPathFor(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const abs = path.resolve(UPLOAD_DIR, url.slice('/uploads/'.length));
  return abs.startsWith(UPLOAD_DIR + path.sep) ? abs : null;
}

export function publicUrlFor(absPath) {
  return `/uploads/${path.relative(UPLOAD_DIR, absPath).split(path.sep).join('/')}`;
}
