import FileGrid from '../components/FileGrid'
import { useFiles } from '../api'

export default function Folder({ type, title, icon, q, version, onChanged }) {
  const { files, loading } = useFiles({ type, q, version })

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <h1 className="page-title mb-0">
          <i className={`bi ${icon}`} />
          {title}
        </h1>
        {!loading && <span className="badge rounded-pill text-bg-secondary">{files.length}</span>}
      </div>
      <FileGrid
        files={files}
        loading={loading}
        onChanged={onChanged}
        empty={q ? 'No hay archivos con ese nombre.' : `Todavía no hay ${title.toLowerCase()}.`}
      />
    </>
  )
}
