import path from 'node:path';
import { ALLOWED_TYPES, baseMime, publicUrlFor } from '../config/uploads.js';
import ApiError from '../utils/ApiError.js';

export async function upload(req, res) {
  if (!req.file) throw ApiError.badRequest('No file received (send it as the "file" field)');
  const mimeType = baseMime(req.file.mimetype);
  const { kind } = ALLOWED_TYPES[mimeType];
  res.status(201).json({
    attachment: {
      url: publicUrlFor(req.file.path),
      name: path.basename(req.file.originalname || `upload.${path.extname(req.file.path)}`).slice(0, 255),
      mimeType,
      size: req.file.size,
      kind,
    },
  });
}
