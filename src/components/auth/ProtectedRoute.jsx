import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import LoadingState from '../shared/LoadingState';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0C0B] flex items-center justify-center">
        <LoadingState label="Authenticating" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
