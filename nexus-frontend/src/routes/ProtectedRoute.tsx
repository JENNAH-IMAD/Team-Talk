import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/hooks';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const allowed = requiredRole.split('|');
    const hasRole = (user?.role && allowed.includes(user.role)) ||
                    (user?.secondaryRole && allowed.includes(user.secondaryRole));
    if (!hasRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // If children are passed, render them; otherwise render Outlet for nested routes
  return children ? <>{children}</> : <Outlet />;
};
