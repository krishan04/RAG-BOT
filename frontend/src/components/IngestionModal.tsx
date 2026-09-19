import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, FileUp, Loader2, Upload } from 'lucide-react'
import { getVectorStores, uploadDocuments } from '../api/client'
import type { EmbeddingProvider } from '../models'
import { cn } from '../lib/cn'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface IngestionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (storeName: string) => void
  initialStoreName?: string
  initialFiles?: File[] | null
}

const ACCEPTED = ['.pdf', '.txt', '.csv', '.docx']
const PROVIDERS: EmbeddingProvider[] = ['google', 'openai', 'huggingface']

type Stage = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export function IngestionModal({
  open,
  onOpenChange,
  onComplete,
  initialStoreName,
  initialFiles,
}: IngestionModalProps) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [storeName, setStoreName] = useState('')
  const [existingName, setExistingName] = useState('')
  const [provider, setProvider] = useState<EmbeddingProvider>('google')
  const [files, setFiles] = useState<File[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [chunkSize, setChunkSize] = useState(1600)
  const [chunkOverlap, setChunkOverlap] = useState(200)
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ store: string; chunks: number } | null>(null)
  const [error, setError] = useState('')
  const [existingStores, setExistingStores] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const refreshStores = useCallback(async () => {
    try {
      const data = await getVectorStores()
      const names = new Set(data.django.map((s) => s.name))
      data.persisted.forEach((p) => names.add(p))
      setExistingStores([...names].sort())
      if (!existingName && names.size > 0) setExistingName([...names][0])
    } catch {
      setExistingStores([])
    }
  }, [existingName])

  useEffect(() => {
    if (open) {
      setStage('idle')
      setProgress(0)
      setResult(null)
      setError('')
      setFiles(initialFiles ?? [])
      refreshStores()
      if (initialStoreName) {
        setMode('existing')
        setExistingName(initialStoreName)
      } else {
        setMode('new')
        setStoreName('')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFiles])

  const targetName = mode === 'new' ? storeName.trim() : existingName

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming)
    const valid = list.filter((f) => {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
      return ACCEPTED.includes(ext)
    })
    if (valid.length) {
      setFiles((prev) => [...prev, ...valid])
      setStage('idle')
      setError('')
    } else if (list.length) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED.join(', ')}`)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const run = async () => {
    if (files.length === 0 || !targetName) return
    setError('')
    setResult(null)
    setStage('uploading')
    setProgress(15)

    const timer = setInterval(() => {
      setProgress((p) => (p < 85 ? p + (100 - p) * 0.12 : p))
    }, 120)

    try {
      const res = await uploadDocuments({
        vectorStore: targetName,
        provider,
        files,
        chunkSize,
        chunkOverlap,
      })
      clearInterval(timer)
      setProgress(100)
      setStage('done')
      setResult({ store: targetName, chunks: res.chunk_count })
    } catch (err) {
      clearInterval(timer)
      setStage('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const finalize = () => {
    if (!result) return
    onComplete(result.store)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold text-primary">Ingest Documents</DialogTitle>
        <DialogDescription className="text-sm text-faint">
          Load documents into a knowledge base — chunked, embedded and persisted to Chroma.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-card p-1">
            {(['new', 'existing'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === m ? 'bg-primary/15 text-primary-ink' : 'text-secondary hover:text-primary',
                )}
              >
                {m === 'new' ? 'New Knowlborder Base' : 'Existing Base'}
              </button>
            ))}
          </div>

          {mode === 'new' ? (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
                Knowlborder base name
              </label>
              <Input
                placeholder="e.g. product-docs"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
                Target store
              </label>
              <Select value={existingName} onValueChange={setExistingName} disabled={existingStores.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={existingStores.length ? 'Select a store' : 'No stores available'} />
                </SelectTrigger>
                <SelectContent>
                  {existingStores.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Embedding provider
            </label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as EmbeddingProvider)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === 'google' ? 'Google' : p === 'openai' ? 'OpenAI' : 'HuggingFace'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-border-2 hover:bg-surface-card/50',
            )}
          >
            <FileUp className={cn('h-6 w-6', dragging ? 'text-primary' : 'text-secondary')} />
            {files.length === 0 ? (
              <>
                <p className="text-sm text-primary">Drag &amp; drop files here</p>
                <p className="text-xs text-faint">
                  or click to browse · {ACCEPTED.join(', ')}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-primary">{files.length} file{files.length === 1 ? '' : 's'} selected</p>
                <div className="flex flex-wrap justify-center gap-1">
                  {files.map((f) => (
                    <Badge key={f.name} variant="outline">
                      {f.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-faint">click to add more</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {/* Advanced chunking */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-secondary transition-colors hover:text-primary"
            >
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-180')}
              />
              Advanced chunking options
            </button>
            {showAdvanced && (
              <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-card p-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
                    Chunk size
                  </label>
                  <Input
                    type="number"
                    min={64}
                    max={8192}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
                    Chunk overlap
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={2048}
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          {/* Progress / result */}
          {(stage === 'uploading' || stage === 'processing') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-secondary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {stage === 'uploading' ? 'Uploading & ingesting…' : 'Embedding chunks…'}
                </span>
                <span className="text-faint">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {stage === 'done' && result && (
            <div className="flex items-center gap-3 rounded-lg border border-accent-emerald/30 bg-accent-emerald/10 px-4 py-3">
              <Upload className="h-5 w-5 shrink-0 text-accent-emerald" />
              <div className="text-sm">
                <p className="font-medium text-accent-emerald">Ingestion complete</p>
                <p className="text-xs text-secondary">
                  Ingested into <span className="text-primary">{result.store}</span> ·{' '}
                  {result.chunks} chunk{result.chunks === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {stage === 'done' ? (
              <Button variant="primary" onClick={finalize}>
                Done
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={files.length === 0 || !targetName || stage === 'uploading' || stage === 'processing'}
                onClick={run}
              >
                {stage === 'uploading' || stage === 'processing' ? 'Ingesting…' : 'Upload & Ingest'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}