import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" replace />
}
