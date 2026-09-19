import type {
  BenchmarkRun,
  ChatResponse,
  EmbeddingProvider,
  Health,
  RetrieverName,
  VectorStore,
} from '../models'

interface VectorStoresResponse {
  django: VectorStore[]
  persisted: string[]
  engine_variants: string[]
}

export interface IngestConfig {
  splitter: string
  embeddings: string
  vectorstore: string
  chunk_size: number
  chunk_overlap: number
}

interface IngestResponse {
  vector_store: string
  chunk_count: number
  config: IngestConfig
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = body && typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`
    throw new Error(detail)
  }
  return res.json()
}

export async function getHealth(): Promise<Health> {
  return handle<Health>(await fetch('/api/health'))
}

export async function getVectorStores(): Promise<VectorStoresResponse> {
  return handle(await fetch('/api/vectorstores'))
}

export async function createVectorStore(
  name: string,
  provider: EmbeddingProvider,
): Promise<{ id: number; name: string }> {
  return handle(
    await fetch('/api/vectorstores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, embedding_provider: provider }),
    }),
  )
}

export async function uploadDocuments(params: {
  vectorStore: string
  provider: EmbeddingProvider
  files: FileList | File[]
  chunkSize?: number
  chunkOverlap?: number
}): Promise<IngestResponse> {
  const { vectorStore, provider, files, chunkSize = 1600, chunkOverlap = 200 } = params
  const data = new FormData()
  Array.from(files).forEach((f) => data.append('files', f))
  const query = new URLSearchParams({
    vector_store: vectorStore,
    embedding_provider: provider,
    chunk_size: String(chunkSize),
    chunk_overlap: String(chunkOverlap),
  })
  return handle(
    await fetch(`/api/documents?${query.toString()}`, {
      method: 'POST',
      body: data,
    }),
  )
}

export async function sendChat(params: {
  vector_store: string
  question: string
  llm_provider: EmbeddingProvider
  model: string
  retriever: RetrieverName
  memory?: 'buffer' | 'summary'
  temperature?: number
  top_p?: number
}): Promise<ChatResponse> {
  return handle(
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector_store: params.vector_store,
        question: params.question,
        llm_provider: params.llm_provider,
        model: params.model,
        retriever: params.retriever,
        memory: params.memory ?? 'buffer',
        language: 'english',
        temperature: params.temperature ?? 0.5,
        top_p: params.top_p ?? 0.95,
      }),
    }),
  )
}

export async function runBenchmark(configMatrix: Record<string, string[]>): Promise<BenchmarkRun> {
  return handle(
    await fetch('/api/benchmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_matrix: configMatrix }),
    }),
  )
}

export async function listBenchmarks(): Promise<BenchmarkRun[]> {
  return handle(await fetch('/api/benchmarks'))
}