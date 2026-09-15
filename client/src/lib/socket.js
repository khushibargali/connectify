import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';

/** Creates an authenticated Socket.IO connection. Same-origin in dev (Vite proxy), API_URL in prod. */
export function createSocket(token) {
  const options = {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  };
  return API_URL ? io(API_URL, options) : io(options);
}
