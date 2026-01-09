import { Cube, DoorOpen, Flag, Key, Skull, Spiral } from '@phosphor-icons/react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@sokoban-eval-toolkit/ui-library/components/card'
import { ACTION_KEYS } from '@src/constants'
import type { Action, DungeonLevel, GameState, TileType } from '@src/types'
import { createGame, executeAction, resetGame, undoMove } from '@src/utils/gameEngine'
import { createBlankLevel } from '@src/utils/levelStorage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AIPanel } from './components/AIPanel'
import { ControlPanel } from './components/ControlPanel'
import { type AddMode, DungeonGrid } from './components/DungeonGrid'
import { LevelSelector } from './components/LevelSelector'
import { TilePalette } from './components/TilePalette'

export function DungeonGame() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentLevel, setCurrentLevel] = useState<DungeonLevel | null>(null)
  const [aiInferenceTimeMs, setAiInferenceTimeMs] = useState<number | null>(null)
  const [aiPathHighlight, setAiPathHighlight] = useState<{ x: number; y: number }[] | null>(null)
  const initialLoadDone = useRef(false)
  const [isEditing, setIsEditing] = useState(true)
  const [selectedTile, setSelectedTile] = useState<AddMode>('wall')
  const [isSettingPlayerStart, setIsSettingPlayerStart] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Human player timer state
  const [timerStarted, setTimerStarted] = useState(false)
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Human eval session state
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [sessionElapsedTime, setSessionElapsedTime] = useState(0)
  const [sessionTotalMoves, setSessionTotalMoves] = useState(0)
  const [sessionRestartCount, setSessionRestartCount] = useState(0)

  // Handle level load
  const handleLevelLoad = useCallback((level: DungeonLevel) => {
    setCurrentLevel(level)
    setGameState(createGame(level))
    setAiInferenceTimeMs(null)
    // Reset timer on level load
    setTimerStarted(false)
    setTimerStartTime(null)
    setElapsedTime(0)
    // End session on level load
    setSessionActive(false)
    setSessionStartTime(null)
    setSessionElapsedTime(0)
    setSessionTotalMoves(0)
    setSessionRestartCount(0)
  }, [])

  // Load blank level on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const level = createBlankLevel(16, 16, 'New Level')
    handleLevelLoad(level)
  }, [handleLevelLoad])

  // Timer effect - updates every second while timer is running and game not done
  useEffect(() => {
    if (!timerStarted || !timerStartTime || gameState?.done) return

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - timerStartTime)
    }, 1000)

    return () => clearInterval(interval)
  }, [timerStarted, timerStartTime, gameState?.done])

  // Session timer effect - updates every second while session is active and puzzle not complete
  useEffect(() => {
    if (!sessionActive || !sessionStartTime || gameState?.success) return

    const interval = setInterval(() => {
      setSessionElapsedTime(Date.now() - sessionStartTime)
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionActive, sessionStartTime, gameState?.success])

  // Handle start session
  const handleStartSession = useCallback(() => {
    setSessionActive(true)
    setSessionStartTime(Date.now())
    setSessionElapsedTime(0)
    setSessionTotalMoves(0)
    setSessionRestartCount(0)
    // Also reset the current game timer
    setTimerStarted(false)
    setTimerStartTime(null)
    setElapsedTime(0)
  }, [])

  // Handle end session
  const handleEndSession = useCallback(() => {
    setSessionActive(false)
  }, [])

  // Handle action (movement or interact)
  const handleAction = useCallback(
    (action: Action): boolean => {
      if (!gameState || gameState.done) return false

      const result = executeAction(gameState, action, 'human')
      if (result.success) {
        // Auto-start timer on first move
        if (!timerStarted && gameState.turn === 0) {
          setTimerStarted(true)
          setTimerStartTime(Date.now())
          setElapsedTime(0)
        }
        // Track session moves
        if (sessionActive) {
          setSessionTotalMoves((prev) => prev + 1)
        }
        setGameState(result.newState)
        return true
      }
      return false
    },
    [gameState, timerStarted, sessionActive],
  )

  // Handle AI action
  const handleAIAction = useCallback(
    (action: Action): boolean => {
      if (!gameState || gameState.done) return false

      const result = executeAction(gameState, action, 'ai')
      if (result.success) {
        setGameState(result.newState)
        return true
      }
      return false
    },
    [gameState],
  )

  // Handle undo
  const handleUndo = useCallback(() => {
    if (!gameState) return
    setGameState(undoMove(gameState))
  }, [gameState])

  // Reset to initial state
  const handleReset = useCallback(() => {
    if (!gameState) return
    setGameState(resetGame(gameState))
    // Reset timer on game reset
    setTimerStarted(false)
    setTimerStartTime(null)
    setElapsedTime(0)
    // Track session restarts (only if moves were made)
    if (sessionActive && gameState.turn > 0) {
      setSessionRestartCount((prev) => prev + 1)
    }
  }, [gameState, sessionActive])

  // Handle cell click for editing
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (!gameState || !isEditing) return

      const { level } = gameState
      const isBorder =
        x === 0 || x === level.gridSize.width - 1 || y === 0 || y === level.gridSize.height - 1

      // Handle player start placement
      if (isSettingPlayerStart && !isBorder) {
        const newLevel: DungeonLevel = {
          ...level,
          playerStart: { x, y },
        }
        setCurrentLevel(newLevel)
        setGameState({
          ...gameState,
          level: newLevel,
          playerPosition: { x, y },
        })
        setIsSettingPlayerStart(false)
        return
      }

      // Handle tile placement
      if (selectedTile && selectedTile !== 'player-start' && selectedTile !== 'remove') {
        if (isBorder && selectedTile !== 'wall') return

        // Map AddMode to TileType
        const tileTypeMap: Record<string, TileType> = {
          wall: 'WALL',
          empty: 'EMPTY',
          goal: 'GOAL',
          block: 'BLOCK',
          trap: 'TRAP',
          'key-red': 'KEY_RED',
          'key-blue': 'KEY_BLUE',
          'key-green': 'KEY_GREEN',
          'key-yellow': 'KEY_YELLOW',
          'door-red': 'DOOR_RED',
          'door-blue': 'DOOR_BLUE',
          'door-green': 'DOOR_GREEN',
          'door-yellow': 'DOOR_YELLOW',
          'portal-a': 'PORTAL_A',
          'portal-b': 'PORTAL_B',
        }

        const newTileType = tileTypeMap[selectedTile]
        if (!newTileType) return

        // Update grid
        const newGrid = gameState.grid.map((row, ry) =>
          row.map((tile, rx) => {
            if (rx === x && ry === y) {
              return {
                type: newTileType,
                isOpen: newTileType.startsWith('DOOR_') ? false : undefined,
              }
            }
            return tile
          }),
        )

        // Also update level layout
        const newLayout = level.layout.map((row, ry) =>
          row.map((tile, rx) => {
            if (rx === x && ry === y) {
              return newTileType
            }
            return tile
          }),
        )

        const newLevel: DungeonLevel = {
          ...level,
          layout: newLayout,
        }

        setCurrentLevel(newLevel)
        setGameState({
          ...gameState,
          level: newLevel,
          grid: newGrid,
        })
      }

      // Handle remove mode
      if (selectedTile === 'remove') {
        const newGrid = gameState.grid.map((row, ry) =>
          row.map((tile, rx) => {
            if (rx === x && ry === y && tile.type !== 'WALL') {
              return { type: 'EMPTY' as TileType }
            }
            return tile
          }),
        )

        const newLayout = level.layout.map((row, ry) =>
          row.map((tile, rx) => {
            if (rx === x && ry === y && tile !== 'WALL') {
              return 'EMPTY' as TileType
            }
            return tile
          }),
        )

        const newLevel: DungeonLevel = {
          ...level,
          layout: newLayout,
        }

        setCurrentLevel(newLevel)
        setGameState({
          ...gameState,
          level: newLevel,
          grid: newGrid,
        })
      }
    },
    [gameState, isEditing, selectedTile, isSettingPlayerStart],
  )

  // Handle drag start
  const handleDragStart = useCallback(
    (x: number, y: number) => {
      if (!isEditing) return
      setIsDragging(true)
      handleCellClick(x, y)
    },
    [isEditing, handleCellClick],
  )

  // Handle drag enter
  const handleDragEnter = useCallback(
    (x: number, y: number) => {
      if (!isDragging || !isEditing) return
      handleCellClick(x, y)
    },
    [isDragging, isEditing, handleCellClick],
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleDragEnd()
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDragging, handleDragEnd])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Movement and interact
      const action = ACTION_KEYS[e.key]
      if (action) {
        e.preventDefault()
        handleAction(action)
        return
      }

      // Undo (Z or Backspace)
      if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleUndo()
        return
      }

      // Reset (R)
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        handleReset()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleAction, handleUndo, handleReset])

  return (
    <div className="h-screen bg-background flex text-foreground overflow-hidden">
      {/* Left Sidebar - Controls */}
      <div className="flex-shrink-0 h-full p-4">
        <Card className="h-full flex flex-col min-h-0 w-80">
          <CardHeader className="flex-shrink-0 pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">
              Dungeon Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4 min-h-0">
            <LevelSelector onLevelLoad={handleLevelLoad} currentLevel={currentLevel} />
            <ControlPanel
              state={gameState}
              onUndo={handleUndo}
              onReset={handleReset}
              disabled={false}
              aiInferenceTimeMs={aiInferenceTimeMs}
              timerStarted={timerStarted}
              elapsedTime={elapsedTime}
              sessionActive={sessionActive}
              sessionElapsedTime={sessionElapsedTime}
              sessionTotalMoves={sessionTotalMoves}
              sessionRestartCount={sessionRestartCount}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
            />
          </CardContent>
        </Card>
      </div>

      {/* Center - Game Area */}
      <div className="flex-1 flex flex-col items-center px-5 py-4 min-w-0">
        {/* Tile palette with edit toggle */}
        <div
          className="mb-3 px-3 py-2 rounded-lg border border-white/5"
          style={{ backgroundColor: 'hsl(0 0% 8%)' }}
        >
          <TilePalette
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
            isSettingPlayerStart={isSettingPlayerStart}
            onSetPlayerStart={setIsSettingPlayerStart}
            isEditing={isEditing}
            onEditingChange={setIsEditing}
          />
        </div>

        {/* Main content */}
        <div className="flex flex-col items-center flex-1 justify-center">
          {/* Title */}
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Dungeon Puzzle
          </h1>

          {/* Win message */}
          {gameState?.success && (
            <div className="text-green-500 mb-2 animate-pulse font-medium">Puzzle Complete!</div>
          )}

          {/* Loss message */}
          {gameState?.done && !gameState?.success && (
            <div className="text-red-500 mb-2 animate-pulse font-medium">
              {gameState.message || 'Game Over!'} Press R to restart.
            </div>
          )}

          {/* Status */}
          {gameState && !gameState.done && gameState.inventory.keys.length > 0 && (
            <div className="text-xs text-muted-foreground mb-3">
              Keys: {gameState.inventory.keys.map((k) => k[0]).join(', ')}
            </div>
          )}

          {/* Grid */}
          <DungeonGrid
            state={gameState}
            isEditing={isEditing}
            onCellClick={handleCellClick}
            selectedTile={selectedTile}
            onCellDragStart={handleDragStart}
            onCellDragEnter={handleDragEnter}
            onDragEnd={handleDragEnd}
            isDragging={isDragging}
            highlightedCells={aiPathHighlight ?? undefined}
          />

          {/* Legend */}
          <div className="mt-3 flex gap-4 items-center text-[11px] text-muted-foreground flex-wrap justify-center">
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 14 }}>🧑‍🚀</span>
              <span>Player</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flag size={14} weight="fill" color="hsl(47 80% 55%)" />
              <span>Goal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Key size={14} weight="regular" color="hsl(210 65% 55%)" />
              <span>Key</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DoorOpen size={14} weight="fill" color="hsl(25 70% 50%)" />
              <span>Door</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cube size={14} weight="regular" color="hsl(30 30% 55%)" />
              <span>Block</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Skull size={14} weight="regular" color="hsl(0 75% 55%)" />
              <span>Trap</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Spiral size={14} weight="regular" color="hsl(270 55% 60%)" />
              <span>Portal</span>
            </div>
          </div>

          {/* Completion stats */}
          {gameState?.success && (
            <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 text-center">
              <div className="text-green-500 font-medium text-sm">
                Completed in {gameState.turn} turns
              </div>
            </div>
          )}

          {/* Level info */}
          {currentLevel && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              {currentLevel.name}
              <span className="mx-2">·</span>
              {currentLevel.gridSize.width}×{currentLevel.gridSize.height}
            </div>
          )}
        </div>

        {/* Bottom instructions */}
        <div className="mt-4 text-[11px] text-muted-foreground font-mono text-center">
          <span className="text-foreground/60">Arrow Keys</span> move ·{' '}
          <span className="text-foreground/60">E</span> interact ·{' '}
          <span className="text-foreground/60">Z/Backspace</span> undo ·{' '}
          <span className="text-foreground/60">R</span> reset
        </div>
      </div>

      {/* Right Sidebar - AI Panel */}
      <div className="flex-shrink-0 p-4 h-screen flex flex-col">
        <AIPanel
          state={gameState}
          onMove={handleAIAction}
          onReset={handleReset}
          disabled={!gameState}
          onInferenceTimeChange={setAiInferenceTimeMs}
          onPathHighlight={setAiPathHighlight}
        />
      </div>
    </div>
  )
}
