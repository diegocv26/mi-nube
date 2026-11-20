import { useCallback, useState } from 'react'
import Viewer from './Viewer'
import Menu from './Menu'
import RenameDialog from './RenameDialog'
import PropertiesDialog from './PropertiesDialog'
import { useAuth } from '../auth'
import { api, fileUrl, formatSize, kindOf, thumbUrl, timeAgo } from '../api'

function Thumb({ file }) {
  const [failed, setFailed] = useState(false)
  const kind = kindOf(file)

  if (kind === 'image' && !failed) {
    return <img src={thumbUrl(file)} alt="" loading="lazy" onError={() => setFailed(true)} />
  }
  if (kind === 'video') {
    return (
      <>
        {/* #t=0.1 hace que el navegador muestre un cuadro como miniatura */}
        <video src={`${fileUrl(file)}#t=0.1`} preload="metadata" muted playsInline />
        <span className="play-badge"><i className="bi bi-play-fill" /></span>
      </>
    )
  }
  return (
    <div className="thumb-icon">
      <i className={`bi ${kind === 'image' ? 'bi-image' : 'bi-music-note-beamed'}`} />
    </div>
  )
}

export default function FileGrid({ files, loading, onChanged, empty }) {
  const { user } = useAuth()
  const [current, setCurrent] = useState(null)   // archivo abierto en el visor
  const [editing, setEditing] = useState(null)   // archivo que se está renombrando
  const [propsFile, setPropsFile] = useState(null) // archivo cuyas propiedades se ven
  const close = useCallback(() => setCurrent(null), [])
  const closeEdit = useCallback(() => setEditing(null), [])
  const closeProps = useCallback(() => setPropsFile(null), [])

  const handleDelete = async (file) => {
    if (!confirm(`¿Eliminar "${file.original_name}"?`)) return
    const res = await api(`/api/files/${file.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'No se pudo eliminar el archivo')
      return
    }
    onChanged()
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" />
      </div>
    )
  }

  if (!files.length) {
    return (
      <div className="empty">
        <i className="bi bi-inbox" />
        <p className="mb-0">{empty}</p>
      </div>
    )
  }

  return (
    <>
      <div className="file-grid">
        {files.map((f) => {
          const mine = f.user_id === user.id
          return (
            <article className="file-card" key={f.id}>
              <div className="thumb" onClick={() => setCurrent(f)}>
                <Thumb file={f} />
              </div>

              <div className="file-info">
                <div className="file-text">
                  <div className="file-name" title={f.original_name}>{f.original_name}</div>
                  <div className="file-meta">{formatSize(f.size)} · {timeAgo(f.created_at)}</div>
                  <div className="file-owner">
                    <i className="bi bi-person-fill" />
                    {mine ? 'Vos' : f.owner || 'Sin dueño'}
                  </div>
                </div>
                <Menu title="Más opciones" trigger={<i className="bi bi-three-dots-vertical" />}>
                  <button className="menu-item" role="menuitem" onClick={() => setPropsFile(f)}>
                    <i className="bi bi-info-circle" /> Propiedades
                  </button>
                </Menu>
              </div>

              <div className="file-actions">
                {mine && (
                  <button className="icon-btn" onClick={() => setEditing(f)} title="Editar nombre">
                    <i className="bi bi-pencil" />
                  </button>
                )}
                <a className="icon-btn" href={`/api/files/${f.id}/download`} title="Descargar">
                  <i className="bi bi-download" />
                </a>
                {mine && (
                  <button className="icon-btn danger" onClick={() => handleDelete(f)} title="Eliminar">
                    <i className="bi bi-trash3" />
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {current && <Viewer file={current} onClose={close} />}
      {propsFile && <PropertiesDialog file={propsFile} onClose={closeProps} />}
      {editing && (
        <RenameDialog
          file={editing}
          onClose={closeEdit}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}
