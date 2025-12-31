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
import { Textarea } from '@sokoban-eval-toolkit/ui-library/components/textarea'
import { OPENROUTER_MODELS } from '@sokoban-eval-toolkit/utils'
import { AI_MOVE_DELAY } from '@src/constants'
import {
  continueExploration,
  createSessionMetrics,
  getDungeonSolution,
  hasOpenRouterApiKey,
  updateSessionMetrics,
} from '@src/services/llm'
import type {
  Action,
  ExplorationCommand,
  GameState,
  PlannedMove,
  PromptOptions,
  SessionMetrics,
} from '@src/types'
import {
  type CommandCounts,
  DEFAULT_PROMPT_OPTIONS,
  type ExplorationAttempt,
  gameStateToAscii,
  generateDungeonPrompt,
  generateExplorationContinuationPrompt,
} from '@src/utils/promptGeneration'
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
  const [copiedContinuePrompt, setCopiedContinuePrompt] = useState(false)
  const [promptGuidance, setPromptGuidance] = useState('')
  const [includeStrategicInstructions, setIncludeStrategicInstructions] = useState(true)
  const [copiedNativeReasoning, setCopiedNativeReasoning] = useState(false)
  const [copiedParsedReasoning, setCopiedParsedReasoning] = useState(false)
  const [copiedRawResponse, setCopiedRawResponse] = useState(false)
  const [copiedFullContext, setCopiedFullContext] = useState(false)
  const [wasManuallyStopped, setWasManuallyStopped] = useState(false)
  const [storedSolution, setStoredSolution] = useState<Action[]>([])
  const [showFullPath, setShowFullPath] = useState(false)

  // Exploration mode state
  const [isExploring, setIsExploring] = useState(false)
  const [explorationMoves, setExplorationMoves] = useState<string[]>([])
  const [lastExplorationCommand, setLastExplorationCommand] = useState<ExplorationCommand | null>(
    null,
  )
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)
  const [previousAIResponse, setPreviousAIResponse] = useState<string | null>(null)
  const [explorationHistory, setExplorationHistory] = useState<ExplorationAttempt[]>([])
  // Cumulative moves in current exploration path (resets on RESTART)
  const [cumulativeExplorationMoves, setCumulativeExplorationMoves] = useState<Action[]>([])
  // Track command usage counts
  const [commandCounts, setCommandCounts] = useState<CommandCounts>({
    explore: 0,
    continue: 0,
    restart: 0,
    submit: 0,
  })
  // Auto-run mode for exploration
  const [autoRun, setAutoRun] = useState(false)
  const autoRunRef = useRef(false)
  // Response history for exploration mode
  const [responseHistory, setResponseHistory] = useState<
    Array<{
      id: string
      command: string
      tokens: number
      durationMs: number
      moves: number
    }>
  >([])

  // Keep refs in sync with state
  useEffect(() => {
    autoRunRef.current = autoRun
  }, [autoRun])
  useEffect(() => {
    isExploringRef.current = isExploring
  }, [isExploring])

  const abortRef = useRef(false)
  const isRunningRef = useRef(false)
  const isReplayingRef = useRef(false)
  const isExploringRef = useRef(false)
  const movesRef = useRef<Action[]>([])
  const moveIndexRef = useRef(0)
  const continueExplorationRef = useRef<(() => void) | null>(null)
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

    // Set initial value immediately
    setInflightSeconds(Math.floor((Date.now() - inflightStartTime) / 1000))

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
      setIsExploring(false)
      setExplorationMoves([])
      setLastExplorationCommand(null)
      setInitialPrompt(null)
      setPreviousAIResponse(null)
      setExplorationHistory([])
      setCumulativeExplorationMoves([])
      setCommandCounts({ explore: 0, continue: 0, restart: 0, submit: 0 })
      setAutoRun(false)
      setResponseHistory([])
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
      // Auto-continue if in auto-run mode and exploring (even if game over - AI can RESTART)
      if (autoRunRef.current && isExploringRef.current && continueExplorationRef.current) {
        setTimeout(() => {
          continueExplorationRef.current?.()
        }, 500)
      }
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
      // Auto-continue if in auto-run mode and exploring (AI can RESTART after failure)
      if (autoRunRef.current && isExploringRef.current && continueExplorationRef.current) {
        setTimeout(() => {
          continueExplorationRef.current?.()
        }, 500)
      }
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
    setIsExploring(false)
    setExplorationMoves([])
    setLastExplorationCommand(null)
    setInitialPrompt(null)
    setPreviousAIResponse(null)
    abortRef.current = false
    setPlannedMoves([])
    setSessionMetrics(createSessionMetrics())

    // Generate and store the initial prompt for potential continuation
    const prompt = generateDungeonPrompt(state, promptOptions)
    setInitialPrompt(prompt)

    setInflightStartTime(Date.now())

    // Get solution from LLM (pass promptGuidance as seed reasoning for "Fake History" approach)
    const effectiveSeedReasoning = includeStrategicInstructions ? promptGuidance : undefined
    const response = await getDungeonSolution(state, model, promptOptions, effectiveSeedReasoning)

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

    // Track response history for exploration mode
    if (promptOptions.enableExploration) {
      const command = response.explorationCommand || 'SOLUTION'
      setResponseHistory((prev) => [
        ...prev,
        {
          id: uuidv4(),
          command: command === 'RESTART_EXPLORE' ? 'RESTART EXPLORE' : command,
          tokens: response.outputTokens,
          durationMs: response.durationMs,
          moves: response.moves.length,
        },
      ])
    }

    if (response.error || response.moves.length === 0) {
      setError(response.error || 'No moves returned from AI')
      setIsRunning(false)
      isRunningRef.current = false
      return
    }

    // Handle exploration commands and update counts
    // SUBMIT means AI is finalizing their solution
    if (response.explorationCommand === 'SUBMIT' || response.hasSubmit) {
      // Final solution - store for replay
      setIsExploring(false)
      setStoredSolution(response.moves)
      setCommandCounts((prev) => ({ ...prev, submit: prev.submit + 1 }))
      // If there was also a RESTART, count it
      if (response.explorationCommand === 'RESTART') {
        setCommandCounts((prev) => ({ ...prev, restart: prev.restart + 1 }))
      }
    } else if (response.explorationCommand === 'EXPLORE') {
      setIsExploring(true)
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand(response.explorationCommand)
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves(response.moves)
      setCommandCounts((prev) => ({ ...prev, explore: prev.explore + 1 }))
    } else if (response.explorationCommand === 'CONTINUE') {
      setIsExploring(true)
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand(response.explorationCommand)
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves(response.moves)
      setCommandCounts((prev) => ({ ...prev, continue: prev.continue + 1 }))
    } else if (response.explorationCommand === 'RESTART_EXPLORE') {
      // Reset was already done at start, execute exploration moves
      setIsExploring(true)
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand('RESTART_EXPLORE')
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves(response.moves)
      setCommandCounts((prev) => ({ ...prev, restart: prev.restart + 1 }))
    } else if (response.explorationCommand === 'RESTART') {
      // RESTART without SUBMIT - still exploring after reset
      setIsExploring(true)
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand('RESTART')
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves(response.moves)
      setCommandCounts((prev) => ({ ...prev, restart: prev.restart + 1 }))
    } else if (promptOptions.enableExploration) {
      // In exploration mode without any command - keep exploring
      setIsExploring(true)
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand(null)
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves(response.moves)
    } else {
      // Normal solution (non-exploration mode) - store for replay
      setStoredSolution(response.moves)
    }

    // Create planned moves
    const moves: ExtendedPlannedMove[] = response.moves.map((action) => ({
      id: uuidv4(),
      action,
      status: 'pending' as PlannedMoveStatus,
    }))
    setPlannedMoves(moves)

    // Set up for execution
    movesRef.current = response.moves
    moveIndexRef.current = 0
    isReplayingRef.current = false

    // Start executing moves after a short delay
    setTimeout(() => {
      executeNextMove()
    }, 300)
  }, [
    state,
    isRunning,
    model,
    promptOptions,
    promptGuidance,
    includeStrategicInstructions,
    onReset,
    executeNextMove,
  ])

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
    setIsExploring(false)
    setExplorationMoves([])
    setLastExplorationCommand(null)
    setInitialPrompt(null)
    setPreviousAIResponse(null)
    setExplorationHistory([])
    setCumulativeExplorationMoves([])
    setCommandCounts({ explore: 0, continue: 0, restart: 0, submit: 0 })
    setAutoRun(false)
    setResponseHistory([])
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

  // Replay the exploration moves from the beginning
  const handleReplayExploration = useCallback(() => {
    if (cumulativeExplorationMoves.length === 0) return

    // Mark as replaying so we preserve session metrics
    isReplayingRef.current = true

    // Reset puzzle state
    onReset()

    // Keep exploration state but reset running state
    setIsRunning(true)
    isRunningRef.current = true
    setError(null)
    setWasManuallyStopped(false)

    // Create fresh planned moves from cumulative exploration moves
    const moves: ExtendedPlannedMove[] = cumulativeExplorationMoves.map((action) => ({
      id: uuidv4(),
      action,
      status: 'pending' as PlannedMoveStatus,
    }))
    setPlannedMoves(moves)

    // Set up for execution
    movesRef.current = cumulativeExplorationMoves
    moveIndexRef.current = 0

    // Start executing moves after a short delay
    setTimeout(() => {
      executeNextMove()
    }, 300)
  }, [cumulativeExplorationMoves, onReset, executeNextMove])

  // Continue exploration after AI has explored
  const handleContinueExploration = useCallback(async () => {
    if (!state || !initialPrompt || !previousAIResponse || isRunning) return

    setIsRunning(true)
    isRunningRef.current = true
    setError(null)
    abortRef.current = false

    // Generate continuation prompt with current state
    const wasRestart =
      lastExplorationCommand === 'RESTART' || lastExplorationCommand === 'RESTART_EXPLORE'
    // Use native reasoning if available, otherwise parsed reasoning, otherwise raw response
    const aiReasoning = nativeReasoning || parsedReasoning || previousAIResponse

    // Record this exploration attempt to history before continuing
    const boardStateAfter = gameStateToAscii(state)
    const currentAttempt: ExplorationAttempt = {
      moves: explorationMoves,
      result: state.done ? (state.success ? 'success' : 'gameover') : 'continue',
      wasRestart,
      reasoning: aiReasoning ?? undefined,
      boardStateAfter,
      playerPositionAfter: { x: state.playerPosition.x, y: state.playerPosition.y },
      inventoryAfter: [...state.inventory.keys],
      movesMadeAfter: state.turn,
    }
    const updatedHistory = [...explorationHistory, currentAttempt]
    setExplorationHistory(updatedHistory)

    const continuationPrompt = generateExplorationContinuationPrompt(
      state,
      promptOptions,
      explorationMoves,
      wasRestart,
      initialPrompt,
      aiReasoning,
      updatedHistory.slice(0, -1), // Pass history excluding the current attempt (which is shown in EXPLORATION RESULT)
      commandCounts,
    )

    setInflightStartTime(Date.now())

    // Continue the conversation
    const response = await continueExploration(
      initialPrompt,
      previousAIResponse,
      continuationPrompt,
      model,
    )

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

    // Track response history
    const command = response.explorationCommand || 'SOLUTION'
    setResponseHistory((prev) => [
      ...prev,
      {
        id: uuidv4(),
        command: command === 'RESTART_EXPLORE' ? 'RESTART EXPLORE' : command,
        tokens: response.outputTokens,
        durationMs: response.durationMs,
        moves: response.moves.length,
      },
    ])

    if (response.error || response.moves.length === 0) {
      setError(response.error || 'No moves returned from AI')
      setIsRunning(false)
      isRunningRef.current = false
      return
    }

    // Handle the response and update command counts
    // SUBMIT means AI is finalizing their solution
    if (response.explorationCommand === 'SUBMIT' || response.hasSubmit) {
      // Final solution - possibly with RESTART
      if (response.explorationCommand === 'RESTART') {
        onReset()
        setCommandCounts((prev) => ({ ...prev, restart: prev.restart + 1 }))
      }
      setIsExploring(false)
      setStoredSolution(response.moves)
      setCommandCounts((prev) => ({ ...prev, submit: prev.submit + 1 }))
    } else if (response.explorationCommand === 'EXPLORE') {
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand(response.explorationCommand)
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves((prev) => [...prev, ...response.moves])
      setCommandCounts((prev) => ({ ...prev, explore: prev.explore + 1 }))
    } else if (response.explorationCommand === 'CONTINUE') {
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand(response.explorationCommand)
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves((prev) => [...prev, ...response.moves])
      setCommandCounts((prev) => ({ ...prev, continue: prev.continue + 1 }))
    } else if (response.explorationCommand === 'RESTART_EXPLORE') {
      // Restart and explore
      onReset()
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand('RESTART_EXPLORE')
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves(response.moves)
      setCommandCounts((prev) => ({ ...prev, restart: prev.restart + 1 }))
    } else if (response.explorationCommand === 'RESTART') {
      // Restart without SUBMIT - still exploring
      onReset()
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand('RESTART')
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves(response.moves)
      setCommandCounts((prev) => ({ ...prev, restart: prev.restart + 1 }))
    } else {
      // No command - continue exploring from current state
      setExplorationMoves(response.moves.map((m) => m.toString()))
      setLastExplorationCommand(null)
      setPreviousAIResponse(response.rawResponse)
      setCumulativeExplorationMoves((prev) => [...prev, ...response.moves])
    }

    // Create planned moves
    const moves: ExtendedPlannedMove[] = response.moves.map((action) => ({
      id: uuidv4(),
      action,
      status: 'pending' as PlannedMoveStatus,
    }))
    setPlannedMoves(moves)

    // Set up for execution
    movesRef.current = response.moves
    moveIndexRef.current = 0
    isReplayingRef.current = false

    // Start executing moves
    setTimeout(() => {
      executeNextMove()
    }, 300)
  }, [
    state,
    initialPrompt,
    previousAIResponse,
    nativeReasoning,
    parsedReasoning,
    isRunning,
    lastExplorationCommand,
    promptOptions,
    explorationMoves,
    explorationHistory,
    commandCounts,
    model,
    onReset,
    executeNextMove,
  ])

  // Keep ref in sync with handleContinueExploration
  useEffect(() => {
    continueExplorationRef.current = handleContinueExploration
  }, [handleContinueExploration])

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
      let finalPrompt: string
      const effectiveGuidance = includeStrategicInstructions ? promptGuidance.trim() : ''
      if (effectiveGuidance) {
        // Use "Fake History" format for seeding reasoning across all models
        const messages = [
          {
            role: 'user',
            content: previewPrompt,
          },
          {
            role: 'assistant',
            content: effectiveGuidance,
          },
          {
            role: 'user',
            content:
              'The above reasoning has been verified as correct. Based on that high level analysis, translate the strategy to a specific move sequence to complete the puzzle.',
          },
        ]
        finalPrompt = JSON.stringify(messages, null, 2)
      } else {
        finalPrompt = previewPrompt
      }
      await navigator.clipboard.writeText(finalPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [previewPrompt, promptGuidance, includeStrategicInstructions])

  const handleCopyContinuePrompt = useCallback(async () => {
    if (!state || !isExploring || !initialPrompt) return
    const wasRestart =
      lastExplorationCommand === 'RESTART' || lastExplorationCommand === 'RESTART_EXPLORE'
    // Use native reasoning if available, otherwise parsed reasoning, otherwise raw response
    const aiReasoning = nativeReasoning || parsedReasoning || previousAIResponse
    const continuationPrompt = generateExplorationContinuationPrompt(
      state,
      promptOptions,
      explorationMoves,
      wasRestart,
      initialPrompt,
      aiReasoning ?? undefined,
      explorationHistory, // Include full history for preview
      commandCounts,
    )
    try {
      await navigator.clipboard.writeText(continuationPrompt)
      setCopiedContinuePrompt(true)
      setTimeout(() => setCopiedContinuePrompt(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [
    state,
    isExploring,
    lastExplorationCommand,
    promptOptions,
    explorationMoves,
    explorationHistory,
    commandCounts,
    initialPrompt,
    nativeReasoning,
    parsedReasoning,
    previousAIResponse,
  ])

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

  const handleCopyRawResponse = useCallback(async () => {
    if (!rawResponse) return
    try {
      await navigator.clipboard.writeText(rawResponse)
      setCopiedRawResponse(true)
      setTimeout(() => setCopiedRawResponse(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [rawResponse])

  const handleCopyFullContext = useCallback(async () => {
    if (!previewPrompt) return
    try {
      const parts: string[] = []
      const effectiveGuidance = includeStrategicInstructions ? promptGuidance.trim() : ''

      // Initial Prompt
      parts.push('## Initial Prompt')
      parts.push('')
      if (effectiveGuidance) {
        // Use "Fake History" format for seeding reasoning across all models
        const messages = [
          {
            role: 'user',
            content: previewPrompt,
          },
          {
            role: 'assistant',
            content: effectiveGuidance,
          },
          {
            role: 'user',
            content:
              'The above reasoning has been verified as correct. Based on that high level analysis, translate the strategy to a specific move sequence to complete the puzzle.',
          },
        ]
        parts.push('```json')
        parts.push(JSON.stringify(messages, null, 2))
        parts.push('```')
      } else {
        parts.push(previewPrompt)
      }
      parts.push('')

      // AI Reasoning
      const reasoning = nativeReasoning || parsedReasoning
      if (reasoning) {
        parts.push('## AI Reasoning')
        parts.push('')
        parts.push(reasoning)
        parts.push('')
      }

      // AI Response
      if (rawResponse) {
        parts.push('## AI Response')
        parts.push('')
        parts.push('```json')
        parts.push(rawResponse)
        parts.push('```')
        parts.push('')
      }

      // Puzzle Outcome
      parts.push('## Puzzle Outcome')
      parts.push('')
      if (state?.done) {
        if (state.success) {
          parts.push('**Result:** ✓ Puzzle Solved')
        } else {
          parts.push('**Result:** ✗ Failed (Game Over)')
        }
      } else {
        parts.push('**Result:** In Progress')
      }
      parts.push(`**Moves Executed:** ${state?.turn ?? 0}`)
      parts.push('')

      // Metrics
      parts.push('## Metrics')
      parts.push('')
      parts.push(`- **Cost:** $${sessionMetrics.totalCost.toFixed(6)}`)
      parts.push(`- **Total Tokens:** ${sessionMetrics.totalTokens.toLocaleString()}`)
      parts.push(`  - Input: ${sessionMetrics.totalInputTokens.toLocaleString()}`)
      parts.push(`  - Output: ${sessionMetrics.totalOutputTokens.toLocaleString()}`)
      if (sessionMetrics.totalReasoningTokens > 0) {
        parts.push(`  - Reasoning: ${sessionMetrics.totalReasoningTokens.toLocaleString()}`)
      }
      parts.push(`- **Duration:** ${(sessionMetrics.totalDurationMs / 1000).toFixed(2)}s`)
      parts.push(`- **Requests:** ${sessionMetrics.requestCount}`)

      await navigator.clipboard.writeText(parts.join('\n'))
      setCopiedFullContext(true)
      setTimeout(() => setCopiedFullContext(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [
    previewPrompt,
    promptGuidance,
    includeStrategicInstructions,
    nativeReasoning,
    parsedReasoning,
    rawResponse,
    state,
    sessionMetrics,
  ])

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
              {(commandCounts.explore > 0 ||
                commandCounts.continue > 0 ||
                commandCounts.restart > 0 ||
                commandCounts.submit > 0) && (
                <>
                  <div className="border-t border-border/50 my-1" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EXPLORE actions:</span>
                    <span>{commandCounts.explore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CONTINUE actions:</span>
                    <span>{commandCounts.continue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RESTART actions:</span>
                    <span>{commandCounts.restart}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SUBMIT actions:</span>
                    <span>{commandCounts.submit}</span>
                  </div>
                  {responseHistory.length > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Total Moves:</span>
                      <span>{responseHistory.reduce((sum, e) => sum + e.moves, 0)}</span>
                    </div>
                  )}
                </>
              )}
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
            {/* Add Instructions option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="addInstructions"
                checked={promptOptions.addInstructions}
                onCheckedChange={() => togglePromptOption('addInstructions')}
                disabled={isRunning || plannedMoves.length > 0}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="addInstructions"
                className={`text-xs ${isRunning || plannedMoves.length > 0 ? 'text-muted-foreground cursor-default' : 'cursor-pointer'}`}
              >
                Add Instructions
              </Label>
            </div>
            {/* Add Examples option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="addExamples"
                checked={promptOptions.addExamples}
                onCheckedChange={() => togglePromptOption('addExamples')}
                disabled={isRunning || plannedMoves.length > 0}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="addExamples"
                className={`text-xs ${isRunning || plannedMoves.length > 0 ? 'text-muted-foreground cursor-default' : 'cursor-pointer'}`}
              >
                Add Examples
              </Label>
            </div>
            {/* Enable Exploration option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="enableExploration"
                checked={promptOptions.enableExploration}
                onCheckedChange={() => togglePromptOption('enableExploration')}
                disabled={isRunning || plannedMoves.length > 0}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="enableExploration"
                className={`text-xs ${isRunning || plannedMoves.length > 0 ? 'text-muted-foreground cursor-default' : 'cursor-pointer'}`}
              >
                Enable Exploration
              </Label>
            </div>
            {/* Enable Semantic Symbols option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="enableSemanticSymbols"
                checked={promptOptions.enableSemanticSymbols}
                onCheckedChange={() => togglePromptOption('enableSemanticSymbols')}
                disabled={isRunning || plannedMoves.length > 0}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="enableSemanticSymbols"
                className={`text-xs ${isRunning || plannedMoves.length > 0 ? 'text-muted-foreground cursor-default' : 'cursor-pointer'}`}
              >
                Enable Semantic Symbols
              </Label>
            </div>
            {/* Include Reasoning option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeReasoning"
                checked={promptOptions.includeReasoning}
                onCheckedChange={() => togglePromptOption('includeReasoning')}
                disabled={isRunning || plannedMoves.length > 0}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="includeReasoning"
                className={`text-xs ${isRunning || plannedMoves.length > 0 ? 'text-muted-foreground cursor-default' : 'cursor-pointer'}`}
              >
                Include Reasoning Summary
              </Label>
            </div>
          </div>
        </div>
        <Separator />

        {/* Controls */}
        <div className="space-y-2 flex-shrink-0">
          {isExploring && !isRunning ? (
            <>
              <div className="text-xs text-yellow-400 mb-2">AI is exploring...</div>
              <Button onClick={handleContinueExploration} className="w-full" size="sm">
                Continue Exploration
              </Button>
              <Button
                onClick={handleCopyContinuePrompt}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Copy className="h-3 w-3 mr-1.5" />
                {copiedContinuePrompt ? 'Copied!' : 'Copy Continue Prompt'}
              </Button>
              {cumulativeExplorationMoves.length > 0 && (
                <Button
                  onClick={handleReplayExploration}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  Replay Exploration ({cumulativeExplorationMoves.length} moves)
                </Button>
              )}
              <Button onClick={handleResetAI} variant="outline" className="w-full" size="sm">
                Reset
              </Button>
              <Button
                onClick={handleCopyFullContext}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Copy className="h-3 w-3 mr-1.5" />
                {copiedFullContext ? 'Copied!' : 'Copy Full Context'}
              </Button>
            </>
          ) : aiCompleted ? (
            <>
              <Button onClick={handleReplay} className="w-full" size="sm">
                Replay AI Solution
              </Button>
              <Button onClick={handleResetAI} variant="outline" className="w-full" size="sm">
                Reset
              </Button>
              <Button
                onClick={handleCopyFullContext}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Copy className="h-3 w-3 mr-1.5" />
                {copiedFullContext ? 'Copied!' : 'Copy Full Context'}
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
              <Button
                onClick={handleCopyFullContext}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Copy className="h-3 w-3 mr-1.5" />
                {copiedFullContext ? 'Copied!' : 'Copy Full Context'}
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
              {promptOptions.enableExploration && (
                <Button
                  onClick={() => {
                    setAutoRun(true)
                    handleStart()
                  }}
                  disabled={disabled || !state || !hasApiKey || state.success}
                  variant="secondary"
                  className="w-full"
                  size="sm"
                >
                  Auto-Run AI Agent
                </Button>
              )}
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Strategic Instructions</Label>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="includeStrategicInstructions"
                      checked={includeStrategicInstructions}
                      onCheckedChange={(checked) =>
                        setIncludeStrategicInstructions(checked === true)
                      }
                      className="h-3.5 w-3.5"
                    />
                    <Label
                      htmlFor="includeStrategicInstructions"
                      className="text-[10px] text-muted-foreground cursor-pointer"
                    >
                      Include
                    </Label>
                  </div>
                </div>
                <Textarea
                  value={promptGuidance}
                  onChange={(e) => setPromptGuidance(e.target.value)}
                  placeholder="Add strategic instructions for the model..."
                  className="min-h-[60px] text-xs"
                />
              </div>
            </>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="space-y-2">
            <div className="bg-red-500/10 text-red-400 rounded-md px-3 py-2 text-xs">{error}</div>
            {storedSolution.length > 0 ? (
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
            ) : !isExploring ? (
              <Button onClick={handleResetAI} variant="outline" className="w-full" size="sm">
                Reset
              </Button>
            ) : null}
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <details className="text-xs flex-1">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                  Raw AI Response
                </summary>
                <pre className="bg-muted/20 rounded-md p-2 mt-1 text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {rawResponse}
                </pre>
              </details>
              <button
                type="button"
                onClick={handleCopyRawResponse}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy raw response"
              >
                {copiedRawResponse ? (
                  <span className="text-[10px] text-green-400">Copied!</span>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Response History for exploration mode */}
        {promptOptions.enableExploration && responseHistory.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Response History
            </div>
            <div className="rounded-md border text-[10px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-2 py-1 text-muted-foreground font-normal">#</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-normal">
                      Command
                    </th>
                    <th className="text-right px-2 py-1 text-muted-foreground font-normal">
                      Tokens
                    </th>
                    <th className="text-right px-2 py-1 text-muted-foreground font-normal">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {responseHistory.map((entry, idx) => (
                    <tr key={entry.id} className="border-b border-border/30 last:border-0">
                      <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1 font-mono">{entry.command}</td>
                      <td className="px-2 py-1 text-right font-mono">
                        {entry.tokens.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-right font-mono">
                        {formatDuration(entry.durationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
