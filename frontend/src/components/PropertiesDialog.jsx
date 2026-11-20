import Dialog from './Dialog'
import { useAuth } from '../auth'
import { formatSize, kindOf } from '../api'

const pad = (n) => String(n).padStart(2, '0')

function formatDuration(sec) {
  if (!Number.isFinite(sec)) return undefined
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

const formatBitrate = (bps) => {
  if (!bps) return undefined
  return bps >= 1e6 ? `${(bps / 1e6).toFixed(1)} Mbps` : `${Math.round(bps / 1000)} kbps`
}
const upper = (s) => (s ? String(s).toUpperCase() : undefined)
const channelsLabel = (n) => (n === 1 ? 'Mono' : n === 2 ? 'Estéreo' : n ? `${n} canales` : undefined)
const formatDate = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleString('es')
}

function technicalRows(file) {
  const m = file.metadata || {}
  const size = m.width && m.height ? `${m.width} × ${m.height} px` : undefined
  const kind = kindOf(file)

  if (kind === 'image') {
    return [
      ['Dimensiones', size],
      ['Megapíxeles', m.width && m.height ? `${((m.width * m.height) / 1e6).toFixed(1)} MP` : undefined],
      ['Formato', upper(m.format)],
      ['Espacio de color', m.colorSpace],
      ['Transparencia', m.hasAlpha === undefined ? undefined : m.hasAlpha ? 'Sí' : 'No'],
      ['Resolución', m.density ? `${m.density} ppp` : undefined],
    ]
  }
  if (kind === 'video') {
    return [
      ['Duración', formatDuration(m.duration)],
      ['Resolución', size],
      ['Fotogramas por segundo', m.fps ? `${m.fps} fps` : undefined],
      ['Códec de video', upper(m.videoCodec)],
      ['Códec de audio', upper(m.audioCodec)],
      ['Bitrate total', formatBitrate(m.bitrate)],
      ['Contenedor', m.container],
      ['Fecha de grabación', m.createdAt ? formatDate(m.createdAt) : undefined],
    ]
  }
  return [
    ['Duración', formatDuration(m.duration)],
    ['Títu­lo', m.title],
    ['Artista', m.artist],
    ['Álbum', m.album],
    ['Códec', upper(m.audioCodec)],
    ['Bitrate', formatBitrate(m.bitrate)],
    ['Frecuencia de muestreo', m.sampleRate ? `${(m.sampleRate / 1000).toFixed(1)} kHz` : undefined],
    ['Canales', channelsLabel(m.channels)],
    ['Contenedor', m.container],
  ]
}

function PropList({ rows }) {
  return (
    <dl className="props">
      {rows.map(([label, value]) => (
        <div className="prop-row" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function PropertiesDialog({ file, onClose }) {
  const { user } = useAuth()
  const owner = file.owner
    ? file.user_id === user.id ? `${file.owner} (vos)` : file.owner
    : 'Sin dueño'

  const general = [
    ['Nombre', file.original_name],
    ['Tipo', file.mime_type],
    ['Tamaño', `${formatSize(file.size)} (${Number(file.size).toLocaleString('es')} bytes)`],
    ['Subido por', owner],
    ['Dispositivo', file.device || 'No registrado'],
    ['Fecha de subida', formatDate(file.created_at)],
    ['Guardado como', file.stored_name],
  ]
  const technical = technicalRows(file).filter(([, v]) => v !== undefined && v !== null && v !== '')

  return (
    <Dialog title="Propiedades" icon="bi-info-circle" onClose={onClose}>
      <div className="dialog-body">
        <div className="prop-section">General</div>
        <PropList rows={general} />

        <div className="prop-section">Datos técnicos</div>
        {technical.length ? (
          <PropList rows={technical} />
        ) : (
          <p className="text-secondary small mb-0">
            No hay datos técnicos disponibles para este archivo.
          </p>
        )}
      </div>
    </Dialog>
  )
}
