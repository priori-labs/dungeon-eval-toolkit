import { Toaster } from '@sokoban-eval-toolkit/ui-library/components/sonner'
import { useEffect } from 'react'
import { DungeonGame } from './DungeonGame'

function App() {
  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <>
      <DungeonGame />
      <Toaster />
    </>
  )
}

export default App
