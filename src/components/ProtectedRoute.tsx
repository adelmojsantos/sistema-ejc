import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/auth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
    allowTemporaryPassword?: boolean;
}

export function ProtectedRoute({
    children,
    allowedRoles,
    allowTemporaryPassword = false
}: ProtectedRouteProps) {
    const { user, profile, mustChangePassword, profileLoading } = useAuth();

    if (!user) {
        return <Navigate to="/" replace />;
    }

    if (profileLoading) {
        return null;
    }

    if (mustChangePassword && !allowTemporaryPassword) {
        return <Navigate to="/alterar-senha" replace />;
    }

    if (allowedRoles && !profile) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}

