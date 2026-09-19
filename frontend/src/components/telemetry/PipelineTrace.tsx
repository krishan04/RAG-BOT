import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Brain,
  ChevronDown,
  FileSearch,
  FileText,
  GitBranch,
  ScanSearch,
} from 'lucide-react'
import type { ExecutionTrace, RetrievalSource, RetrieverName } from '../../models'
import { cn } from '../../lib/cn'
import { basename, formatMs, formatScore } from '../../lib/format'
import { useTrace } from './TraceContext'

type NodeKey = 'condense' | 'retrieve' | 'rerank' | 'synthesize'

function retrieverLabel(r?: RetrieverName): string {
  switch (r) {
    case 'cohere_rerank':
      return 'Cohere Rerank'
    case 'contextual_compression':
      return 'Contextual Compression'
    default:
      return 'Base Retriever'
  }
}

function Chunk({ source, trace }: { source: RetrievalSource; trace: ExecutionTrace | null }) {
  const { focus, focusSource } = useTrace()
  const focused = focusSource?.chunk_hash === source.chunk_hash

  return (
    <li
      className={cn(
        'rounded-lg border px-2 py-1.5',
        focused ? 'border-primary/60 bg-primary/10' : 'border-border bg-canvas',
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => focus(source, trace)}
        title="Focus chunk"
      >
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-secondary hover:text-primary-ink">
          <FileText className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate">{basename(source.source)}</span>
          {source.page != null && <span className="shrink-0 text-faint">p.{source.page}</span>}
          <span className="ml-auto shrink-0 font-mono text-[10px] text-accent-emerald">
            {formatScore(source.score)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-faint">
          <span>chunk {source.chunk_index}</span>
          <span>·</span>
          <span className="truncate">{source.chunk_hash}</span>
          <span className="ml-auto shrink-0">{formatMs(source.retrieval_ms)}</span>
        </div>
      </button>
      {focused && (
        <p className="mt-1.5 line-clamp-6 border-t border-border/60 pt-1.5 text-[11px] leading-relaxed text-secondary">
          {source.content}
        </p>
      )}
    </li>
  )
}

export function PipelineTrace() {
  const { trace, focusTrace, focusSource } = useTrace()
  const active = focusTrace ?? trace
  const [expanded, setExpanded] = useState<Set<NodeKey>>(new Set(['retrieve', 'rerank']))

  useEffect(() => {
    if (focusSource?.chunk_hash) {
      setExpanded((s) => new Set([...s, 'retrieve', 'rerank']))
    }
  }, [focusSource?.chunk_hash])

  const toggle = (key: NodeKey) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const nodes = useMemo(() => {
    if (!active) return null
    const n = active
    const fileTypes = (n.file_types?.length ? n.file_types : ['pdf']).join(', ')
    const chunkCfg = n.chunk_size != null ? `${n.chunk_size} / ${n.chunk_overlap ?? 0}` : '—'
    return [
      {
        key: 'condense' as NodeKey,
        step: '01',
        title: 'Pre-Processing',
        status: n.condense_ms != null && n.condense_ms > 0 ? 'ok' : 'skip',
        metric: formatMs(n.condense_ms),
        sub: n.condense_ms != null && n.condense_ms > 0 ? 'Memory condense stage' : 'No prior context — skipped',
        meta: [
          ['language', n.language ?? 'english'],
          ['files', fileTypes],
          ['chunk', chunkCfg],
        ],
        icon: GitBranch,
        payload: n.condensed_question,
      },
      {
        key: 'retrieve' as NodeKey,
        step: '02',
        title: 'Vector Lookup',
        status: n.k_retrieved > 0 ? 'ok' : 'error',
        metric: formatMs(n.retrieval_ms),
        sub: `Chroma similarity search · k=${Math.max(n.k_retrieved, n.sources.length)}`,
        meta: [
          ['retrieved', `${n.k_retrieved} chunk${n.k_retrieved === 1 ? '' : 's'}`],
          [
            'score range',
            n.score_bounds
              ? `${formatScore(n.score_bounds.min)}–${formatScore(n.score_bounds.max)}`
              : '—',
          ],
        ],
        icon: FileSearch,
        chunks: n.sources,
      },
      {
        key: 'rerank' as NodeKey,
        step: '03',
        title: retrieverLabel(n.retriever),
        status: n.rerank_ms != null && n.rerank_ms > 0 ? 'ok' : 'skip',
        metric: formatMs(n.rerank_ms),
        sub:
          n.rerank_ms != null && n.rerank_ms > 0
            ? 'Re-ranked after vector lookup'
            : n.retriever === 'cohere_rerank'
              ? 'No Cohere key — fallback ranking'
              : 'Base path — identity pass',
        meta: [
          ['filtered', `${n.k_filtered ?? n.k_retrieved} of ${n.k_retrieved}`],
          ['k', String(n.k_retrieved)],
        ],
        icon: ScanSearch,
        chunks: n.sources,
      },
      {
        key: 'synthesize' as NodeKey,
        step: '04',
        title: 'LLM Synthesis',
        status: 'ok',
        metric: formatMs(n.ttft_ms),
        sub: `${n.token_estimate ?? 0} estimated tokens`,
        meta: [
          ['ttft', formatMs(n.ttft_ms)],
          ['tokens', String(n.token_estimate ?? 0)],
          ['total', formatMs(n.query_ms)],
        ],
        icon: Brain,
        payload: n.condensed_question,
      },
    ]
  }, [active])

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent-emerald" />
            <h2 className="text-sm font-semibold text-primary">Execution Trace</h2>
          </div>
          {active && (
            <span className="rounded-full border border-border bg-surface-card px-2 py-0.5 font-mono text-[10px] text-secondary">
              {formatMs(active.query_ms)} total
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-faint">Real-time RAG pipeline telemetry</p>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {!nodes || !active ? (
          <div className="space-y-2">
            {[
              ['01', 'Pre-Processing'],
              ['02', 'Vector Lookup'],
              ['03', retrieverLabel(undefined)],
              ['04', 'LLM Synthesis'],
            ].map(([step, title]) => (
              <div
                key={step}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-card px-3 py-2.5 opacity-50"
              >
                <span className="text-[10px] font-mono text-faint">{step}</span>
                <span className="text-xs text-secondary">{title}</span>
              </div>
            ))}
            <p className="pt-2 text-center text-xs text-faint">
              Send a query to see a live execution trace.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {nodes.map((n) => {
              const isOpen = expanded.has(n.key)
              const NodeIcon = n.icon
              return (
                <div
                  key={n.key}
                  className={cn(
                    'rounded-xl border bg-surface-card transition-colors',
                    isOpen ? 'border-border-2' : 'border-border',
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                    onClick={() => toggle(n.key)}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        n.status === 'ok' && 'bg-accent-emerald shadow-[0_0_6px] shadow-accent-emerald/60',
                        n.status === 'skip' && 'bg-accent-amber',
                        n.status === 'error' && 'bg-danger',
                      )}
                    />
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-border/50 text-primary">
                      <NodeIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-primary">
                        <span className="font-mono text-[10px] text-faint">{n.step}</span> {n.title}
                      </span>
                      <span className="block truncate text-[10px] text-faint">{n.sub}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-accent-emerald">
                      {n.metric}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-faint transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="space-y-2.5 border-t border-border px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {n.meta.map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-md border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-secondary"
                          >
                            <span className="text-faint">{k}:</span> {v}
                          </span>
                        ))}
                      </div>

                      {n.payload && (
                        <p className="rounded-lg border border-border bg-canvas px-2 py-1.5 font-mono text-[10px] leading-relaxed text-secondary">
                          <span className="text-faint">condensed: </span>
                          {n.payload}
                        </p>
                      )}

                      {n.chunks && (
                        <ul className="space-y-1.5">
                          {n.chunks.map((c) => (
                            <Chunk key={c.chunk_hash} source={c} trace={active} />
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <footer className="border-t border-border px-4 py-3">
        {active ? (
          <div className="flex items-center justify-between font-mono text-[10px] text-faint">
            <span>
              tokens <span className="text-secondary">{active.token_estimate ?? 0}</span>
            </span>
            <span>
              ttft <span className="text-accent-emerald">{formatMs(active.ttft_ms)}</span>
            </span>
            <span>
              docs <span className="text-secondary">{active.sources.length}</span>
            </span>
          </div>
        ) : (
          <p className="text-center text-[10px] text-faint">
            Trace populates once a query completes.
          </p>
        )}
      </footer>
    </aside>
  )
}