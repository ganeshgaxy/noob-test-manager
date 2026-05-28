import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api.js'
import type { AuthUser } from '../types/index.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthScreen = 'login' | 'forgot-password' | 'reset-password'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  /** Currently visible auth screen (only meaningful when user === null) */
  authScreen: AuthScreen
  setAuthScreen: (screen: AuthScreen) => void
  /** Token passed via URL ?token= for password reset flow */
  resetToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Call after a successful password change so mustChangePassword clears */
  refreshUser: () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login')
  const [resetToken, setResetToken] = useState<string | null>(null)

  // Pull ?token= from URL for the reset-password flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (t) {
      setResetToken(t)
      setAuthScreen('reset-password')
      // Clean the token from the URL without a full reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Check if there's already a valid session on mount
  useEffect(() => {
    api.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // Listen for 401 events dispatched by the api req() helper
  useEffect(() => {
    const handle = () => {
      setUser(null)
      setAuthScreen('login')
    }
    window.addEventListener('auth:unauthorized', handle)
    return () => window.removeEventListener('auth:unauthorized', handle)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await api.auth.login(email, password)
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {})
    setUser(null)
    setAuthScreen('login')
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.auth.me()
      setUser(u)
    } catch {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authScreen,
        setAuthScreen,
        resetToken,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
