import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import type { GameState, KeyColor } from '@src/types'
import { Copy, Play, RotateCcw, Square, Undo2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

// Key color mappings (matching the map tiles)
const KEY_COLORS: Record<KeyColor, string> = {
  RED: '#ffb3ba',
  BLUE: '#bae1ff',
  GREEN: '#baffc9',
  YELLOW: '#ffffba',
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

interface ControlPanelProps {
  state: GameState | null
  onUndo: () => void
  onReset: () => void
  disabled?: boolean
  aiInferenceTimeMs?: number | null
  timerStarted?: boolean
  elapsedTime?: number
  // Session props
  sessionActive?: boolean
  sessionElapsedTime?: number
  sessionTotalMoves?: number
  sessionRestartCount?: number
  onStartSession?: () => void
  onEndSession?: () => void
}

export function ControlPanel({
  state,
  onUndo,
  onReset,
  disabled = false,
  aiInferenceTimeMs,
  timerStarted = false,
  elapsedTime = 0,
  sessionActive = false,
  sessionElapsedTime = 0,
  sessionTotalMoves = 0,
  sessionRestartCount = 0,
  onStartSession,
  onEndSession,
}: ControlPanelProps) {
  const canUndo = state !== null && state.moveHistory.length > 0
  const [copied, setCopied] = useState(false)

  const displayTime = useMemo(() => {
    // If AI inference time is available, show that
    if (aiInferenceTimeMs != null && aiInferenceTimeMs > 0) {
      const seconds = Math.round(aiInferenceTimeMs / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${minutes}m ${secs}s`
    }

    // If human timer is started, show elapsed time
    if (timerStarted) {
      return formatTime(elapsedTime)
    }

    // Otherwise show game elapsed time (fallback)
    if (!state?.startTime) return null
    const endTime = state.endTime ?? Date.now()
    const ms = endTime - state.startTime
    return formatTime(ms)
  }, [state?.startTime, state?.endTime, aiInferenceTimeMs, timerStarted, elapsedTime])

  // Timer is running (yellow/amber) when started but game not done
  const isTimerRunning = timerStarted && !state?.done

  // Copy session stats to clipboard
  const handleCopyStats = useCallback(() => {
    const stats = `Human Session Stats
Total Time: ${formatTime(sessionElapsedTime)}
Total Moves: ${sessionTotalMoves}
Total Restarts: ${sessionRestartCount}`

    navigator.clipboard.writeText(stats).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [sessionElapsedTime, sessionTotalMoves, sessionRestartCount])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Game Stats
        </span>
      </div>

      <Separator />

      {/* Session stats table - shown when session is active */}
      {sessionActive ? (
        <div className="bg-muted/30 rounded-md px-2 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
              Human Session Stats
            </span>
            <button
              type="button"
              onClick={handleCopyStats}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Copy stats"
            >
              <Copy className={`w-3 h-3 ${copied ? 'text-green-500' : 'text-muted-foreground'}`} />
            </button>
          </div>
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="text-muted-foreground py-0.5">Total Time</td>
                <td
                  className={`text-right font-semibold tabular-nums ${state?.success ? '' : 'text-amber-400'}`}
                >
                  {formatTime(sessionElapsedTime)}
                </td>
              </tr>
              <tr>
                <td className="text-muted-foreground py-0.5">Total Moves</td>
                <td className="text-right font-semibold tabular-nums">{sessionTotalMoves}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground py-0.5">Total Restarts</td>
                <td className="text-right font-semibold tabular-nums">{sessionRestartCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        /* Regular stats grid - shown when no session */
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/30 rounded-md px-2 py-1.5">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Moves</div>
            <div className="text-sm font-semibold tabular-nums">{state?.turn ?? 0}</div>
          </div>
          <div className="bg-muted/30 rounded-md px-2 py-1.5">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
              {aiInferenceTimeMs != null && aiInferenceTimeMs > 0 ? 'AI Time' : 'Time'}
            </div>
            <div
              className={`text-sm font-semibold tabular-nums ${isTimerRunning ? 'text-amber-400' : ''}`}
            >
              {displayTime ?? '--:--'}
            </div>
          </div>
        </div>
      )}

      {/* Inventory display */}
      {state && state.inventory.keys.length > 0 && (
        <div className="bg-muted/30 rounded-md px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Keys</div>
          <div className="flex gap-1.5 mt-1">
            {state.inventory.keys.map((key) => (
              <div
                key={key}
                className="w-6 h-6 rounded flex items-center justify-center text-xs"
                style={{ backgroundColor: KEY_COLORS[key] }}
                title={`${key.toLowerCase()} key`}
              >
                🔑
              </div>
            ))}
          </div>
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

      {/* Session buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onStartSession}
          disabled={disabled || !state || sessionActive}
          size="sm"
          variant={sessionActive ? 'secondary' : 'default'}
          className="flex-1 h-8 text-xs"
        >
          <Play className="w-3.5 h-3.5 mr-1" />
          Start Session
        </Button>
        <Button
          onClick={onEndSession}
          disabled={disabled || !sessionActive}
          size="sm"
          variant="secondary"
          className="flex-1 h-8 text-xs"
        >
          <Square className="w-3.5 h-3.5 mr-1" />
          End Session
        </Button>
      </div>
    </div>
  )
}
