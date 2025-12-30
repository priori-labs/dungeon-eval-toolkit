/**
 * Prompt generation for AI to solve dungeon puzzles
 */

import type { GameState, PromptOptions, TileType } from '@src/types'

/**
 * Convert game state to ASCII representation
 */
export function gameStateToAscii(state: GameState): string {
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

      line += tileToChar(tile.type)
    }
    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * Convert tile type to ASCII character
 */
function tileToChar(type: TileType): string {
  switch (type) {
    case 'WALL':
      return '#'
    case 'EMPTY':
      return '.'
    case 'GOAL':
      return 'G'
    case 'KEY_RED':
      return 'r'
    case 'KEY_BLUE':
      return 'b'
    case 'KEY_GREEN':
      return 'g'
    case 'KEY_YELLOW':
      return 'y'
    case 'DOOR_RED':
      return 'D'
    case 'DOOR_BLUE':
      return 'E'
    case 'DOOR_GREEN':
      return 'F'
    case 'DOOR_YELLOW':
      return 'H'
    case 'BLOCK':
      return 'O'
    case 'TRAP':
      return 'T'
    case 'PORTAL_A':
      return 'A'
    case 'PORTAL_B':
      return 'Z'
    default:
      return '?'
  }
}

/**
 * Generate coordinate locations format representation
 */
function generateCoordinateLocationsFormat(state: GameState): string {
  const { grid, gridSize, playerPosition } = state
  const parts: string[] = []

  parts.push(`Board Size: ${gridSize.width}x${gridSize.height}`)
  parts.push(`Player Location: (${playerPosition.x},${playerPosition.y})`)

  // Collect positions by type
  const positions: Record<string, string[]> = {
    walls: [],
    goals: [],
    keys: [],
    doors: [],
    blocks: [],
    traps: [],
    portals: [],
  }

  for (let y = 0; y < gridSize.height; y++) {
    for (let x = 0; x < gridSize.width; x++) {
      const tile = grid[y]?.[x]
      if (!tile) continue

      const pos = `(${x},${y})`
      switch (tile.type) {
        case 'WALL':
          positions.walls.push(pos)
          break
        case 'GOAL':
          positions.goals.push(pos)
          break
        case 'KEY_RED':
        case 'KEY_BLUE':
        case 'KEY_GREEN':
        case 'KEY_YELLOW':
          positions.keys.push(`${pos}:${tile.type.replace('KEY_', '').toLowerCase()}`)
          break
        case 'DOOR_RED':
        case 'DOOR_BLUE':
        case 'DOOR_GREEN':
        case 'DOOR_YELLOW':
          positions.doors.push(
            `${pos}:${tile.type.replace('DOOR_', '').toLowerCase()}${tile.isOpen ? '(open)' : '(closed)'}`,
          )
          break
        case 'BLOCK':
          positions.blocks.push(pos)
          break
        case 'TRAP':
          positions.traps.push(pos)
          break
        case 'PORTAL_A':
        case 'PORTAL_B':
          positions.portals.push(`${pos}:${tile.type.replace('PORTAL_', '')}`)
          break
      }
    }
  }

  if (positions.goals.length > 0) parts.push(`Goal Locations: ${positions.goals.join(', ')}`)
  if (positions.keys.length > 0) parts.push(`Key Locations: ${positions.keys.join(', ')}`)
  if (positions.doors.length > 0) parts.push(`Door Locations: ${positions.doors.join(', ')}`)
  if (positions.blocks.length > 0) parts.push(`Block Locations: ${positions.blocks.join(', ')}`)
  if (positions.traps.length > 0) parts.push(`Trap Locations: ${positions.traps.join(', ')}`)
  if (positions.portals.length > 0) parts.push(`Portal Locations: ${positions.portals.join(', ')}`)

  return parts.join('\n')
}

/**
 * Generate a prompt for an AI to solve a dungeon puzzle
 */
