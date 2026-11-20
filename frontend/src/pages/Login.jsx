import { useState } from 'react'
import { useAuth } from '../auth'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isRegister = mode === 'register'

  const switchMode = (m) => {
    setMode(m)
    setError('')
    setPassword('')
    setConfirm('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (isRegister && password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setBusy(true)
    try {
      await (isRegister ? register : login)(username.trim(), password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo"><i className="bi bi-cloud-fill" /></div>
        <h1 className="h4 text-center fw-bold mb-1">Mi nube</h1>
        <p className="text-center text-secondary small mb-4">
          {isRegister ? 'Creá tu cuenta' : 'Iniciá sesión para ver tus archivos'}
        </p>

        <div className="auth-tabs">
          <button type="button" className={!isRegister ? 'active' : ''} onClick={() => switchMode('login')}>
            Entrar
          </button>
          <button type="button" className={isRegister ? 'active' : ''} onClick={() => switchMode('register')}>
            Crear cuenta
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="username">Usuario</label>
            <input
              id="username"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 6 : undefined}
              required
            />
          </div>
          {isRegister && (
            <div className="mb-3">
              <label className="form-label" htmlFor="confirm">Repetí la contraseña</label>
              <input
                id="confirm"
                type="password"
                className="form-control"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
              <div className="form-text">Mínimo 6 caracteres.</div>
            </div>
          )}

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <button type="submit" className="btn btn-primary w-100" disabled={busy}>
            {busy ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
