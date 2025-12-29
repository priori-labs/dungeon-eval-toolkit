import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@sokoban-eval-toolkit/ui-library/components/card'
import { Checkbox } from '@sokoban-eval-toolkit/ui-library/components/checkbox'
import { Label } from '@sokoban-eval-toolkit/ui-library/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sokoban-eval-toolkit/ui-library/components/select'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import { OPENROUTER_MODELS } from '@sokoban-eval-toolkit/utils'
import { AI_MOVE_DELAY } from '@src/constants'
import {
  createSessionMetrics,
  getDungeonSolution,
  hasOpenRouterApiKey,
  updateSessionMetrics,
} from '@src/services/llm'
import type { Action, GameState, PlannedMove, PromptOptions, SessionMetrics } from '@src/types'
import { DEFAULT_PROMPT_OPTIONS, generateDungeonPrompt } from '@src/utils/promptGeneration'
import { AlertCircle, Copy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { SquareLoader } from './SquareLoader'

interface AIPanelProps {
  state: GameState | null
  onMove: (action: Action) => boolean
  onReset: () => void
  disabled?: boolean
  onInferenceTimeChange?: (timeMs: number | null) => void
  onPathHighlight?: (positions: { x: number; y: number }[] | null) => void
}

type PlannedMoveStatus = 'pending' | 'executing' | 'success' | 'failed'

interface ExtendedPlannedMove extends PlannedMove {
  status: PlannedMoveStatus
}

const DEFAULT_MODEL = 'google/gemini-3-flash-preview'

export function AIPanel({
  state,
  onMove,
  onReset,
  disabled = false,
  onInferenceTimeChange,
  onPathHighlight,
}: AIPanelProps) {
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [promptOptions, setPromptOptions] = useState<PromptOptions>({
    ...DEFAULT_PROMPT_OPTIONS,
  })

  const [isRunning, setIsRunning] = useState(false)
  const [plannedMoves, setPlannedMoves] = useState<ExtendedPlannedMove[]>([])
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics>(createSessionMetrics())
  const [error, setError] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)
  const [nativeReasoning, setNativeReasoning] = useState<string | null>(null)
  const [parsedReasoning, setParsedReasoning] = useState<string | null>(null)
  const [inflightStartTime, setInflightStartTime] = useState<number | null>(null)
  const [inflightSeconds, setInflightSeconds] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedNativeReasoning, setCopiedNativeReasoning] = useState(false)
  const [copiedParsedReasoning, setCopiedParsedReasoning] = useState(false)
  const [wasManuallyStopped, setWasManuallyStopped] = useState(false)
  const [storedSolution, setStoredSolution] = useState<Action[]>([])
  const [showFullPath, setShowFullPath] = useState(false)

  const abortRef = useRef(false)
  const isRunningRef = useRef(false)
  const isReplayingRef = useRef(false)
  const movesRef = useRef<Action[]>([])
  const moveIndexRef = useRef(0)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const historyContainerRef = useRef<HTMLDivElement>(null)

  const hasApiKey = hasOpenRouterApiKey()

  // Auto-scroll history when moves change
  useEffect(() => {
    if (plannedMoves.length > 0 && historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight
    }
  }, [plannedMoves.length])

  // Update inflight timer every second while request is in progress
  useEffect(() => {
    if (!inflightStartTime) {
      setInflightSeconds(null)
      return
    }

    const interval = setInterval(() => {
      setInflightSeconds(Math.floor((Date.now() - inflightStartTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [inflightStartTime])

  // Reset state when level changes
  const levelId = state?.level.id
  useEffect(() => {
    // Reset all AI state when level changes
    if (levelId !== undefined) {
      setPlannedMoves([])
      setError(null)
      setRawResponse(null)
      setNativeReasoning(null)
      setParsedReasoning(null)
      setIsRunning(false)
      setInflightStartTime(null)
      setWasManuallyStopped(false)
      setStoredSolution([])
      setShowFullPath(false)
      abortRef.current = true
      isRunningRef.current = false
      isReplayingRef.current = false
      setSessionMetrics(createSessionMetrics())
      onInferenceTimeChange?.(null)
      onPathHighlight?.(null)
    }
  }, [levelId, onInferenceTimeChange, onPathHighlight])

  // Notify parent of inference time changes
  useEffect(() => {
    if (sessionMetrics.totalDurationMs > 0) {
      onInferenceTimeChange?.(sessionMetrics.totalDurationMs)
    }
  }, [sessionMetrics.totalDurationMs, onInferenceTimeChange])

  // Calculate and highlight full AI path when toggle is on
  useEffect(() => {
    if (!showFullPath || !state || storedSolution.length === 0) {
      onPathHighlight?.(null)
      return
    }

    // Calculate path positions by simulating all movement actions
    const positions: { x: number; y: number }[] = []
    let currentPos = { ...state.level.playerStart }
    positions.push({ ...currentPos })

    const directionDeltas: Record<string, { x: number; y: number }> = {
      UP: { x: 0, y: -1 },
      DOWN: { x: 0, y: 1 },
      LEFT: { x: -1, y: 0 },
      RIGHT: { x: 1, y: 0 },
    }

    // Helper to find the other portal
    const findOtherPortal = (portalType: string): { x: number; y: number } | null => {
      const targetType = portalType === 'PORTAL_A' ? 'PORTAL_B' : 'PORTAL_A'
      for (let y = 0; y < state.level.gridSize.height; y++) {
        for (let x = 0; x < state.level.gridSize.width; x++) {
          if (state.level.layout[y]?.[x] === targetType) {
            return { x, y }
          }
        }
      }
      return null
    }

    for (const action of storedSolution) {
      const delta = directionDeltas[action]
      if (delta) {
        currentPos = {
          x: currentPos.x + delta.x,
          y: currentPos.y + delta.y,
        }
        positions.push({ ...currentPos })

        // Check for portal teleportation
        const tileType = state.level.layout[currentPos.y]?.[currentPos.x]
        if (tileType === 'PORTAL_A' || tileType === 'PORTAL_B') {
          const otherPortal = findOtherPortal(tileType)
          if (otherPortal) {
            currentPos = { ...otherPortal }
            positions.push({ ...currentPos })
          }
        }
      }
      // INTERACT doesn't move, so we skip it
    }

    onPathHighlight?.(positions)
  }, [showFullPath, state, storedSolution, onPathHighlight])

  // Execute moves one by one
  const executeNextMove = useCallback(() => {
    if (!isRunningRef.current) return

    const moves = movesRef.current
    const index = moveIndexRef.current

    if (index >= moves.length) {
      setIsRunning(false)
      isRunningRef.current = false
      return
    }

    // Mark current move as executing
    setPlannedMoves((prev) =>
      prev.map((m, i) => (i === index ? { ...m, status: 'executing' as PlannedMoveStatus } : m)),
    )

    const move = moves[index]
    if (!move) return

    const success = onMoveRef.current(move)

    // Update move status
    setPlannedMoves((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, status: (success ? 'success' : 'failed') as PlannedMoveStatus } : m,
      ),
    )

    if (!success) {
      setError(`Invalid move at step ${index + 1}: ${move}`)
      setIsRunning(false)
      isRunningRef.current = false
      return
    }

    moveIndexRef.current = index + 1

    // Schedule next move
    setTimeout(() => {
      executeNextMove()
    }, AI_MOVE_DELAY)
  }, [])

  const handleStart = useCallback(async () => {
    if (!state || isRunning) return

    // Reset state
    onReset()
    setIsRunning(true)
    isRunningRef.current = true
    setError(null)
    setRawResponse(null)
    setNativeReasoning(null)
    setParsedReasoning(null)
    setWasManuallyStopped(false)
    abortRef.current = false
    setPlannedMoves([])
    setSessionMetrics(createSessionMetrics())

    setInflightStartTime(Date.now())

    // Get solution from LLM
    const response = await getDungeonSolution(state, model, promptOptions)

    setInflightStartTime(null)

    if (abortRef.current) {
      setIsRunning(false)
      isRunningRef.current = false
      return
    }

    setRawResponse(response.rawResponse)
    setNativeReasoning(response.nativeReasoning ?? null)
    setParsedReasoning(response.parsedReasoning ?? null)
    setSessionMetrics((prev) => updateSessionMetrics(prev, response))

    if (response.error || response.moves.length === 0) {
      setError(response.error || 'No moves returned from AI')
      setIsRunning(false)
      isRunningRef.current = false
      return
    }

    // Create planned moves
    const moves: ExtendedPlannedMove[] = response.moves.map((action) => ({
      id: uuidv4(),
      action,
      status: 'pending' as PlannedMoveStatus,
    }))
    setPlannedMoves(moves)

    // Store solution for replay
    setStoredSolution(response.moves)

    // Set up for execution
    movesRef.current = response.moves
    moveIndexRef.current = 0
    isReplayingRef.current = false

    // Start executing moves after a short delay
    setTimeout(() => {
      executeNextMove()
    }, 300)
  }, [state, isRunning, model, promptOptions, onReset, executeNextMove])

  const handleStop = useCallback(() => {
    abortRef.current = true
    setIsRunning(false)
    isRunningRef.current = false
    setInflightStartTime(null)
    setWasManuallyStopped(true)
  }, [])

  const handleResetAI = useCallback(() => {
    abortRef.current = true
    setIsRunning(false)
    isRunningRef.current = false
    setPlannedMoves([])
    setError(null)
    setRawResponse(null)
    setNativeReasoning(null)
    setParsedReasoning(null)
    setInflightStartTime(null)
    setWasManuallyStopped(false)
    setStoredSolution([])
    setShowFullPath(false)
    setSessionMetrics(createSessionMetrics())
    onPathHighlight?.(null)
    onReset()
  }, [onReset, onPathHighlight])

  // Replay the stored AI solution from the beginning
  const handleReplay = useCallback(() => {
    if (storedSolution.length === 0) return

    // Mark as replaying so we preserve session metrics
    isReplayingRef.current = true

    // Reset puzzle state
    onReset()

    // Reset UI state but keep stored solution and session metrics
    setIsRunning(true)
    isRunningRef.current = true
    setError(null)
    setWasManuallyStopped(false)

    // Create fresh planned moves from stored solution
    const moves: ExtendedPlannedMove[] = storedSolution.map((action) => ({
      id: uuidv4(),
      action,
      status: 'pending' as PlannedMoveStatus,
    }))
    setPlannedMoves(moves)

    // Set up for execution
    movesRef.current = storedSolution
    moveIndexRef.current = 0

    // Start executing moves after a short delay
    setTimeout(() => {
      executeNextMove()
    }, 300)
  }, [storedSolution, onReset, executeNextMove])

  const togglePromptOption = (key: keyof PromptOptions) => {
    if (key === 'executionMode') return // Not a boolean option
    setPromptOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Generate preview prompt for copy
  const previewPrompt = state ? generateDungeonPrompt(state, promptOptions) : null

  const handleCopyPrompt = useCallback(async () => {
    if (!previewPrompt) return
    try {
      await navigator.clipboard.writeText(previewPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [previewPrompt])

  const handleCopyNativeReasoning = useCallback(async () => {
    if (!nativeReasoning) return
    try {
      await navigator.clipboard.writeText(nativeReasoning)
      setCopiedNativeReasoning(true)
      setTimeout(() => setCopiedNativeReasoning(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [nativeReasoning])

  const handleCopyParsedReasoning = useCallback(async () => {
    if (!parsedReasoning) return
    try {
      await navigator.clipboard.writeText(parsedReasoning)
      setCopiedParsedReasoning(true)
      setTimeout(() => setCopiedParsedReasoning(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [parsedReasoning])

  // Computed states
  const aiHasRun = plannedMoves.length > 0
  const aiHasResponded = sessionMetrics.requestCount > 0
  const hasFailedMoves = plannedMoves.some((m) => m.status === 'failed')
  const aiCompleted = aiHasRun && !isRunning && state?.success && !hasFailedMoves
  const aiStopped = aiHasRun && !isRunning && (!state?.success || hasFailedMoves)

  const getStatusIcon = (status: PlannedMoveStatus) => {
    switch (status) {
      case 'pending':
        return '○'
      case 'executing':
        return '●'
      case 'success':
        return '✓'
      case 'failed':
        return '✗'
    }
  }

  const getStatusColor = (status: PlannedMoveStatus) => {
    switch (status) {
      case 'pending':
        return 'text-muted-foreground'
      case 'executing':
        return 'text-blue-400'
      case 'success':
        return 'text-green-400'
      case 'failed':
        return 'text-red-400'
    }
  }

  const getActionDisplay = (action: Action) => {
    switch (action) {
      case 'UP':
        return '↑ UP'
      case 'DOWN':
        return '↓ DOWN'
      case 'LEFT':
        return '← LEFT'
      case 'RIGHT':
        return '→ RIGHT'
      case 'INTERACT':
        return '⚡ INTERACT'
    }
  }

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.round(ms / 1000)
    if (totalSeconds < 60) return `${totalSeconds}s`
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    }
    return `${minutes}m ${seconds}s`
  }

  const formatCost = (cost: number) => {
    if (cost < 0.0001) return '$0.0000'
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(3)}`
  }

  return (
    <Card className="h-full flex flex-col min-h-0 w-80">
      <CardHeader className="flex-shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">AI Agent</CardTitle>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <SquareLoader size={4} gap={1} color="#4ade80" uniformColor />
              <span className="animate-pulse">Running</span>
            </span>
          )}
          {aiCompleted && <span className="text-xs text-green-400">Puzzle Solved!</span>}
          {wasManuallyStopped && !isRunning && (
            <span className="text-xs text-yellow-400">Stopped</span>
          )}
        </div>

        {/* Model name when running or has run */}
        {(isRunning || aiHasRun || aiHasResponded) && (
          <div className="font-mono text-sm text-blue-400 truncate">
            {OPENROUTER_MODELS.find((m) => m.id === model)?.name ?? model}
          </div>
        )}

        {/* Session stats */}
        {(isRunning || aiHasRun || aiHasResponded) && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost</div>
              <div className="font-mono">{formatCost(sessionMetrics.totalCost)}</div>
            </div>
            <div className="rounded-md border px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Time</div>
              <div className="font-mono">{formatDuration(sessionMetrics.totalDurationMs)}</div>
            </div>
          </div>
        )}

        {/* Human Calibrated Efficiency */}
        {aiHasResponded && sessionMetrics.totalOutputTokens > 0 && (
          <div className="rounded-md border px-2 py-1.5 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Human Calibrated Efficiency
            </div>
            <div className="space-y-0.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prompt Tokens:</span>
                <span>{sessionMetrics.totalInputTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Output Tokens:</span>
                <span>{sessionMetrics.totalOutputTokens.toLocaleString()}</span>
              </div>
              {sessionMetrics.totalReasoningTokens > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">↳ Reasoning:</span>
                  <span>{sessionMetrics.totalReasoningTokens.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Words:</span>
                <span>{sessionMetrics.estimatedWords.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-primary">
                <span>Human Time (250 wpm):</span>
                <span>{formatDuration((sessionMetrics.estimatedWords / 250) * 60 * 1000)}</span>
              </div>
              <div className="flex justify-between text-primary">
                <span>Human Time (1000 wpm):</span>
                <span>{formatDuration((sessionMetrics.estimatedWords / 1000) * 60 * 1000)}</span>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col gap-3 pt-0 overflow-y-auto">
        {!hasApiKey && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-amber-500 text-xs">
              Set VITE_OPENROUTER_API_KEY in .env to use AI features.
            </div>
          </div>
        )}

        {/* Model selector - only show when not running and no history */}
        {!isRunning && plannedMoves.length === 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="model-select" className="text-xs">
              Model
            </Label>
            <Select value={model} onValueChange={setModel} disabled={disabled || !hasApiKey}>
              <SelectTrigger id="model-select" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPENROUTER_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Prompt options - always show, but disable when running or has history */}
        <div className="space-y-1.5">
          <Label className="text-xs">Prompt Options</Label>
          <div className="flex flex-col gap-2">
            {/* ASCII Grid option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="asciiGrid"
                checked={promptOptions.asciiGrid}
                onCheckedChange={() => togglePromptOption('asciiGrid')}
                disabled={isRunning || plannedMoves.length > 0}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="asciiGrid"
                className={`text-xs ${isRunning || plannedMoves.length > 0 ? 'text-muted-foreground cursor-default' : 'cursor-pointer'}`}
              >
                ASCII Grid
              </Label>
            </div>
            {/* Coordinate Locations option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="coordinateLocations"
                checked={promptOptions.coordinateLocations}
                onCheckedChange={() => togglePromptOption('coordinateLocations')}
                disabled={isRunning || plannedMoves.length > 0}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="coordinateLocations"
                className={`text-xs ${isRunning || plannedMoves.length > 0 ? 'text-muted-foreground cursor-default' : 'cursor-pointer'}`}
              >
                Coordinate Locations
              </Label>
            </div>
          </div>
        </div>
        <Separator />

        {/* Controls */}
        <div className="space-y-2 flex-shrink-0">
          {aiCompleted ? (
            <>
              <Button onClick={handleReplay} className="w-full" size="sm">
                Replay AI Solution
              </Button>
              <Button onClick={handleResetAI} variant="outline" className="w-full" size="sm">
                Reset
              </Button>
            </>
          ) : aiStopped ? (
            <>
              {storedSolution.length > 0 && (
                <Button onClick={handleReplay} className="w-full" size="sm">
                  Replay AI Solution
                </Button>
              )}
              <Button onClick={handleResetAI} variant="outline" className="w-full" size="sm">
                Reset
              </Button>
            </>
          ) : isRunning ? (
            <Button onClick={handleStop} variant="outline" className="w-full" size="sm">
              Stop
            </Button>
          ) : (
            <>
              <Button
                onClick={handleStart}
                disabled={disabled || !state || !hasApiKey || state.success}
                className="w-full"
                size="sm"
              >
                Run AI Agent
              </Button>
              <Button
                onClick={handleCopyPrompt}
                variant="outline"
                className="w-full"
                size="sm"
                disabled={!state}
              >
                <Copy className="h-3 w-3 mr-1.5" />
                {copied ? 'Copied!' : 'Copy Prompt'}
              </Button>
            </>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="space-y-2">
            <div className="bg-red-500/10 text-red-400 rounded-md px-3 py-2 text-xs">{error}</div>
            {storedSolution.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showFullPath"
                  checked={showFullPath}
                  onCheckedChange={(checked) => setShowFullPath(checked === true)}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="showFullPath" className="text-xs cursor-pointer">
                  Show full AI path on grid
                </Label>
              </div>
            )}
          </div>
        )}

        {/* Inflight timer */}
        {inflightSeconds !== null && (
          <div className="border rounded-md p-2">
            <div className="text-[10px] font-mono flex items-start gap-1.5 py-0.5">
              <span className="text-yellow-500">⏳</span>
              <span className="text-yellow-500">
                Thinking for{' '}
                {inflightSeconds >= 60
                  ? `${Math.floor(inflightSeconds / 60)}m ${inflightSeconds % 60}s`
                  : `${inflightSeconds}s`}
                ...
              </span>
            </div>
          </div>
        )}

        {/* Native Reasoning (from models like DeepSeek R1) */}
        {nativeReasoning && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Model Reasoning</Label>
              <button
                type="button"
                onClick={handleCopyNativeReasoning}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy model reasoning"
              >
                {copiedNativeReasoning ? (
                  <span className="text-[10px] text-green-400">Copied!</span>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
            <div className="border rounded-md p-2 text-xs text-foreground/80 bg-muted/30 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {nativeReasoning}
            </div>
          </div>
        )}

        {/* Parsed Reasoning (from response content) */}
        {parsedReasoning && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Response Reasoning</Label>
              <button
                type="button"
                onClick={handleCopyParsedReasoning}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy response reasoning"
              >
                {copiedParsedReasoning ? (
                  <span className="text-[10px] text-green-400">Copied!</span>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
            <div className="border rounded-md p-2 text-xs text-foreground/80 bg-muted/30 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {parsedReasoning}
            </div>
          </div>
        )}

        {/* History */}
        <div className="space-y-1.5 flex-1 min-h-40 flex flex-col">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">History</Label>
            <span className="text-xs text-muted-foreground">
              {plannedMoves.filter((m) => m.status === 'success').length}/{plannedMoves.length}{' '}
              moves
            </span>
          </div>

          <div
            ref={historyContainerRef}
            className="flex-1 min-h-32 border rounded-md overflow-y-auto"
          >
            <div className="p-2">
              {plannedMoves.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No moves yet</div>
              ) : (
                <div className="space-y-1">
                  {plannedMoves.map((move, idx) => (
                    <div
                      key={move.id}
                      className={`py-1 text-xs border-b border-border/50 last:border-0 flex items-center justify-between rounded ${
                        move.status === 'executing'
                          ? 'bg-blue-500/10'
                          : move.status === 'failed'
                            ? 'bg-red-500/10'
                            : ''
                      }`}
                    >
                      <span
                        className={`font-medium flex items-center gap-2 ${getStatusColor(move.status)}`}
                      >
                        <span className="w-6">{idx + 1}.</span>
                        <span>{getActionDisplay(move.action)}</span>
                      </span>
                      <span className={`text-[10px] ${getStatusColor(move.status)}`}>
                        {getStatusIcon(move.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Raw response (collapsible) */}
        {rawResponse && (
          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
              Raw AI Response
            </summary>
            <pre className="bg-muted/20 rounded-md p-2 mt-1 text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto">
              {rawResponse}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
