import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ExecutionTrace, RetrievalSource } from '../../models'

interface TraceContextValue {
  trace: ExecutionTrace | null
  setTrace: (trace: ExecutionTrace | null) => void
  focusSource: RetrievalSource | null
  focusTrace: ExecutionTrace | null
  focus: (source: RetrievalSource | null, trace?: ExecutionTrace | null) => void
}

const TraceContext = createContext<TraceContextValue | null>(null)

export function TraceProvider({ children }: { children: ReactNode }) {
  const [trace, setTrace] = useState<ExecutionTrace | null>(null)
  const [focusSource, setFocusSource] = useState<RetrievalSource | null>(null)
  const [focusTrace, setFocusTrace] = useState<ExecutionTrace | null>(null)

  const value = useMemo<TraceContextValue>(
    () => ({
      trace,
      setTrace,
      focusSource,
      focusTrace,
      focus: (source, traceOverride = null) => {
        setFocusSource(source)
        if (traceOverride) setFocusTrace(traceOverride)
      },
    }),
    [trace, focusSource, focusTrace],
  )

  return <TraceContext.Provider value={value}>{children}</TraceContext.Provider>
}

export function useTrace(): TraceContextValue {
  const ctx = useContext(TraceContext)
  if (!ctx) throw new Error('useTrace must be used within TraceProvider')
  return ctx
}