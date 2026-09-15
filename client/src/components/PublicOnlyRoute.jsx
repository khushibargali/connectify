import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './common/Spinner.jsx';

export default function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="fullscreen-center">
        <Spinner size={32} />
      </div>
    );
  }
  if (user) return <Navigate to={location.state?.from || '/'} replace />;
  return <Outlet />;
}
