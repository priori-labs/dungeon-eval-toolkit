/**
 * Prompt generation for AI to solve dungeon puzzles
 */

import type { GameState, PromptOptions, TileType } from '@src/types'

/**
 * Default prompt options - minimal by default
 */
export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  executionMode: 'fullSolution',
  addInstructions: false,
  addExamples: false,
  enableExploration: false,
  enableSemanticSymbols: false,
}

/**
 * Convert tile type to obfuscated/symbolic character
 * These symbols are intentionally non-obvious to test AI reasoning
 */
function tileToSymbol(type: TileType, semantic = false): string {
  if (semantic) {
    return tileToSemanticSymbol(type)
  }
  switch (type) {
    case 'WALL':
      return '#'
    case 'EMPTY':
      return '.'
    case 'GOAL':
      return 'X'
    case 'KEY_RED':
      return 'a'
    case 'KEY_BLUE':
      return 'b'
    case 'KEY_GREEN':
      return 'c'
    case 'KEY_YELLOW':
      return 'd'
    case 'DOOR_RED':
      return '1'
    case 'DOOR_BLUE':
      return '2'
    case 'DOOR_GREEN':
      return '3'
    case 'DOOR_YELLOW':
      return '4'
    case 'BLOCK':
      return '*'
    case 'TRAP':
      return '^'
    case 'PORTAL_A':
      return '('
    case 'PORTAL_B':
      return ')'
    default:
      return '?'
  }
}

/**
 * Convert tile type to semantic symbol
 * Uses intuitive characters: uppercase = keys, lowercase = doors
 */
function tileToSemanticSymbol(type: TileType): string {
  switch (type) {
    case 'WALL':
      return '#'
    case 'EMPTY':
      return '.'
    case 'GOAL':
      return 'G'
    case 'KEY_RED':
      return 'R'
    case 'KEY_BLUE':
      return 'B'
    case 'KEY_GREEN':
      return 'N' // N for greeN (G is taken by Goal)
    case 'KEY_YELLOW':
      return 'Y'
    case 'DOOR_RED':
      return 'r'
    case 'DOOR_BLUE':
      return 'b'
    case 'DOOR_GREEN':
      return 'n' // n for greeN
    case 'DOOR_YELLOW':
      return 'y'
    case 'BLOCK':
      return 'O' // Looks like a box
    case 'TRAP':
      return '!'
    case 'PORTAL_A':
      return '['
    case 'PORTAL_B':
      return ']'
    default:
      return '?'
  }
}

/**
 * Convert game state to symbolic ASCII representation
 */
export function gameStateToAscii(state: GameState, semantic = false): string {
  const { grid, playerPosition, gridSize } = state
  const lines: string[] = []

  for (let y = 0; y < gridSize.height; y++) {
    let line = ''
    for (let x = 0; x < gridSize.width; x++) {
      if (playerPosition.x === x && playerPosition.y === y) {
        line += '@'
        continue
      }

      const tile = grid[y]?.[x]
      if (!tile) {
        line += '?'
        continue
      }

      line += tileToSymbol(tile.type, semantic)
    }
    lines.push(line)
  }

  return lines.join('\n')
}

// Keep this alias for backward compatibility
export const gameStateToObfuscatedAscii = gameStateToAscii

/**
 * Generate the few-shot gameplay examples section
 */
