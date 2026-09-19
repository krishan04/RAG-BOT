import { useEffect, useState } from 'react'
import { ChevronDown, FlaskConical, Play, RefreshCw } from 'lucide-react'
import { listBenchmarks, runBenchmark } from '../api/client'
import type { BenchmarkRun } from '../models'
import { cn } from '../lib/cn'
import { formatDate } from '../lib/format'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'

const EMBEDDINGS = [
  { value: 'google', label: 'Google' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'huggingface', label: 'HuggingFace' },
]

const RETRIEVERS = [
  { value: 'base', label: 'Base' },
  { value: 'contextual_compression', label: 'Contextual Compression' },
  { value: 'cohere_rerank', label: 'Cohere Rerank' },
]

const STATUS_COLOR: Record<string, 'neutral' | 'accent-emerald' | 'accent-amber' | 'danger' | 'primary'> = {
  completed: 'accent-emerald',
  running: 'accent-amber',
  pending: 'neutral',
  failed: 'danger',
}

interface ResultRow {
  embeddings: string
  retriever: string
  ingestion_ms: number
  query_ms: number
  status: string
}

export function BenchmarksLab() {
  const [runs, setRuns] = useState<BenchmarkRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const [name, setName] = useState('')
  const [embeddings, setEmbeddings] = useState<string[]>([EMBEDDINGS[0].value])
  const [retrievers, setRetrievers] = useState<string[]>([RETRIEVERS[0].value])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const data = await listBenchmarks()
      setRuns(data)
    } catch {
      setRuns([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const toggleItem = (value: string, list: string[], set: (v: string[]) => void) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const run = async () => {
    if (embeddings.length === 0 || retrievers.length === 0) {
      setError('Select at least one embeddings and one retriever variant.')
      return
    }
    setError('')
    setRunning(true)
    try {
      await runBenchmark({
        embeddings,
        retrievers,
      })
      setName('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  const results = (run: BenchmarkRun): ResultRow[] =>
    (run.results_json?.results as unknown as ResultRow[]) ?? []

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-primary">Benchmark Lab</h1>
            <p className="text-xs text-faint">
              Compare component variants against the benchmark corpus
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          {/* Trigger form */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <FlaskConical className="h-4 w-4 text-primary" /> New Benchmark Run
            </h2>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
                  Run name
                </label>
                <Input
                  placeholder="e.g. embeddings × retrievers sweep"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
                    Embeddings
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMBEDDINGS.map((e) => (
                      <button
                        key={e.value}
                        type="button"
                        onClick={() => toggleItem(e.value, embeddings, setEmbeddings)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          embeddings.includes(e.value)
                            ? 'border-primary/50 bg-primary/15 text-primary-ink'
                            : 'border-border text-secondary hover:text-primary',
                        )}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
                    Retrievers
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {RETRIEVERS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => toggleItem(r.value, retrievers, setRetrievers)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          retrievers.includes(r.value)
                            ? 'border-primary/50 bg-primary/15 text-primary-ink'
                            : 'border-border text-secondary hover:text-primary',
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="primary" onClick={run} disabled={running}>
                  {running ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Running…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Run Benchmark
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Runs list */}
          <div className="space-y-2">
            {loading && <p className="text-sm text-faint">Loading runs…</p>}
            {!loading && runs.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-secondary">No benchmark runs yet</p>
                <p className="text-xs text-faint">Configure a matrix above and run your first sweep.</p>
              </div>
            )}

            {runs.map((run) => {
              const isOpen = expanded === run.id
              return (
                <div key={run.id} className="rounded-xl border border-border bg-surface">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : run.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-secondary transition-transform', isOpen && 'rotate-180')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-primary">
                        {run.name || `Run #${run.id}`}
                      </span>
                      <span className="block text-xs text-faint">
                        {Object.entries(run.config_json?.config_matrix ?? {})
                          .map(([k, v]) => `${k}: ${v.join(', ')}`)
                          .join(' · ')}
                      </span>
                    </span>
                    <Badge variant={STATUS_COLOR[run.status] ?? 'neutral'}>{run.status}</Badge>
                    <span className="shrink-0 text-xs text-faint">{formatDate(run.created_at)}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-4 py-3">
                      {results(run).length === 0 ? (
                        <p className="text-xs text-faint">No results recorded.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-faint">
                              <th className="py-2 pr-3 font-medium">Embeddings</th>
                              <th className="py-2 pr-3 font-medium">Retriever</th>
                              <th className="py-2 pr-3 text-right font-medium">Ingest</th>
                              <th className="py-2 text-right font-medium">Query</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results(run).map((r: ResultRow, i: number) => (
                              <tr key={i} className="border-b border-border/60 last:border-0">
                                <td className="py-2 pr-3 text-secondary">{r.embeddings}</td>
                                <td className="py-2 pr-3 text-secondary">{r.retriever}</td>
                                <td className="py-2 pr-3 text-right font-mono text-accent-emerald">
                                  {formatNumber(r.ingestion_ms)} ms
                                </td>
                                <td className="py-2 text-right font-mono text-accent-emerald">
                                  {formatNumber(r.query_ms)} ms
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

function formatNumber(value?: number): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value >= 100 ? Math.round(value).toString() : value.toFixed(1)
}