export type EmbeddingProvider = 'openai' | 'google' | 'huggingface'
export type RetrieverName = 'base' | 'contextual_compression' | 'cohere_rerank'
export type MemoryName = 'buffer' | 'summary'

export interface Health {
  status: string
  api: string
  django: string
  version: string
}

export interface VectorStore {
  id: number
  name: string
  embedding_provider: string | null
  persist_path: string | null
  chunk_size: number
  chunk_overlap: number
  created_at: string | null
  document_count: number
}

export interface RetrievalSource {
  source?: string
  page?: number | string
  chunk_index: number
  chunk_hash: string
  score: number
  tokens: number
  retrieval_ms: number
  content: string
}

export interface ExecutionTrace {
  query_ms: number
  retrieval_ms: number
  rerank_ms?: number
  ttft_ms?: number
  token_estimate: number
  condense_ms?: number
  generation_ms?: number
  k_retrieved: number
  k_filtered: number
  condensed_question?: string
  chunk_size?: number
  chunk_overlap?: number
  language?: string
  file_types?: string[]
  retriever?: RetrieverName
  score_bounds?: { min: number; max: number } | null
  sources: RetrievalSource[]
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  trace?: ExecutionTrace
}

export interface ChatResponse {
  answer: string
  source_documents: RetrievalSource[]
  query_ms: number
  retrieval_ms: number
  rerank_ms: number
  ttft_ms: number | null
  token_estimate: number
  trace: ExecutionTrace
}

export interface PipelineSettings {
  provider: EmbeddingProvider
  model: string
  retriever: RetrieverName
  memory: MemoryName
}

export interface BenchmarkRun {
  id: number
  name: string
  status: string
  config_json: { config_matrix: Record<string, string[]>; runs: Array<Record<string, string>> }
  results_json: { results?: Array<Record<string, unknown>> }
  created_at: string
}