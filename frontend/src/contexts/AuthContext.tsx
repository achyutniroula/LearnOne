import { createContext, useContext, useState, ReactNode } from 'react'
import api, { setToken } from '../api/api'

interface AuthUser {
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  async function login(email: string, password: string) {
    const { data } = await api.post<{ token: string; email: string }>('/api/auth/login', {
      email,
      password,
    })
    setToken(data.token)
    setUser({ email: data.email })
  }

  async function register(email: string, password: string) {
    const { data } = await api.post<{ token: string; email: string }>('/api/auth/register', {
      email,
      password,
    })
    setToken(data.token)
    setUser({ email: data.email })
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
