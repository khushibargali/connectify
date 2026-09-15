import api from './client.js';

export const uploadsApi = {
  /** Uploads one file; resolves with { url, name, mimeType, size, kind }. */
  upload(file, { onProgress, signal } = {}) {
    const form = new FormData();
    form.append('file', file, file.name);
    return api
      .post('/uploads', form, {
        timeout: 0,
        signal,
        onUploadProgress: (event) => {
          if (onProgress) onProgress(event.total ? event.loaded / event.total : 0);
        },
      })
      .then((r) => r.data.attachment);
  },
};
