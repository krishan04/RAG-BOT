import { FileText, ScanSearch } from 'lucide-react'
import type { ExecutionTrace, RetrievalSource } from '../../models'
import { basename, formatScore } from '../../lib/format'
import { useTrace } from '../telemetry/TraceContext'

interface SourceBadgeProps {
  source: RetrievalSource
  trace?: ExecutionTrace
}

export function SourceBadge({ source, trace }: SourceBadgeProps) {
  const { focus } = useTrace()

  return (
    <button
      type="button"
      onClick={() => focus(source, trace ?? null)}
      className="group inline-flex max-w-full items-center gap-1.5 rounded border border-border bg-surface-card px-2 py-1 font-mono text-[11px] leading-none text-secondary transition-colors hover:border-primary/60 hover:text-primary-ink"
      title={`Inspect ${basename(source.source)} · chunk ${source.chunk_index}`}
    >
      <FileText className="h-3 w-3 shrink-0 text-primary" />
      <span className="max-w-[180px] truncate">{basename(source.source)}</span>
      {source.page != null && <span className="shrink-0 text-faint">p.{source.page}</span>}
      <span className="shrink-0 text-faint">·</span>
      <span className="shrink-0 text-accent-emerald">{formatScore(source.score)}</span>
      <ScanSearch className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}