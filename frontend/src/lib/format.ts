export function formatMs(ms?: number): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 1) return `${ms.toFixed(2)} ms`
  return `${Math.round(ms)} ms`
}

export function formatScore(score?: number | null): string {
  if (score == null || Number.isNaN(score)) return '—'
  return score.toFixed(4)
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function basename(path?: string): string {
  if (!path) return 'unknown source'
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}