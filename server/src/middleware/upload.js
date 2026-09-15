import crypto from 'node:crypto';
import multer from 'multer';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, baseMime, ensureUploadDir } from '../config/uploads.js';
import ApiError from '../utils/ApiError.js';

const monthFolder = () => new Date().toISOString().slice(0, 7);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadDir(monthFolder()));
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const type = ALLOWED_TYPES[baseMime(file.mimetype)];
    cb(null, `${crypto.randomUUID()}.${type.ext}`);
  },
});

/** `multipart/form-data` with a single "file" field. Type allow-list and size limit enforced. */
export const uploadSingle = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = baseMime(file.mimetype);
    if (ALLOWED_TYPES[mime]) return cb(null, true);
    return cb(ApiError.badRequest(`Unsupported file type${mime ? `: ${mime}` : ''}`));
  },
}).single('file');
