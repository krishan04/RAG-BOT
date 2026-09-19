import { useState } from 'react'
import type { VectorStore } from '../models'
import { StoresRail } from '../components/workspace/StoresRail'
import { ChatCanvas } from '../components/chat/ChatCanvas'
import { PipelineTrace } from '../components/telemetry/PipelineTrace'

export function ChatWorkspace() {
  const [selectedStore, setSelectedStore] = useState<VectorStore | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex h-full min-w-0">
      <StoresRail
        selectedStore={selectedStore}
        onSelectStore={setSelectedStore}
        refreshKey={refreshKey}
        onStoresChanged={() => setRefreshKey((k) => k + 1)}
      />
      <ChatCanvas store={selectedStore} />
      <PipelineTrace />
    </div>
  )
}