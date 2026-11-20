import { useEffect } from 'react'
import { fileUrl, kindOf } from '../api'

export default function Viewer({ file, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const kind = kindOf(file)
  const url = fileUrl(file)

  return (
    <div className="viewer" onClick={onClose}>
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-title">{file.original_name}</div>
        <a className="icon-btn" href={`/api/files/${file.id}/download`} title="Descargar">
          <i className="bi bi-download" />
        </a>
        <button className="icon-btn" onClick={onClose} title="Cerrar (Esc)">
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="viewer-body" onClick={(e) => e.stopPropagation()}>
        {kind === 'image' && <img src={url} alt={file.original_name} />}
        {kind === 'video' && <video src={url} controls autoPlay playsInline />}
        {kind === 'audio' && (
          <div className="viewer-audio">
            <i className="bi bi-music-note-beamed" />
            <audio src={url} controls autoPlay />
          </div>
        )}
      </div>
    </div>
  )
}