function generateExamples(semantic = false): string {
  const parts: string[] = []

  parts.push('Gameplay Examples')
  parts.push('')

  if (semantic) {
    // Semantic symbols: O=block, !=trap, R=red key, r=red door, B=blue key, b=blue door, []=portals, G=goal

    // Example 1: Pushing block onto trap
    parts.push('[EXAMPLE 1]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#.!O@.#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('LEFT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#..@..#')
    parts.push('')

    // Example 2: Collecting a key and opening a door (doors open automatically when you have the key)
    parts.push('[EXAMPLE 2]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#@R.r..G#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT RIGHT RIGHT RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#....@.G#')
    parts.push('')

    // Example 3: Collecting key then moving through door
    parts.push('[EXAMPLE 3]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('@.r..')
    parts.push('..#..')
    parts.push('.R#..')
    parts.push('')
    parts.push('Move Input:')
    parts.push('DOWN DOWN RIGHT UP UP RIGHT RIGHT RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('....@')
    parts.push('..#..')
    parts.push('..#..')
    parts.push('')

    // Example 4: Portal teleportation
    parts.push('[EXAMPLE 4]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#@[..!.].#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#.[..!.@.#')
    parts.push('')

    // Example 5: Key-door matching (doors open automatically when you move into them with key)
    parts.push('[EXAMPLE 5]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#@R.r.B.b.G#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT RIGHT RIGHT RIGHT RIGHT RIGHT RIGHT RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#........@G#')
    parts.push('')

    // Example 6: Trap = GAMEOVER
    parts.push('[EXAMPLE 6]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#@!...G#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT RIGHT RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#.@...G#')
    parts.push('GAMEOVER')
    parts.push('')

    // Example 7: Goal = GAME COMPLETE
    parts.push('[EXAMPLE 7]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#...@G#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#....@#')
    parts.push('GAME COMPLETE')
    parts.push('')
  } else {
    // Obfuscated symbols: *=block, ^=trap, a=red key, 1=red door, b=blue key, 2=blue door, ()=portals, X=goal

    // Example 1: Pushing block onto trap
    parts.push('[EXAMPLE 1]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#.^*@.#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('LEFT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#..@..#')
    parts.push('')

    // Example 2: Collecting a key and opening a door (doors open automatically when you have the key)
    parts.push('[EXAMPLE 2]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#@a.1..X#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT RIGHT RIGHT RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#....@.X#')
    parts.push('')

    // Example 3: Collecting key then moving through door
    parts.push('[EXAMPLE 3]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('@.1..')
    parts.push('..#..')
    parts.push('.a#..')
    parts.push('')
    parts.push('Move Input:')
    parts.push('DOWN DOWN RIGHT UP UP RIGHT RIGHT RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('....@')
    parts.push('..#..')
    parts.push('..#..')
    parts.push('')

    // Example 4: Portal teleportation
    parts.push('[EXAMPLE 4]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#@(..^.).#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#.(..^.@.#')
    parts.push('')

    // Example 5: Key-door matching (doors open automatically when you move into them with key)
    parts.push('[EXAMPLE 5]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#@a.1.b.2.X#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT RIGHT RIGHT RIGHT RIGHT RIGHT RIGHT RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#........@X#')
    parts.push('')

    // Example 6: Trap = GAMEOVER
    parts.push('[EXAMPLE 6]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#@^...X#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT RIGHT RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#.@...X#')
    parts.push('GAMEOVER')
    parts.push('')

    // Example 7: Goal = GAME COMPLETE
    parts.push('[EXAMPLE 7]:')
    parts.push('')
    parts.push('Initial Board State:')
    parts.push('#...@X#')
    parts.push('')
    parts.push('Move Input:')
    parts.push('RIGHT')
    parts.push('')
    parts.push('New Board State:')
    parts.push('#....@#')
    parts.push('GAME COMPLETE')
    parts.push('')
  }

  return parts.join('\n')
}

/**
 * Generate detailed instructions section
 */
function generateInstructions(semantic = false): string {
  const parts: string[] = []

  parts.push('# Dungeon Puzzle')
  parts.push('')
  parts.push(
    'You are solving a turn-based dungeon puzzle. Navigate the player to the goal while collecting keys, opening doors, and avoiding traps.',
  )
  parts.push('')

  // Rules
  parts.push('## Rules')
  parts.push('- You can move UP, DOWN, LEFT, or RIGHT')

  if (semantic) {
    parts.push('- **Keys** (R,B,N,Y): Walk onto a key tile to collect it (tile becomes empty)')
    parts.push(
      '- **Doors** (r,b,n,y): Moving into a door with the matching key opens it automatically. One key can open multiple doors of the same color.',
    )
    parts.push(
      '  - Red key (R) opens red door (r), Blue key (B) opens blue door (b), Green key (N) opens green door (n), Yellow key (Y) opens yellow door (y)',
    )
    parts.push('- **Blocks** (O): Can be pushed into empty spaces or onto traps')
    parts.push('- **Traps** (!): Deadly to player. Pushing a block onto a trap neutralizes both')
    parts.push('- **Portals** ([ and ]): Walking onto [ teleports you to ], and vice versa')
    parts.push('- **Goal** (G): Reach this to win')
  } else {
    parts.push('- **Keys** (a,b,c,d): Walk onto a key tile to collect it (tile becomes empty)')
    parts.push(
      '- **Doors** (1,2,3,4): Moving into a door with the matching key opens it automatically. One key can open multiple doors of the same type.',
    )
    parts.push('  - Key a opens door 1, key b opens door 2, key c opens door 3, key d opens door 4')
    parts.push('- **Blocks** (*): Can be pushed into empty spaces or onto traps')
    parts.push('- **Traps** (^): Deadly to player. Pushing a block onto a trap neutralizes both')
    parts.push('- **Portals** (( and )): Walking onto ( teleports you to ), and vice versa')
    parts.push('- **Goal** (X): Reach this to win')
  }
  parts.push('- Walls (#) are impassable')
  parts.push('')

  // Legend
  parts.push('## Legend')
  parts.push('- # = Wall')
  parts.push('- . = Empty floor')
  parts.push('- @ = Player')

  if (semantic) {
    parts.push('- G = Goal (reach this to win)')
    parts.push('- R = Red Key, B = Blue Key, N = Green Key, Y = Yellow Key')
    parts.push('- r = Red Door, b = Blue Door, n = Green Door, y = Yellow Door')
    parts.push('- O = Pushable block')
    parts.push('- ! = Trap (deadly)')
    parts.push('- [ and ] = Portals (teleport between them)')
  } else {
    parts.push('- X = Goal (reach this to win)')
    parts.push('- a, b, c, d = Keys')
    parts.push('- 1, 2, 3, 4 = Doors (key a opens 1, b opens 2, etc.)')
    parts.push('- * = Pushable block')
    parts.push('- ^ = Trap (deadly)')
    parts.push('- ( and ) = Portals (teleport between them)')
  }
  parts.push('')

  return parts.join('\n')
}

/**
 * Generate exploration mode instructions
 */
function generateExplorationInstructions(): string {
  const parts: string[] = []

  parts.push('You may explore the environment. Your reasoning will be included in follow-ups.')
  parts.push('')
  parts.push('IMPORTANT: You must use SUBMIT to finalize your solution.')
  parts.push('')
  parts.push('Ways to complete the puzzle:')
  parts.push('1. One-shot: Provide moves with SUBMIT at the end')
  parts.push(
    '2. Explore then restart: Use EXPLORE to test, then RESTART with full solution + SUBMIT',
  )
  parts.push(
    '3. Explore to goal: Use EXPLORE/CONTINUE until you reach X, then SUBMIT (no moves needed)',
  )
  parts.push('')
  parts.push('Response format (always JSON):')
  parts.push('{"reasoning":"<your reasoning>","moves":["MOVE1","MOVE2",...,"SUBMIT"]}')
  parts.push('{"reasoning":"<your reasoning>","moves":["<COMMAND>","MOVE1","MOVE2",...]}')
  parts.push('')
  parts.push('Commands (as first element of moves array):')
  parts.push('- EXPLORE: Execute moves, see result, continue exploring')
  parts.push('- CONTINUE: Continue from current position (after EXPLORE)')
  parts.push('- RESTART: Reset puzzle and execute moves')
  parts.push('- RESTART EXPLORE: Reset puzzle and continue exploring')
  parts.push('')
  parts.push('Finalizing (as last element of moves array):')
  parts.push('- SUBMIT: Finalize your solution (required to complete)')
  parts.push('  - After moves: ["RIGHT","DOWN","SUBMIT"] submits those moves as final')
  parts.push('  - After reaching goal via exploration: ["SUBMIT"] confirms completion')
  parts.push('')
  parts.push('Examples:')
  parts.push('{"reasoning":"I see the solution","moves":["RIGHT","DOWN","LEFT","SUBMIT"]}')
  parts.push(
    '{"reasoning":"testing if I can push the block","moves":["EXPLORE","RIGHT","RIGHT","DOWN"]}',
  )
  parts.push('{"reasoning":"continuing to the door","moves":["CONTINUE","UP","RIGHT"]}')
  parts.push(
    '{"reasoning":"found it - full solution","moves":["RESTART","RIGHT","DOWN","LEFT","SUBMIT"]}',
  )
  parts.push('{"reasoning":"I reached the goal, confirming","moves":["SUBMIT"]}')

  return parts.join('\n')
}

/**
 * Generate a prompt for an AI to solve a dungeon puzzle
 */
export function generateDungeonPrompt(state: GameState, options: PromptOptions): string {
  const parts: string[] = []
  const semantic = options.enableSemanticSymbols

  // Add instructions if enabled
  if (options.addInstructions) {
    parts.push(generateInstructions(semantic))
  }

  // Add examples if enabled
  if (options.addExamples) {
    parts.push(generateExamples(semantic))
  }

  // Minimal header (always shown)
  parts.push('@ = Player')
  parts.push('')

  // Current puzzle section
  parts.push('Current Puzzle')
  parts.push('')

  // Board state (always shown)
  parts.push('Board State:')
  parts.push('```')
  parts.push(gameStateToAscii(state, semantic))
  parts.push('```')
  parts.push('')

  // Status
  parts.push(`Moves made: ${state.turn}`)
  parts.push(`Player position: (${state.playerPosition.x},${state.playerPosition.y})`)
  if (state.inventory.keys.length > 0) {
    const keys = state.inventory.keys.map((k) => keyColorToSymbol(k, semantic))
    parts.push(`Inventory: ${keys.join(', ')}`)
  }
  parts.push('')

  // Output format instructions
  parts.push('Available Moves: UP, DOWN, LEFT, RIGHT')
  parts.push('')

  const goalSymbol = semantic ? 'G' : 'X'

  if (options.enableExploration) {
    parts.push(generateExplorationInstructions())
  } else if (options.executionMode === 'fullSolution') {
    parts.push(`Provide a solution sequence to reach ${goalSymbol}.`)
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push('{"reasoning":"<your reasoning>","moves":["UP","RIGHT","DOWN","LEFT"]}')
  } else {
    parts.push('Provide the next move.')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push('{"reasoning":"<your reasoning>","move":"UP"}')
  }

  return parts.join('\n')
}

/** Convert key color to symbolic character */
function keyColorToSymbol(color: string, semantic = false): string {
  if (semantic) {
    switch (color) {
      case 'RED':
        return 'R'
      case 'BLUE':
        return 'B'
      case 'GREEN':
        return 'N'
      case 'YELLOW':
        return 'Y'
      default:
        return color
    }
  }
  switch (color) {
    case 'RED':
      return 'a'
    case 'BLUE':
      return 'b'
    case 'GREEN':
      return 'c'
    case 'YELLOW':
      return 'd'
    default:
      return color
  }
}

/** Record of a single exploration attempt */
export interface ExplorationAttempt {
  moves: string[]
  result: 'continue' | 'gameover' | 'success'
  wasRestart: boolean
  reasoning?: string
  /** Board state after this attempt (ASCII representation) */
  boardStateAfter: string
  /** Player position after this attempt */
  playerPositionAfter: { x: number; y: number }
  /** Inventory after this attempt */
  inventoryAfter: string[]
  /** Total moves made after this attempt */
  movesMadeAfter: number
  /** The command used for this attempt */
  command?: 'EXPLORE' | 'CONTINUE' | 'RESTART' | 'RESTART_EXPLORE'
}

/** Command usage counts for exploration */
export interface CommandCounts {
  explore: number
  continue: number
  restart: number
  submit: number
}

/**
 * Generate a continuation prompt for exploration mode
 * This is sent after the AI has explored and we want to show them the result
 * Includes full context: original prompt, AI reasoning, moves, and new state
 *
 * History truncation rules:
 * - Most recent 5 attempts (indices len-5 to len-1): full context
 * - Attempts 5-10 back (indices len-10 to len-6): moves and board only
 * - Attempts 10+ back: omitted entirely
 */
export function generateExplorationContinuationPrompt(
  state: GameState,
  options: PromptOptions,
  previousMoves: string[],
  wasRestart: boolean,
  originalPrompt: string,
  aiReasoning?: string,
  explorationHistory?: ExplorationAttempt[],
  commandCounts?: CommandCounts,
): string {
  const parts: string[] = []
  const semantic = options.enableSemanticSymbols

  // Include full original prompt for context
  parts.push('=== ORIGINAL PUZZLE ===')
  parts.push(originalPrompt)
  parts.push('')

  // Show command usage stats if available
  if (commandCounts) {
    const totalCommands =
      commandCounts.explore + commandCounts.continue + commandCounts.restart + commandCounts.submit
    parts.push('=== COMMAND HISTORY ===')
    parts.push(`Total commands used: ${totalCommands}`)
    parts.push(`- EXPLORE: ${commandCounts.explore}`)
    parts.push(`- CONTINUE: ${commandCounts.continue}`)
    parts.push(`- RESTART: ${commandCounts.restart}`)
    parts.push(`- SUBMIT: ${commandCounts.submit}`)
    parts.push('')
  }

  // Include exploration history if there were previous attempts
  // Truncation: 0-5 most recent = full, 5-10 = moves+board only, 10+ = omitted
  if (explorationHistory && explorationHistory.length > 0) {
    const totalAttempts = explorationHistory.length
    const omittedCount = Math.max(0, totalAttempts - 10)
    const summaryStartIndex = Math.max(0, totalAttempts - 10)
    const fullStartIndex = Math.max(0, totalAttempts - 5)

    parts.push('=== EXPLORATION HISTORY ===')

    if (omittedCount > 0) {
      parts.push(`(${omittedCount} older attempts omitted for context length)`)
      parts.push('')
    }

    for (let i = summaryStartIndex; i < explorationHistory.length; i++) {
      const attempt = explorationHistory[i]
      const attemptNum = i + 1
      const isFullContext = i >= fullStartIndex

      parts.push(`[Attempt ${attemptNum}]${isFullContext ? '' : ' (summary)'}`)
      if (attempt.wasRestart) {
        parts.push('(Restarted from beginning)')
      }
      parts.push(`Moves: ${attempt.moves.join(' ')}`)
      parts.push(
        `Result: ${attempt.result === 'gameover' ? 'GAMEOVER' : attempt.result === 'success' ? 'GAME COMPLETE' : 'continued'}`,
      )

      if (isFullContext) {
        // Full context for most recent 5 attempts
        parts.push(`Moves made: ${attempt.movesMadeAfter}`)
        parts.push(
          `Player position: (${attempt.playerPositionAfter.x},${attempt.playerPositionAfter.y})`,
        )
        if (attempt.inventoryAfter.length > 0) {
          const keys = attempt.inventoryAfter.map((k) => keyColorToSymbol(k, semantic))
          parts.push(`Inventory: ${keys.join(', ')}`)
        }
        parts.push('Board state after:')
        parts.push('```')
        parts.push(attempt.boardStateAfter)
        parts.push('```')
        if (attempt.reasoning) {
          parts.push(`Reasoning: ${attempt.reasoning}`)
        }
      } else {
        // Summary only for attempts 5-10 back (moves + board, no reasoning)
        parts.push('Board state after:')
        parts.push('```')
        parts.push(attempt.boardStateAfter)
        parts.push('```')
      }
      parts.push('')
    }
  }

  // Include AI's previous reasoning so it can continue its thought process
  parts.push('=== YOUR PREVIOUS REASONING ===')
  if (aiReasoning) {
    parts.push(aiReasoning)
  } else {
    parts.push('(No reasoning provided)')
  }
  parts.push('')

  // Show what moves were executed
  parts.push('=== EXPLORATION RESULT ===')
  if (wasRestart) {
    parts.push('Game restarted from beginning.')
  }
  parts.push(`Executed moves: ${previousMoves.join(' ')}`)
  parts.push('')

  if (state.done) {
    if (state.success) {
      parts.push('Result: GAME COMPLETE')
    } else {
      parts.push('Result: GAMEOVER')
    }
    parts.push('')
  }

  parts.push('Current Board State:')
  parts.push('```')
  parts.push(gameStateToAscii(state, semantic))
  parts.push('```')
  parts.push('')

  parts.push(`Moves made: ${state.turn}`)
  parts.push(`Player position: (${state.playerPosition.x},${state.playerPosition.y})`)
  if (state.inventory.keys.length > 0) {
    const keys = state.inventory.keys.map((k) => keyColorToSymbol(k, semantic))
    parts.push(`Inventory: ${keys.join(', ')}`)
  }
  parts.push('')

  // Continue instructions
  parts.push('=== CONTINUE ===')
  if (state.done) {
    if (state.success) {
      parts.push('You reached the goal! Use SUBMIT to finalize your solution.')
      parts.push('If you want to try a different solution, use RESTART.')
      parts.push('')
      parts.push('Response format: {"reasoning":"...","moves":["SUBMIT"]}')
    } else {
      parts.push('You died. Use RESTART or RESTART EXPLORE to try again.')
      parts.push('')
      parts.push('Response format: {"reasoning":"...","moves":["RESTART","MOVE1",...,"SUBMIT"]}')
    }
  } else {
    parts.push('Options:')
    parts.push('- CONTINUE: Keep going from here')
    parts.push('- EXPLORE: Try more moves, see result')
    parts.push('- RESTART: Reset puzzle')
    parts.push('- SUBMIT: Finalize solution (use as last move when ready)')
    parts.push('')
    parts.push('Response format: {"reasoning":"...","moves":["COMMAND","MOVE1","MOVE2",...]}')
    parts.push('To submit: {"reasoning":"...","moves":["MOVE1","MOVE2",...,"SUBMIT"]}')
  }

  return parts.join('\n')
}

// Legacy exports for compatibility
export const generateFewShotPrompt = generateDungeonPrompt
export const generateSokobanPrompt = generateDungeonPrompt
