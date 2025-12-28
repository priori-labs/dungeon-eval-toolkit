import { useEffect } from 'react'
import { DungeonGame } from './DungeonGame'

function App() {
  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return <DungeonGame />
}

export default App
