import { Navigate, Route, Routes } from 'react-router-dom'
import { NavRail } from './components/layout/NavRail'
import { TraceProvider } from './components/telemetry/TraceContext'
import { ChatWorkspace } from './views/ChatWorkspace'
import { StoresView } from './components/StoresView'
import { BenchmarksLab } from './components/BenchmarksLab'

function App() {
  return (
    <TraceProvider>
      <div className="flex h-full overflow-hidden">
        <NavRail />
        <main className="min-w-0 flex-1">
          <Routes>
            <Route path="/" element={<ChatWorkspace />} />
            <Route path="/stores" element={<StoresView />} />
            <Route path="/benchmarks" element={<BenchmarksLab />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </TraceProvider>
  )
}

export default App