import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function ProtectedRouteLoading() {
    return (
        <div className="route-loading-fallback" role="status" aria-live="polite">
            <span className="route-loading-fallback__spinner" aria-hidden="true" />
            <span>Verificando acesso…</span>
        </div>
    );
}

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredPermissions?: string[];
    allowTemporaryPassword?: boolean;
}

export function ProtectedRoute({
    children,
    requiredPermissions,
    allowTemporaryPassword = false
}: ProtectedRouteProps) {
    const { user, profile, loading, mustChangePassword, profileLoading, hasPermission } = useAuth();

    if (loading) {
        return <ProtectedRouteLoading />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Só bloqueia a renderização se o perfil ainda não foi carregado.
    // Em recargas em segundo plano (ex: renovação de token), o perfil já existe
    // e a UI não deve ser desmontada, o que resetaria estados de formulários abertos.
    if (profileLoading && !profile) {
        return <ProtectedRouteLoading />;
    }

    if (mustChangePassword && !allowTemporaryPassword) {
        return <Navigate to="/alterar-senha" replace />;
    }

    if (requiredPermissions && !profile) {
        return <Navigate to="/login" replace />;
    }

    if (requiredPermissions && profile) {
        const hasAccess = requiredPermissions.some(permission => hasPermission(permission));
        if (!hasAccess) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <>{children}</>;
}

