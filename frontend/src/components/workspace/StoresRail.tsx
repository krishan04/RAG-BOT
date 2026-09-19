import { useEffect, useMemo, useState } from 'react'
import { Database, FolderOpen, Plus, Search } from 'lucide-react'
import { getVectorStores } from '../../api/client'
import type { VectorStore } from '../../models'
import { cn } from '../../lib/cn'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { ScrollArea } from '../../ui/scroll-area'
import { TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from '../../ui/tooltip'
import { IngestionModal } from '../IngestionModal'

interface StoresRailProps {
  selectedStore: VectorStore | null
  onSelectStore: (store: VectorStore) => void
  refreshKey: number
  onStoresChanged: () => void
}

type MergedStore = VectorStore & { providerTag: string; docCount: number }

export function StoresRail({
  selectedStore,
  onSelectStore,
  refreshKey,
  onStoresChanged,
}: StoresRailProps) {
  const [stores, setStores] = useState<MergedStore[]>([])
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const refresh = async () => {
    try {
      const data = await getVectorStores()
      const known = new Map(data.django.map((s) => [s.name, s]))
      const merged: MergedStore[] = data.django.map((s) => ({
        ...s,
        providerTag: s.embedding_provider ?? 'openai',
        docCount: s.document_count ?? 0,
      }))
      data.persisted.forEach((p) => {
        if (!known.has(p)) {
          merged.push({
            id: -1,
            name: p,
            embedding_provider: null,
            persist_path: p,
            created_at: null,
            document_count: 0,
            chunk_size: 1600,
            chunk_overlap: 200,
            providerTag: 'unknown',
            docCount: 0,
          })
        }
      })
      merged.sort((a, b) => a.name.localeCompare(b.name))
      setStores(merged)
    } catch {
      setStores([])
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const filtered = useMemo(
    () => stores.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [stores, query],
  )

  const handleIngested = (name: string) => {
    const found = stores.find((s) => s.name === name)
    if (found) onSelectStore(found)
    setModalOpen(false)
    onStoresChanged()
  }

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="space-y-3 border-b border-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input
            placeholder="Search knowledge bases…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="primary" className="w-full" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> New Knowledge Base
        </Button>
      </div>

      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="p-2">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-faint">
                No knowledge bases yet.
                <br />
                Create one and upload documents.
              </p>
            )}
            <ul className="space-y-1">
              {filtered.map((s) => {
                const active = selectedStore?.name === s.name
                return (
                  <li key={s.name}>
                    <TooltipProvider>
                      <TooltipRoot>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onSelectStore(s)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                              active
                                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                                : 'text-secondary hover:bg-border/40 hover:text-primary',
                            )}
                          >
                            {active ? (
                              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <Database className="h-4 w-4 shrink-0" />
                            )}
                            <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              <Badge variant={active ? 'primary' : 'outline'}>{s.providerTag}</Badge>
                              <span className="text-[10px] text-faint">{s.docCount}</span>
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={16}>
                          {s.name} · {s.providerTag} · {s.docCount} document{s.docCount === 1 ? '' : 's'}
                        </TooltipContent>
                      </TooltipRoot>
                    </TooltipProvider>
                  </li>
                )
              })}
            </ul>
          </div>
        </ScrollArea>
      </div>

      <IngestionModal open={modalOpen} onOpenChange={setModalOpen} onComplete={handleIngested} />
    </aside>
  )
}