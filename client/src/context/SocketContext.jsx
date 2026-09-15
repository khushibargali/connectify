import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createSocket } from '../lib/socket.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null, connected: false });

/** Owns one Socket.IO connection for the lifetime of the authenticated session. */
export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const userId = user?.id;
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !userId) return undefined;

    const instance = createSocket(token);
    instance.on('connect', () => setConnected(true));
    instance.on('disconnect', () => setConnected(false));
    instance.on('connect_error', (err) => console.warn('[socket] connect_error:', err.message));
    setSocket(instance);

    return () => {
      instance.removeAllListeners();
      instance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token, userId]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
