import { memo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { Check, Copy } from 'lucide-react'
import type { ChatMessage } from '../../models'
import { cn } from '../../lib/cn'
import { hljs } from '../../lib/highlight'
import { SourceBadge } from './SourceBadge'

const mdComponents: Components = {
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className ?? '')
    if (!match) return <code className={className}>{children}</code>
    const code = String(children).replace(/\n$/, '')
    const language = match[1]
    const html = hljs.getLanguage(language)
      ? hljs.highlight(code, { language }).value
      : hljs.highlightAuto(code).value
    return (
      <pre>
        <code className={className} dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    )
  },
}

interface MessageBubbleProps {
  message: ChatMessage
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  if (message.sender === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-white">
          {message.text}
        </div>
      </div>
    )
  }

  const time = new Date(message.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex w-full gap-3">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
          message.text.startsWith('How can I assist')
            ? 'border-border bg-border/60 text-secondary'
            : 'border-accent-emerald/40 bg-accent-emerald/15 text-accent-emerald',
        )}
      >
        {message.text.startsWith('How can I assist') ? '✦' : 'AI'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="group flex items-center gap-2">
          <span className="text-[10px] text-faint">{time}</span>
          <button
            type="button"
            onClick={copy}
            className="rounded p-1 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-border/40 hover:text-primary"
            title="Copy response"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-accent-emerald" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="rounded-2xl rounded-tl-md border border-border bg-surface-card px-4 py-3">
          <div className="markdown-body text-sm leading-relaxed text-primary">
            <ReactMarkdown components={mdComponents}>{message.text}</ReactMarkdown>
          </div>
        </div>
        {message.trace && message.trace.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-faint">
              Sources
            </span>
            {message.trace.sources.map((s, i) => (
              <SourceBadge key={`${s.chunk_hash ?? ''}-${i}`} source={s} trace={message.trace} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})