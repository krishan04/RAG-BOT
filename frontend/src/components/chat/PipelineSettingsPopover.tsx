import { SlidersHorizontal } from 'lucide-react'
import type { EmbeddingProvider, MemoryName, PipelineSettings, RetrieverName } from '../../models'
import { Badge } from '../../ui/badge'
import { Input } from '../../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'

interface PipelineSettingsPopoverProps {
  settings: PipelineSettings
  onChange: (settings: PipelineSettings) => void
}

const PROVIDER_LABELS: Record<EmbeddingProvider, string> = {
  google: 'Google',
  openai: 'OpenAI',
  huggingface: 'HuggingFace',
}

const RETRIEVER_LABELS: Record<RetrieverName, string> = {
  base: 'Base',
  contextual_compression: 'Contextual Compression',
  cohere_rerank: 'Cohere Rerank',
}

export function PipelineSettingsPopover({ settings, onChange }: PipelineSettingsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger className="group flex items-center gap-2 rounded-full border border-border bg-surface-card px-3 py-1.5 text-xs text-secondary transition-colors hover:border-border-2 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30">
        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
        <span>Provider: <span className="text-primary">{PROVIDER_LABELS[settings.provider]}</span></span>
        <span className="text-faint">|</span>
        <span>Model: <span className="text-primary">{settings.model || 'default'}</span></span>
        <span className="text-faint">|</span>
        <span>Retriever: <span className="text-primary">{RETRIEVER_LABELS[settings.retriever]}</span></span>
      </PopoverTrigger>

      <PopoverContent className="w-80">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-primary">Pipeline Settings</h3>
          <p className="mt-0.5 text-xs text-faint">Language model, embedding &amp; retrieval configuration</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
              LLM Provider
            </label>
            <Select
              value={settings.provider}
              onValueChange={(value) =>
                onChange({ ...settings, provider: value as EmbeddingProvider })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="huggingface">HuggingFace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Model
            </label>
            <Input
              placeholder="e.g. gemini-2.5-flash"
              value={settings.model}
              onChange={(e) => onChange({ ...settings, model: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Retriever
            </label>
            <Select
              value={settings.retriever}
              onValueChange={(value) =>
                onChange({ ...settings, retriever: value as RetrieverName })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Base</SelectItem>
                <SelectItem value="contextual_compression">Contextual Compression</SelectItem>
                <SelectItem value="cohere_rerank">Cohere Rerank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Memory
            </label>
            <Select
              value={settings.memory}
              onValueChange={(value) =>
                onChange({ ...settings, memory: value as MemoryName })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buffer">Buffer</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2">
            <span className="text-xs text-secondary">Applying to</span>
            <Badge variant="primary">Current session</Badge>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}