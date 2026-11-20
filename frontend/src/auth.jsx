import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, sendJson } from './api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // Al abrir la app: ¿ya hay una sesión válida?
  useEffect(() => {
    api('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  // Si en cualquier momento el servidor responde 401, volvemos al login
  useEffect(() => {
    const expired = () => setUser(null)
    window.addEventListener('auth:expired', expired)
    return () => window.removeEventListener('auth:expired', expired)
  }, [])

  const login = useCallback(
    async (username, password) =>
      setUser(await sendJson('/api/auth/login', 'POST', { username, password })),
    []
  )
  const register = useCallback(
    async (username, password) =>
      setUser(await sendJson('/api/auth/register', 'POST', { username, password })),
    []
  )
  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, checking, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