export function generateDungeonPrompt(state: GameState, options: PromptOptions): string {
  const parts: string[] = []

  // Header
  parts.push('# Dungeon Puzzle')
  parts.push('')
  parts.push(
    'You are solving a turn-based dungeon puzzle. Navigate the player to the goal while collecting keys, opening doors, and avoiding traps.',
  )
  parts.push('')

  // Rules
  parts.push('## Rules')
  parts.push('- You can move UP, DOWN, LEFT, or RIGHT')
  parts.push('- Use INTERACT to open adjacent doors (requires matching key color)')
  parts.push('- **Keys**: Walk onto a key tile to collect it (tile becomes empty)')
  parts.push(
    '- **Doors**: Block movement when closed. Use INTERACT while adjacent with matching key',
  )
  parts.push('- **Blocks**: Can be pushed into empty spaces or onto traps')
  parts.push('- **Traps**: Deadly to player. Pushing a block onto a trap neutralizes both')
  parts.push('- **Portals**: Walking onto Portal A teleports you to Portal B, and vice versa')
  parts.push('- Walls (#) are impassable')
  parts.push('')

  // Example sequence
  parts.push('## Example: Collecting a Key and Opening a Door')
  parts.push('')
  parts.push('Initial state: `#@r.D.G#`')
  parts.push('(Wall, Player, red key, empty, red Door closed, empty, Goal, Wall)')
  parts.push('')
  parts.push('Solution sequence:')
  parts.push('1. RIGHT - Player moves onto key, collects it: `#.@.D.G#` (inventory: RED)')
  parts.push('2. RIGHT - Player moves to empty space: `#..@D.G#`')
  parts.push(
    '3. INTERACT - Player opens adjacent door using RED key: `#..@..G#` (door becomes empty)',
  )
  parts.push('4. RIGHT - Player moves where door was: `#...@.G#`')
  parts.push('5. RIGHT - Player moves to empty space: `#....@G#`')
  parts.push('6. RIGHT - Player reaches goal: `#.....@#` (WIN!)')
  parts.push('')

  // Trap example
  parts.push('## Example: Neutralizing a Trap')
  parts.push('')
  parts.push('Initial state: `#.TO@.#`')
  parts.push('(Wall, empty, Trap, Block, Player, empty, Wall)')
  parts.push('')
  parts.push('Solution sequence:')
  parts.push('1. LEFT - Player pushes block onto trap, both disappear: `#..@..#`')
  parts.push('')
  parts.push(
    'The block neutralizes the trap, clearing the path. Without the block, stepping on T would kill the player!',
  )
  parts.push('')

  // Current state representation
  if (options.asciiGrid) {
    parts.push('## Current State (ASCII Grid)')
    parts.push('```')
    parts.push(gameStateToAscii(state))
    parts.push('```')
    parts.push('')
    parts.push('Legend:')
    parts.push('- # = Wall')
    parts.push('- . = Empty floor')
    parts.push('- @ = Player')
    parts.push('- G = Goal (reach this to win)')
    parts.push('- r, b, g, y = Keys (red, blue, green, yellow)')
    parts.push('- D, E, F, H = Doors (red, blue, green, yellow) - become empty when opened')
    parts.push('- O = Pushable block')
    parts.push('- T = Trap (deadly)')
    parts.push('- A, Z = Portals (A teleports to Z)')
    parts.push('')
  }

  // Coordinate locations format
  if (options.coordinateLocations) {
    parts.push('## Positions')
    parts.push(generateCoordinateLocationsFormat(state))
    parts.push('')
  }

  // Current inventory
  parts.push('## Current Status')
  parts.push(`- Moves made: ${state.turn}`)
  parts.push(
    `- Keys in inventory: ${state.inventory.keys.length > 0 ? state.inventory.keys.join(', ') : 'none'}`,
  )
  parts.push(`- Player position: (${state.playerPosition.x},${state.playerPosition.y})`)
  parts.push('')

  // Important note about code
  parts.push(
    'IMPORTANT: Please do not write any code to solve the puzzle. This is a test of your visual/intuitive reasoning and spatial planning skills.',
  )
  parts.push('')

  // Output format
  parts.push('## Your Task')

  if (options.executionMode === 'fullSolution') {
    parts.push('Provide a complete solution to reach the goal.')
    parts.push('')
    parts.push('In your reasoning, explain your solution strategy step-by-step:')
    parts.push('1. Identify what keys are needed and where they are')
    parts.push('2. Plan the order of collecting keys and opening doors')
    parts.push('3. Identify any traps that need to be neutralized with blocks')
    parts.push('4. Describe the path to the goal')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push(
      '{"reasoning":"<detailed step-by-step strategy explanation>","moves":["UP","RIGHT","INTERACT","DOWN","LEFT"]}',
    )
    parts.push('')
    parts.push('Valid moves: UP, DOWN, LEFT, RIGHT, INTERACT')
  } else {
    parts.push('Provide the next single move.')
    parts.push('')
    parts.push('In your reasoning, briefly explain:')
    parts.push('- What is the immediate goal of this move?')
    parts.push('- How does it contribute to the overall solution?')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push('{"reasoning":"<brief reasoning for this move>","move":"UP"}')
    parts.push('')
    parts.push('Valid moves: UP, DOWN, LEFT, RIGHT, INTERACT')
  }

  return parts.join('\n')
}

