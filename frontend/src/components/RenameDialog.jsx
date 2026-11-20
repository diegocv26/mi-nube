import { useState } from 'react'
import Dialog from './Dialog'
import { sendJson } from '../api'

// Separa "vacaciones.jpg" en ["vacaciones", ".jpg"] para proteger la extensión
function splitName(name) {
  const dot = name.lastIndexOf('.')
  if (dot > 0 && name.length - dot <= 6) return [name.slice(0, dot), name.slice(dot)]
  return [name, '']
}

export default function RenameDialog({ file, onClose, onSaved }) {
  const [initialBase, ext] = splitName(file.original_name)
  const [base, setBase] = useState(initialBase)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const name = base.trim()
    if (!name) {
      setError('El nombre no puede estar vacío')
      return
    }
    setSaving(true)
    setError('')
    try {
      await sendJson(`/api/files/${file.id}`, 'PATCH', { name: name + ext })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Dialog title="Editar nombre" icon="bi-pencil" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog-body">
          <label className="form-label small text-secondary" htmlFor="rename-input">
            Nombre del archivo
          </label>
          <div className="input-group">
            <input
              id="rename-input"
              className="form-control"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              onFocus={(e) => e.target.select()}
              maxLength={250}
              autoFocus
            />
            {ext && <span className="input-group-text">{ext}</span>}
          </div>
          {error && <div className="alert alert-danger py-2 mt-3 mb-0 small">{error}</div>}
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
