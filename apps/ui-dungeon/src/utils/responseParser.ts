/**
 * Parse AI responses for dungeon puzzle solutions
 */

import type { Action, ExplorationCommand } from '@src/types'

export interface ParsedAIResponse {
  moves: Action[]
  reasoning?: string
  error?: string
  /** Exploration command if AI is exploring rather than solving */
  explorationCommand?: ExplorationCommand
}

const VALID_ACTIONS: Action[] = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'INTERACT']

/**
 * Parse an AI response to extract moves, reasoning, and exploration commands
 */
export function parseAIResponse(content: string): ParsedAIResponse {
  // Check for exploration commands before JSON parsing
  const trimmedContent = content.trim()

  // Check for RESTART EXPLORE pattern
  const restartExploreMatch = trimmedContent.match(/^RESTART\s+EXPLORE\s+(.+)$/is)
  if (restartExploreMatch) {
    const movesStr = restartExploreMatch[1]
    const moves = parseMovesFromString(movesStr)
    return {
      moves,
      explorationCommand: 'RESTART_EXPLORE',
      reasoning: 'Restarting and exploring from beginning',
    }
  }

  // Check for RESTART pattern (with moves)
  const restartMatch = trimmedContent.match(/^RESTART\s+(.+)$/is)
  if (restartMatch) {
    const movesStr = restartMatch[1]
    // Check if it's just "RESTART EXPLORE" without moves (handled above)
    if (movesStr.trim().toUpperCase() === 'EXPLORE') {
      return {
        moves: [],
        explorationCommand: 'RESTART_EXPLORE',
        reasoning: 'Restarting and exploring from beginning',
      }
    }
    const moves = parseMovesFromString(movesStr)
    return {
      moves,
      explorationCommand: 'RESTART',
      reasoning: 'Restarting with new move sequence',
    }
  }

  // Check for EXPLORE pattern
  const exploreMatch = trimmedContent.match(/^EXPLORE\s+(.+)$/is)
  if (exploreMatch) {
    const movesStr = exploreMatch[1]
    const moves = parseMovesFromString(movesStr)
    return {
      moves,
      explorationCommand: 'EXPLORE',
      reasoning: 'Exploring environment',
    }
  }

  // Check for CONTINUE pattern (continue from current state after exploration)
  const continueMatch = trimmedContent.match(/^CONTINUE\s+(.+)$/is)
  if (continueMatch) {
    const movesStr = continueMatch[1]
    const moves = parseMovesFromString(movesStr)
    return {
      moves,
      explorationCommand: 'CONTINUE',
      reasoning: 'Continuing from current position',
    }
  }

  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      moves: [],
      error: 'No JSON found in response',
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    // Extract reasoning if present
    const reasoning = parsed.reasoning || parsed.explanation || undefined

    // Handle single move format: {"move": "UP"}
    if (parsed.move && typeof parsed.move === 'string') {
      const move = parsed.move.toUpperCase() as Action
      if (VALID_ACTIONS.includes(move)) {
        return {
          moves: [move],
          reasoning,
        }
      }
      return {
        moves: [],
        reasoning,
        error: `Invalid move: ${parsed.move}`,
      }
    }

    // Handle multiple moves format: {"moves": ["COMMAND", "UP", "DOWN", ...]}
    // Command can be first element: EXPLORE, CONTINUE, RESTART, or RESTART followed by EXPLORE
    if (parsed.moves && Array.isArray(parsed.moves)) {
      let explorationCommand: ExplorationCommand | undefined
      let movesToParse = parsed.moves

      // Check if first element is a command
      if (movesToParse.length > 0 && typeof movesToParse[0] === 'string') {
        const firstElement = movesToParse[0].toUpperCase()

        if (firstElement === 'RESTART' && movesToParse.length > 1) {
          const secondElement =
            typeof movesToParse[1] === 'string' ? movesToParse[1].toUpperCase() : ''
          if (secondElement === 'EXPLORE') {
            // RESTART EXPLORE command
            explorationCommand = 'RESTART_EXPLORE'
            movesToParse = movesToParse.slice(2)
          } else {
            // RESTART command (final solution)
            explorationCommand = 'RESTART'
            movesToParse = movesToParse.slice(1)
          }
        } else if (firstElement === 'EXPLORE') {
          explorationCommand = 'EXPLORE'
          movesToParse = movesToParse.slice(1)
        } else if (firstElement === 'CONTINUE') {
          explorationCommand = 'CONTINUE'
          movesToParse = movesToParse.slice(1)
        }
      }

      const validMoves: Action[] = []
      for (const move of movesToParse) {
        if (typeof move === 'string') {
          const upperMove = move.toUpperCase() as Action
          if (VALID_ACTIONS.includes(upperMove)) {
            validMoves.push(upperMove)
          }
        }
      }

      if (validMoves.length === 0 && !explorationCommand) {
        return {
          moves: [],
          reasoning,
          error: 'No valid moves found in response',
        }
      }

      return {
        moves: validMoves,
        reasoning,
        explorationCommand,
      }
    }

    return {
      moves: [],
      error: 'Response does not contain move or moves field',
    }
  } catch (e) {
    return {
      moves: [],
      error: `Failed to parse JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
    }
  }
}

/**
 * Convert moves to a simple notation string
 */
export function movesToNotation(moves: Action[]): string {
  return moves
    .map((m) => {
      switch (m) {
        case 'UP':
          return 'u'
        case 'DOWN':
          return 'd'
        case 'LEFT':
          return 'l'
        case 'RIGHT':
          return 'r'
        case 'INTERACT':
          return 'i'
        default:
          return '?'
      }
    })
    .join('')
}

/**
 * Parse moves from a space-separated string (e.g., "UP DOWN LEFT RIGHT")
 */
function parseMovesFromString(movesStr: string): Action[] {
  const moves: Action[] = []
  const parts = movesStr.trim().split(/\s+/)

  for (const part of parts) {
    const upperPart = part.toUpperCase() as Action
    if (VALID_ACTIONS.includes(upperPart)) {
      moves.push(upperPart)
    }
  }

  return moves
}