/**
 * Generate a minimal prompt (just the grid and basic instructions)
 */
export function generateMinimalPrompt(state: GameState): string {
  const parts: string[] = []

  parts.push(
    'Solve this dungeon puzzle. Reach the goal (G) while collecting keys and opening doors.',
  )
  parts.push('')
  parts.push('```')
  parts.push(gameStateToAscii(state))
  parts.push('```')
  parts.push('')
  if (state.inventory.keys.length > 0) {
    parts.push(`Keys: ${state.inventory.keys.join(', ')}`)
    parts.push('')
  }
  parts.push('Reply with moves as a JSON array: ["UP", "DOWN", "LEFT", "RIGHT", "INTERACT", ...]')

  return parts.join('\n')
}

/**
 * Generate a move-by-move prompt for iterative solving
 */
export function generateMoveByMovePrompt(state: GameState, moveHistory: string[]): string {
  const parts: string[] = []

  parts.push('Dungeon puzzle - provide the NEXT SINGLE MOVE.')
  parts.push('')
  parts.push('Current state:')
  parts.push('```')
  parts.push(gameStateToAscii(state))
  parts.push('```')
  parts.push('')

  if (moveHistory.length > 0) {
    parts.push(`Previous moves: ${moveHistory.join(', ')}`)
    parts.push('')
  }

  if (state.inventory.keys.length > 0) {
    parts.push(`Keys: ${state.inventory.keys.join(', ')}`)
    parts.push('')
  }
  parts.push('Reply with ONE move: UP, DOWN, LEFT, RIGHT, or INTERACT')

  return parts.join('\n')
}

/**
 * Default prompt options
 */
export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  asciiGrid: true,
  coordinateFormat: true,
  includeNotationGuide: true,
  executionMode: 'fullSolution',
  cipherSymbols: false,
  coordinateLocations: false,
  fewShotExamples: false,
  enableExploration: false,
}

/**
 * Convert tile type to obfuscated/cipher character for few-shot learning mode
 * These symbols are intentionally non-obvious to test if AI can learn from examples
 */
