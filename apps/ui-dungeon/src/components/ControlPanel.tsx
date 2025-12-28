import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import type { GameState } from '@src/types'
import { RotateCcw, Undo2 } from 'lucide-react'
import { useMemo } from 'react'

interface ControlPanelProps {
  state: GameState | null
  onUndo: () => void
  onReset: () => void
  disabled?: boolean
  aiInferenceTimeMs?: number | null
}

export function ControlPanel({
  state,
  onUndo,
  onReset,
  disabled = false,
  aiInferenceTimeMs,
}: ControlPanelProps) {
  const canUndo = state !== null && state.moveHistory.length > 0

  const displayTime = useMemo(() => {
    // If AI inference time is available, show that
    if (aiInferenceTimeMs != null && aiInferenceTimeMs > 0) {
      const seconds = Math.round(aiInferenceTimeMs / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${minutes}m ${secs}s`
    }

    // Otherwise show game elapsed time
    if (!state?.startTime) return null
    const endTime = state.endTime ?? Date.now()
    const ms = endTime - state.startTime
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [state?.startTime, state?.endTime, aiInferenceTimeMs])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Game Stats
        </span>
      </div>

      <Separator />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/30 rounded-md px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Turn</div>
          <div className="text-sm font-semibold tabular-nums">
            {state?.turn ?? 0}/{state?.maxTurns ?? 0}
          </div>
        </div>
        <div className="bg-muted/30 rounded-md px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
            {aiInferenceTimeMs != null && aiInferenceTimeMs > 0 ? 'AI Time' : 'Time'}
          </div>
          <div className="text-sm font-semibold tabular-nums">{displayTime ?? '--:--'}</div>
        </div>
      </div>

      {/* Inventory display */}
      {state && state.inventory.keys.length > 0 && (
        <div className="bg-muted/30 rounded-md px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Keys</div>
          <div className="text-sm font-semibold">
            {state.inventory.keys
              .map((key) => {
                const colorEmoji: Record<string, string> = {
                  RED: '🔴',
                  BLUE: '🔵',
                  GREEN: '🟢',
                  YELLOW: '🟡',
                }
                return colorEmoji[key] ?? '🔑'
              })
              .join(' ')}
          </div>
        </div>
      )}

      {/* Status messages */}
      {state?.success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-md px-3 py-2">
          <div className="text-green-500 font-medium text-xs">Puzzle Complete!</div>
          <div className="text-green-500/70 text-[10px]">Solved in {state.turn} turns</div>
        </div>
      )}

      {state?.done && !state?.success && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          <div className="text-red-500 font-medium text-xs">Game Over</div>
          <div className="text-red-500/70 text-[10px]">{state.message || 'Try again!'}</div>
        </div>
      )}

      <Separator />

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onUndo}
          disabled={disabled || !canUndo}
          size="sm"
          variant="secondary"
          className="flex-1 h-8 text-xs"
        >
          <Undo2 className="w-3.5 h-3.5 mr-1" />
          Undo
        </Button>
        <Button
          onClick={onReset}
          disabled={disabled || !state}
          size="sm"
          variant="secondary"
          className="flex-1 h-8 text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  )
}
