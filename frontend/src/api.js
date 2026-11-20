import { useEffect, useState } from 'react'

export const FOLDERS = [
  { key: 'image', to: '/imagenes', label: 'Imágenes', icon: 'bi-image-fill' },
  { key: 'video', to: '/videos', label: 'Videos', icon: 'bi-camera-video-fill' },
  { key: 'audio', to: '/audios', label: 'Audios', icon: 'bi-music-note-beamed' },
]

export const fileUrl = (f) => `/uploads/${f.stored_name}`
export const thumbUrl = (f) => (f.thumb_name ? `/uploads/thumbs/${f.thumb_name}` : fileUrl(f))
export const kindOf = (f) => f.mime_type.split('/')[0]

// fetch que avisa a la app cuando la sesión venció (401), para volver al login
export async function api(url, options = {}) {
  const res = await fetch(url, options)
  if (res.status === 401 && !url.startsWith('/api/auth/')) {
    window.dispatchEvent(new Event('auth:expired'))
  }
  return res
}

// Envía JSON y devuelve la respuesta, o lanza un Error con el mensaje del servidor
export async function sendJson(url, method, body) {
  const res = await api(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error inesperado')
  return data
}

export function formatSize(b) {
  const n = Number(b)
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
export function timeAgo(iso) {
  const diff = (new Date(iso) - Date.now()) / 1000
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit)
  }
  return 'justo ahora'
}

// Carga archivos del backend. Con búsqueda espera 250 ms después de la última tecla.
export function useFiles({ type, q, limit, version }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (type) params.set('type', type)
        if (q) params.set('q', q)
        if (limit) params.set('limit', limit)
        const res = await api(`/api/files?${params}`, { signal: controller.signal })
        if (res.ok) setFiles(await res.json())
        setLoading(false)
      } catch (err) {
        if (err.name !== 'AbortError') setLoading(false)
      }
    }, q ? 250 : 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [type, q, limit, version])

  return { files, loading }
}

// XMLHttpRequest porque fetch no permite medir el progreso de subida
export function uploadFiles(files, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/files')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* sin cuerpo JSON */ }
      if (xhr.status === 401) window.dispatchEvent(new Event('auth:expired'))
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new Error(data.error || 'Error al subir el archivo'))
    }
    xhr.onerror = () => reject(new Error('Error de red'))
    xhr.send(formData)
  })
}