function tileToObfuscatedChar(type: TileType): string {
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
 * Convert game state to obfuscated ASCII representation for few-shot learning mode
 */
export function gameStateToObfuscatedAscii(state: GameState): string {
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

      line += tileToObfuscatedChar(tile.type)
    }
    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * Generate a few-shot learning prompt that teaches game rules through examples
 * instead of explicit natural language instructions
 */
export function generateFewShotPrompt(state: GameState, options: PromptOptions): string {
  const parts: string[] = []

  // Minimal header - only label the player symbol
  parts.push('@ = Player')
  parts.push('')
  parts.push('Gameplay Examples')
  parts.push('')

  // Example 1: Pushing block onto trap, then walking through where they were
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

  // Example 2: Collecting a key and opening a door (full sequence)
  parts.push('[EXAMPLE 2]:')
  parts.push('')
  parts.push('Initial Board State:')
  parts.push('#@a.1..X#')
  parts.push('')
  parts.push('Move Input:')
  parts.push('RIGHT RIGHT INTERACT RIGHT')
  parts.push('')
  parts.push('New Board State:')
  parts.push('#...@..X#')
  parts.push('')

  // Example 3: Complex navigation - get key, open door, push block through (3 rows)
  parts.push('[EXAMPLE 3]:')
  parts.push('')
  parts.push('Initial Board State:')
  parts.push('@.1..')
  parts.push('.*#..')
  parts.push('.a#..')
  parts.push('')
  parts.push('Move Input:')
  parts.push(
    'DOWN DOWN RIGHT LEFT UP UP RIGHT INTERACT LEFT DOWN DOWN RIGHT UP LEFT UP RIGHT RIGHT RIGHT',
  )
  parts.push('')
  parts.push('New Board State:')
  parts.push('...@*')
  parts.push('..#..')
  parts.push('..#..')
  parts.push('')

  // Example 4: Portal teleportation (with trap between portals - teleport skips over it)
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

  // Example 5: Differentiating keys and doors - key "a" opens door "1", key "b" opens door "2"
  parts.push('[EXAMPLE 5]:')
  parts.push('')
  parts.push('Initial Board State:')
  parts.push('#@a.1.b.2.X#')
  parts.push('')
  parts.push('Move Input:')
  parts.push('RIGHT RIGHT INTERACT RIGHT RIGHT RIGHT RIGHT INTERACT')
  parts.push('')
  parts.push('New Board State:')
  parts.push('#......@..X#')
  parts.push('')

  // Example 6: Walking onto a trap = GAMEOVER (remaining moves don't execute)
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

  // Example 7: Reaching the goal = GAME COMPLETE
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

  // Current puzzle section
  parts.push('Current Puzzle')
  parts.push('')

  // Current state representation using obfuscated symbols
  if (options.asciiGrid) {
    parts.push('Board State:')
    parts.push('```')
    parts.push(gameStateToObfuscatedAscii(state))
    parts.push('```')
    parts.push('')
  }

  // Coordinate locations format (if enabled, but using obfuscated terms)
  if (options.coordinateLocations) {
    parts.push('Positions:')
    parts.push(generateObfuscatedCoordinateLocations(state))
    parts.push('')
  }

  // Minimal status
  parts.push(`Moves made: ${state.turn}`)
  parts.push(`Player position: (${state.playerPosition.x},${state.playerPosition.y})`)
  parts.push('')

  // Output format - minimal instructions
  // Add exploration mode instructions if enabled
  if (options.enableExploration) {
    parts.push('Available Moves: UP, DOWN, LEFT, RIGHT, INTERACT')
    parts.push('')
    parts.push('You may explore the environment. Your reasoning will be included in follow-ups.')
    parts.push('')
    parts.push('Ways to complete the puzzle:')
    parts.push('1. One-shot: Provide moves without a command to solve immediately')
    parts.push('2. Explore then restart: Use EXPLORE to test, then RESTART with full solution')
    parts.push(
      '3. Explore and continue: Use EXPLORE/CONTINUE until you reach the goal (no restart needed)',
    )
    parts.push('')
    parts.push('Response format (always JSON):')
    parts.push('{"reasoning":"<your reasoning>","moves":["MOVE1","MOVE2",...]}')
    parts.push('{"reasoning":"<your reasoning>","moves":["<COMMAND>","MOVE1","MOVE2",...]}')
    parts.push('')
    parts.push('Commands (optional, as first element of moves array):')
    parts.push('- (none): Execute moves as final solution')
    parts.push('- EXPLORE: Execute moves, see result, continue exploring')
    parts.push('- CONTINUE: Continue from current position (after EXPLORE)')
    parts.push('- RESTART: Reset puzzle and execute moves as final solution')
    parts.push('- RESTART EXPLORE: Reset puzzle and continue exploring')
    parts.push('')
    parts.push('Examples:')
    parts.push('{"reasoning":"I see the solution","moves":["RIGHT","DOWN","INTERACT","LEFT"]}')
    parts.push(
      '{"reasoning":"testing if I can push the block","moves":["EXPLORE","RIGHT","RIGHT","DOWN"]}',
    )
    parts.push('{"reasoning":"continuing to check the door","moves":["CONTINUE","UP","INTERACT"]}')
    parts.push(
      '{"reasoning":"found it - final solution","moves":["RESTART","RIGHT","DOWN","INTERACT","LEFT"]}',
    )
  } else if (options.executionMode === 'fullSolution') {
    parts.push('Available Moves: UP, DOWN, LEFT, RIGHT, INTERACT')
    parts.push('')
    parts.push('Provide a solution sequence to complete the puzzle.')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push('{"reasoning":"<your reasoning>","moves":["UP","RIGHT","INTERACT","DOWN","LEFT"]}')
  } else {
    parts.push('Provide the next move.')
    parts.push('')
    parts.push('Return ONLY a JSON object in this exact format (no other text):')
    parts.push('{"reasoning":"<your reasoning>","move":"UP"}')
  }

  return parts.join('\n')
}

/**
 * Generate obfuscated coordinate locations format
 */
function generateObfuscatedCoordinateLocations(state: GameState): string {
  const { grid, gridSize, playerPosition } = state
  const parts: string[] = []

  parts.push(`Board Size: ${gridSize.width}x${gridSize.height}`)
  parts.push(`Player: (${playerPosition.x},${playerPosition.y})`)

  // Collect positions by obfuscated symbols
  const positions: Record<string, string[]> = {}

  for (let y = 0; y < gridSize.height; y++) {
    for (let x = 0; x < gridSize.width; x++) {
      const tile = grid[y]?.[x]
      if (!tile || tile.type === 'EMPTY' || tile.type === 'WALL') continue

      const pos = `(${x},${y})`
      const symbol = tileToObfuscatedChar(tile.type)

      if (!positions[symbol]) {
        positions[symbol] = []
      }
      positions[symbol].push(pos)
    }
  }

  // Output each symbol's positions
  for (const [symbol, posList] of Object.entries(positions)) {
    parts.push(`${symbol}: ${posList.join(', ')}`)
  }

  return parts.join('\n')
}

/** Convert key color to obfuscated symbol */
function keyColorToObfuscatedSymbol(color: string): string {
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
}

/**
 * Generate a continuation prompt for exploration mode
 * This is sent after the AI has explored and we want to show them the result
 * Includes full context: original prompt, AI reasoning, moves, and new state
 */
export function generateExplorationContinuationPrompt(
  state: GameState,
  options: PromptOptions,
  previousMoves: string[],
  wasRestart: boolean,
  originalPrompt: string,
  aiReasoning?: string,
  explorationHistory?: ExplorationAttempt[],
): string {
  const parts: string[] = []

  // Include full original prompt for context
  parts.push('=== ORIGINAL PUZZLE ===')
  parts.push(originalPrompt)
  parts.push('')

  // Include exploration history if there were previous attempts
  if (explorationHistory && explorationHistory.length > 0) {
    parts.push('=== EXPLORATION HISTORY ===')
    for (let i = 0; i < explorationHistory.length; i++) {
      const attempt = explorationHistory[i]
      parts.push(`[Attempt ${i + 1}]`)
      if (attempt.wasRestart) {
        parts.push('(Restarted from beginning)')
      }
      parts.push(`Moves: ${attempt.moves.join(' ')}`)
      parts.push(
        `Result: ${attempt.result === 'gameover' ? 'GAMEOVER' : attempt.result === 'success' ? 'GAME COMPLETE' : 'continued'}`,
      )
      parts.push(`Moves made: ${attempt.movesMadeAfter}`)
      parts.push(
        `Player position: (${attempt.playerPositionAfter.x},${attempt.playerPositionAfter.y})`,
      )
      if (attempt.inventoryAfter.length > 0) {
        // Use obfuscated symbols in few-shot mode
        const keys = options.fewShotExamples
          ? attempt.inventoryAfter.map(keyColorToObfuscatedSymbol)
          : attempt.inventoryAfter
        parts.push(`Inventory: ${keys.join(', ')}`)
      }
      parts.push('Board state after:')
      parts.push('```')
      parts.push(attempt.boardStateAfter)
      parts.push('```')
      if (attempt.reasoning) {
        parts.push(`Reasoning: ${attempt.reasoning}`)
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
  if (options.fewShotExamples) {
    parts.push(gameStateToObfuscatedAscii(state))
  } else {
    parts.push(gameStateToAscii(state))
  }
  parts.push('```')
  parts.push('')

  parts.push(`Moves made: ${state.turn}`)
  parts.push(`Player position: (${state.playerPosition.x},${state.playerPosition.y})`)
  if (state.inventory.keys.length > 0) {
    // Use obfuscated symbols in few-shot mode
    const keys = options.fewShotExamples
      ? state.inventory.keys.map(keyColorToObfuscatedSymbol)
      : state.inventory.keys
    parts.push(`Inventory: ${keys.join(', ')}`)
  }
  parts.push('')

  // Continue instructions
  parts.push('=== CONTINUE ===')
  if (state.done) {
    if (state.success) {
      parts.push('You solved the puzzle!')
      parts.push('If you want to try a different solution, use RESTART.')
    } else {
      parts.push('You died. Use RESTART or RESTART EXPLORE to try again.')
    }
  } else {
    parts.push('Options:')
    parts.push('- CONTINUE: Keep going from here (reach goal to complete)')
    parts.push('- EXPLORE: Try more moves, see result')
    parts.push('- RESTART: Reset and submit final solution')
    parts.push('')
    parts.push('Response format: {"reasoning":"...","moves":["COMMAND","MOVE1","MOVE2",...]}')
  }

  return parts.join('\n')
}

// Legacy export for compatibility
export const generateSokobanPrompt = generateDungeonPrompt
