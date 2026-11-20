import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { FOLDERS, uploadFiles } from './api'
import { AuthProvider, useAuth } from './auth'
import Menu from './components/Menu'
import Home from './pages/Home'
import Folder from './pages/Folder'
import Login from './pages/Login'

const NAV = [{ to: '/', label: 'Inicio', icon: 'bi-house-door-fill' }, ...FOLDERS]

const NOTICE_ICONS = {
  success: 'bi-check-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  danger: 'bi-x-octagon-fill',
}

function ThemeSwitch({ theme, setTheme }) {
  return (
    <label className="theme-switch" title="Modo claro / oscuro">
      <i className="bi bi-sun-fill" />
      <div className="form-check form-switch m-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          checked={theme === 'dark'}
          onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
        />
      </div>
      <i className="bi bi-moon-stars-fill" />
    </label>
  )
}

function Layout() {
  const { user, logout } = useAuth()
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-bs-theme') || 'light'
  )
  const [q, setQ] = useState('')
  const [version, setVersion] = useState(0)
  const [progress, setProgress] = useState(null)
  const [notice, setNotice] = useState(null) // { type: 'success' | 'warning' | 'danger', text }
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)
  const uploading = useRef(false)

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  // Tema: se aplica en <html> y se guarda en el navegador
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Los avisos de éxito se ocultan solos; los errores quedan hasta cerrarlos
  useEffect(() => {
    if (!notice || notice.type === 'danger') return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const handleFiles = useCallback(async (picked) => {
    if (uploading.current) return
    const valid = picked.filter((f) => /^(image|video|audio)\//.test(f.type))
    if (!valid.length) {
      setNotice({ type: 'danger', text: 'Solo se pueden subir imágenes, videos o audios.' })
      return
    }

    uploading.current = true
    setNotice(null)
    setProgress(0)
    try {
      await uploadFiles(valid, setProgress)
      bump()
      const skipped = picked.length - valid.length
      setNotice({
        type: skipped ? 'warning' : 'success',
        text:
          `${valid.length} archivo(s) subido(s)` +
          (skipped ? ` · ${skipped} omitido(s) por no ser imagen, video o audio` : ''),
      })
    } catch (err) {
      setNotice({ type: 'danger', text: err.message })
    } finally {
      uploading.current = false
      setProgress(null)
    }
  }, [bump])

  // Arrastrar y soltar archivos en cualquier parte de la ventana
  useEffect(() => {
    let depth = 0
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')

    const onEnter = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const onOver = (e) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = (e) => {
      if (!hasFiles(e)) return
      depth--
      if (depth <= 0) {
        depth = 0
        setDragging(false)
      }
    }
    const onDrop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      handleFiles(Array.from(e.dataTransfer.files))
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFiles])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <i className="bi bi-cloud-fill" /> Mi nube
        </div>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="side-link">
            <i className={`bi ${item.icon}`} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="search">
            <i className="bi bi-search" />
            <input
              type="search"
              className="form-control"
              placeholder="Buscar por nombre…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <ThemeSwitch theme={theme} setTheme={setTheme} />

          <button
            className="btn btn-primary upload-btn"
            onClick={() => fileInput.current.click()}
            disabled={progress !== null}
          >
            <i className="bi bi-cloud-arrow-up-fill" />
            <span className="d-none d-sm-inline ms-2">Subir</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept="image/*,video/*,audio/*"
            onChange={(e) => {
              const picked = Array.from(e.target.files)
              e.target.value = ''
              handleFiles(picked)
            }}
          />

          <Menu
            title={user.username}
            buttonClass="avatar-btn"
            trigger={user.username[0].toUpperCase()}
          >
            <div className="menu-header">
              Sesión iniciada como
              <br />
              <strong className="text-body">{user.username}</strong>
            </div>
            <button className="menu-item" role="menuitem" onClick={logout}>
              <i className="bi bi-box-arrow-right" /> Cerrar sesión
            </button>
          </Menu>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Home q={q} version={version} onChanged={bump} />} />
            {FOLDERS.map((f) => (
              <Route
                key={f.key}
                path={f.to}
                element={
                  <Folder
                    key={f.key}
                    type={f.key}
                    title={f.label}
                    icon={f.icon}
                    q={q}
                    version={version}
                    onChanged={bump}
                  />
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {dragging && <div className="drop-overlay">Soltá los archivos para subirlos</div>}

      {(progress !== null || notice) && (
        <div className="notice">
          {progress !== null ? (
            <>
              <div className="d-flex justify-content-between small mb-2">
                <span>{progress === 100 ? 'Procesando…' : 'Subiendo archivos…'}</span>
                <span>{progress}%</span>
              </div>
              <div className="progress" style={{ height: 8 }}>
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <div className="d-flex align-items-start gap-2">
              <i className={`bi ${NOTICE_ICONS[notice.type]} text-${notice.type}`} />
              <div className="flex-grow-1 small">{notice.text}</div>
              <button
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                onClick={() => setNotice(null)}
                title="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Decide qué mostrar: cargando, login o la app
function Gate() {
  const { user, checking } = useAuth()

  if (checking) {
    return (
      <div className="auth-wrap">
        <div className="spinner-border text-primary" />
      </div>
    )
  }
  if (!user) return <Login />

  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
