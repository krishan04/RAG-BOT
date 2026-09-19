import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, Plus, Upload } from 'lucide-react'
import { getVectorStores } from '../api/client'
import type { VectorStore } from '../models'
import { formatDate } from '../lib/format'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { IngestionModal } from './IngestionModal'

export function StoresView() {
  const [stores, setStores] = useState<VectorStore[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [targetStore, setTargetStore] = useState<string | undefined>(undefined)

  const refresh = async () => {
    try {
      const data = await getVectorStores()
      setStores(data.django)
    } catch {
      setStores([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const openIngest = (storeName?: string) => {
    setTargetStore(storeName)
    setModalOpen(true)
  }

  const totalDocs = stores.reduce((sum, s) => sum + (s.document_count ?? 0), 0)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-primary">Knowlborder Bases</h1>
          <p className="text-xs text-faint">
            {stores.length} base{stores.length === 1 ? '' : 's'} · {totalDocs} document
            {totalDocs === 1 ? '' : 's'} ingested
          </p>
        </div>
        <Button variant="primary" onClick={() => openIngest(undefined)}>
          <Plus className="h-4 w-4" /> New Knowlborder Base
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-2 p-6">
          {loading && <p className="text-sm text-faint">Loading…</p>}
          {!loading && stores.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
              <Database className="h-8 w-8 text-faint" />
              <p className="text-sm text-secondary">No knowledge bases yet</p>
              <p className="text-xs text-faint">Create one and upload your first documents.</p>
              <Button variant="primary" className="mt-2" onClick={() => openIngest(undefined)}>
                <Plus className="h-4 w-4" /> Create Knowlborder Base
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {stores.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Database className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-primary">{s.name}</span>
                    <Badge variant="primary">{s.embedding_provider ?? 'openai'}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-faint">
                    {s.document_count ?? 0} documents · created {formatDate(s.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openIngest(s.name)}>
                    <Upload className="h-3.5 w-3.5" /> Ingest
                  </Button>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-primary transition-colors hover:text-primary-hover"
                  >
                    Open in chat
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <IngestionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onComplete={() => refresh()}
        initialStoreName={targetStore}
      />
    </div>
  )
}