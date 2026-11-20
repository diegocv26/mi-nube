import { useEffect } from 'react'

export default function Dialog({ title, icon, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h2 className="dialog-title">
            {icon && <i className={`bi ${icon}`} />}
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} title="Cerrar (Esc)">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
