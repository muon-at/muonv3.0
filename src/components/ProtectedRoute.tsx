import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { RightNavBar } from './RightNavBar';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'owner' | 'teamleder' | 'employee';
}

export function ProtectedRoute({ children, requiredRole = 'employee' }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const roleHierarchy: { [key: string]: number } = {
    owner: 3,
    teamleder: 2,
    employee: 1,
  };

  // Check if user has required role or higher
  const userRoleLevel = user.role ? roleHierarchy[user.role] : 0;
  if (userRoleLevel < roleHierarchy[requiredRole]) {
    return <Navigate to="/min-side" replace />;
  }

  return (
    <>
      {children}
      <RightNavBar />
    </>
  );
}
