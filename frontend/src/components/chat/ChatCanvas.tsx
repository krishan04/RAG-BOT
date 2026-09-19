import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Paperclip, SendHorizonal, Sparkles, UploadCloud, Zap } from 'lucide-react'
import { sendChat } from '../../api/client'
import type { ChatMessage, ExecutionTrace, PipelineSettings, VectorStore } from '../../models'
import { cn } from '../../lib/cn'
import { formatMs } from '../../lib/format'
import { Button } from '../../ui/button'
import { MessageBubble } from './MessageBubble'
import { PipelineSettingsPopover } from './PipelineSettingsPopover'
import { IngestionModal } from '../IngestionModal'
import { useTrace } from '../telemetry/TraceContext'

interface ChatCanvasProps {
  store: VectorStore | null
  onStoresChanged?: () => void
}

const ACCEPTED = ['.pdf', '.txt', '.csv', '.docx']

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

function welcomeMessage(): ChatMessage {
  return {
    id: 'welcome',
    sender: 'assistant',
    text: 'How can I assist you today? Select a knowledge base on the left and start asking questions.',
    timestamp: new Date().toISOString(),
  }
}

export function ChatCanvas({ store, onStoresChanged }: ChatCanvasProps) {
  const { setTrace, focus } = useTrace()
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage()])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pipeline, setPipeline] = useState<PipelineSettings>({
    provider: 'google',
    model: 'gemini-2.5-flash',
    retriever: 'base',
    memory: 'buffer',
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const lastTrace = useMemo<ExecutionTrace | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].trace) return messages[i].trace as ExecutionTrace
    }
    return null
  }, [messages])

  useEffect(() => {
    setMessages([welcomeMessage()])
    setError('')
    setTrace(null)
    focus(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.name])

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 180,
    overscan: 8,
  })

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [messages, busy])

  const autoGrow = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }

  const handleSend = async () => {
    if (!input.trim() || busy) return
    if (!store) {
      setError('Select a knowledge base first.')
      return
    }
    setError('')
    setBusy(true)
    focus(null)
    const question = input.trim()
    setMessages((prev) => [
      ...prev,
      { id: uid(), sender: 'user', text: question, timestamp: new Date().toISOString() },
    ])
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'

    try {
      const res = await sendChat({
        vector_store: store.name,
        question,
        llm_provider: pipeline.provider,
        model: pipeline.model,
        retriever: pipeline.retriever,
        memory: pipeline.memory,
      })
      const assistantMsg: ChatMessage = {
        id: uid(),
        sender: 'assistant',
        text: res.answer,
        timestamp: new Date().toISOString(),
        trace: res.trace,
      }
      setMessages((prev) => [...prev, assistantMsg])
      setTrace(res.trace)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const openIngest = (files: File[]) => {
    const accepted = Array.from(files).filter((f) =>
      f && ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext)),
    )
    if (accepted.length === 0) return
    setPendingFiles(accepted)
    setModalOpen(true)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) openIngest(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      openIngest(Array.from(e.dataTransfer.files))
    }
  }

  const handleIngested = (name: string) => {
    setModalOpen(false)
    setPendingFiles(null)
    if (store?.name === name) onStoresChanged?.()
  }

  const items = virtualizer.getVirtualItems()

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col bg-canvas"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {store ? (
            <>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="truncate text-sm font-semibold text-primary">{store.name}</span>
              <span className="shrink-0 rounded-full bg-border/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary">
                {store.embedding_provider ?? 'openai'} · {store.document_count ?? 0} docs
              </span>
            </>
          ) : (
            <span className="text-sm text-faint">No knowledge base selected</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] md:flex',
              store && lastTrace
                ? 'border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald'
                : 'border-border text-faint',
            )}
            title="Total execution time of the last answer"
          >
            <Zap className="h-3 w-3" />
            <span className="text-secondary">latency</span>
            {lastTrace ? formatMs(lastTrace.query_ms) : '—'}
          </span>
          <PipelineSettingsPopover settings={pipeline} onChange={setPipeline} />
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {items.map((vi) => {
            const m = messages[vi.index]
            return (
              <div
                key={m.id}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                className="absolute left-0 top-0 w-full px-6"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                <div className="mx-auto max-w-3xl space-y-2 py-2">
                  <MessageBubble message={m} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mx-auto max-w-3xl px-6 pb-6">
          {busy && (
            <div className="flex w-full gap-3 pt-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-border/60">
                <span className="block h-2 w-2 animate-pulse rounded-full bg-text-secondary" />
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-card px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:300ms]" />
              </div>
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-surface p-4">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface-card p-2 shadow-lg">
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-secondary hover:text-primary"
              onClick={() => fileRef.current?.click()}
              title="Attach documents to ingest"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                autoGrow()
              }}
              onKeyDown={handleKey}
              placeholder="Ask a question about your documents…"
              disabled={busy}
              className="min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-primary placeholder:text-faint focus:outline-none disabled:opacity-50"
            />
            <Button
              variant="primary"
              size="icon"
              disabled={busy || !input.trim()}
              onClick={handleSend}
              className="h-9 w-9 shrink-0 rounded-full"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Drop overlay */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-canvas/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/60 bg-surface-card px-6 py-4 text-sm text-primary">
            <UploadCloud className="h-5 w-5" />
            Drop files to ingest into {store?.name ?? 'a new knowledge base'}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={handleFileInput}
      />

      <IngestionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onComplete={handleIngested}
        initialStoreName={store?.name}
        initialFiles={pendingFiles}
      />
    </div>
  )
}