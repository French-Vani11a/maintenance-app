import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({
  children,
  adminOnly = false,
  generalOnly = false,
}: {
  children: React.ReactNode
  adminOnly?: boolean
  generalOnly?: boolean
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  if (generalOnly && user.role !== 'general') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
