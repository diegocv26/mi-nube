import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FileGrid from '../components/FileGrid'
import { api, FOLDERS, formatSize, useFiles } from '../api'

export default function Home({ q, version, onChanged }) {
  const [stats, setStats] = useState(null)
  const { files, loading } = useFiles({ q, limit: q ? 0 : 12, version })

useEffect(() => {
  api('/api/stats')
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => s && setStats(s))
    .catch(() => {})
}, [version])

  // Con una búsqueda activa, el inicio muestra solo los resultados
  if (q) {
    return (
      <>
        <h2 className="section-title">Resultados para “{q}”</h2>
        <FileGrid
          files={files}
          loading={loading}
          onChanged={onChanged}
          empty="No hay archivos con ese nombre."
        />
      </>
    )
  }

  const totalCount = stats ? FOLDERS.reduce((n, f) => n + stats[f.key].count, 0) : 0
  const totalSize = stats ? FOLDERS.reduce((n, f) => n + stats[f.key].size, 0) : 0

  return (
    <>
      <h1 className="page-title mb-1">Inicio</h1>
      <p className="text-secondary mb-4">
        {stats ? `${totalCount} archivos · ${formatSize(totalSize)} en total` : 'Cargando…'}
      </p>

      <section className="stats-grid mb-5">
        {FOLDERS.map((f) => (
          <Link key={f.key} to={f.to} className="stat-card">
            <div className={`stat-icon ${f.key}`}><i className={`bi ${f.icon}`} /></div>
            <div>
              <div className="stat-label">{f.label}</div>
              <div className="stat-value">{stats ? stats[f.key].count : '–'}</div>
              <div className="stat-sub">{formatSize(stats ? stats[f.key].size : 0)}</div>
            </div>
          </Link>
        ))}
      </section>

      <h2 className="section-title">Recientes</h2>
      <FileGrid
        files={files}
        loading={loading}
        onChanged={onChanged}
        empty="Todavía no hay archivos. ¡Subí el primero!"
      />
    </>
  )
}
