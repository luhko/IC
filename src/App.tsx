import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { ContextBar } from './components/ContextBar'
import { SearchPalette } from './components/SearchPalette'
import { HomePage } from './pages/HomePage'
import { DocPage } from './pages/DocPage'
import { MindmapPage } from './pages/MindmapPage'
import { useUI } from './store/ui'

export default function App() {
  const togglePalette = useUI((s) => s.togglePalette)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        togglePalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePalette])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/n/*" element={<DocPage />} />
          <Route path="/mindmap" element={<MindmapPage />} />
        </Routes>
      </main>
      <ContextBar />
      <SearchPalette />
    </div>
  )
}
