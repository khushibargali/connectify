import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ChatProvider } from '../context/ChatContext.jsx';
import { SocketProvider } from '../context/SocketContext.jsx';
import Spinner from './common/Spinner.jsx';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="fullscreen-center">
        <Spinner size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <SocketProvider>
      <ChatProvider>
        <Outlet />
      </ChatProvider>
    </SocketProvider>
  );
}
