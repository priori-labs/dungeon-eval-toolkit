/**
 * Core game engine logic for dungeon crawler puzzles
 * Pure functions for game state management
 */

import type {
  Action,
  ActionResult,
  DungeonLevel,
  GameState,
  Grid,
  Inventory,
  KeyColor,
  MoveRecord,
  Position,
  Tile,
} from '@src/types'
import { TileType } from '@src/types'
import { v4 as uuidv4 } from 'uuid'

const VALID_TILE_TYPES = new Set(Object.values(TileType))

/**
 * Direction vectors for movement
 */
const DIRECTION_DELTAS: Record<string, Position> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
}

/**
 * Create initial game state from a level definition
 */
export function createGame(level: DungeonLevel): GameState {
  // Deep clone the layout to create the grid
  const grid: Grid = level.layout.map((row) =>
    row.map((rawTileType) => {
      const normalized = normalizeTileType(rawTileType)
      const tile: Tile = { type: normalized.type }

      if (normalized.isFixed) {
        tile.isFixed = true
      }

      // Initialize doors as closed
      if (tile.type.startsWith('DOOR_')) {
        tile.isOpen = false
      }

      return tile
    }),
  )

  return {
    level,
    turn: 0,
    maxTurns: Math.max(level.maxTurns, 200),
    gridSize: level.gridSize,
    grid,
    playerPosition: { ...level.playerStart },
    inventory: { keys: [] },
    objective: level.objective,
    done: false,
    success: false,
    moveHistory: [],
    startTime: null,
    endTime: null,
  }
}

/**
 * Execute an action and return the new game state
 */
export function executeAction(
  state: GameState,
  action: Action,
  source: 'human' | 'ai' = 'human',
): ActionResult {
  // Cannot act if game is already done
  if (state.done) {
    return {
      success: false,
      newState: state,
      message: 'Game is already finished',
    }
  }

  // Deep clone state for immutability
  const newState: GameState = JSON.parse(JSON.stringify(state))
  newState.turn += 1
  newState.startTime = newState.startTime ?? Date.now()

  // Store previous state for undo
  const previousPlayerPos = { ...state.playerPosition }
  const previousGrid: Grid = JSON.parse(JSON.stringify(state.grid))
  const previousInventory: Inventory = JSON.parse(JSON.stringify(state.inventory))

  let message = ''
  let actionSuccess = false
  let collectedKey: KeyColor | undefined
  let openedDoor: Position | undefined
  let pushedBlock: { from: Position; to: Position } | undefined
  let neutralizedTrap: Position | undefined
  let teleported = false

  // Handle movement actions
  if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') {
    const delta = DIRECTION_DELTAS[action]
    const moveResult = tryMove(newState, delta)
    actionSuccess = moveResult.success
    message = moveResult.message
    collectedKey = moveResult.collectedKey
    pushedBlock = moveResult.pushedBlock
    neutralizedTrap = moveResult.neutralizedTrap
    teleported = moveResult.teleported || false
  } else if (action === 'INTERACT') {
    const interactResult = tryInteract(newState)
    actionSuccess = interactResult.success
    message = interactResult.message
    openedDoor = interactResult.openedDoor
  }

  // Check if player reached the goal
  const currentTile = getTileAt(newState.grid, newState.playerPosition)
  if (currentTile.type === TileType.GOAL) {
    newState.done = true
    newState.success = true
    newState.endTime = Date.now()
    message = 'You reached the goal! Puzzle complete!'
  }

  // Check if player stepped on a trap
  if (currentTile.type === TileType.TRAP) {
    newState.done = true
    newState.success = false
    newState.endTime = Date.now()
    message = 'You stepped on a trap! Game over.'
  }

  newState.message = message

  // Create move record for undo
  if (actionSuccess) {
    const moveRecord: MoveRecord = {
      id: uuidv4(),
      action,
      previousPlayerPos,
      previousGrid,
      previousInventory,
      collectedKey,
      openedDoor,
      pushedBlock,
      neutralizedTrap,
      teleported,
      source,
      timestamp: Date.now(),
    }
    newState.moveHistory = [...newState.moveHistory, moveRecord]
  }

  return {
    success: actionSuccess,
    newState,
    message,
  }
}

interface MoveResult {
  success: boolean
  message: string
  collectedKey?: KeyColor
  pushedBlock?: { from: Position; to: Position }
  neutralizedTrap?: Position
  teleported?: boolean
}

/**
 * Attempt to move the player in a direction
 */
function tryMove(state: GameState, delta: Position): MoveResult {
  const newPos: Position = {
    x: state.playerPosition.x + delta.x,
    y: state.playerPosition.y + delta.y,
  }

  const dirName = getDirName(delta)

  // Check bounds - treat as no-op (player stays in place)
  if (!isInBounds(state, newPos)) {
    return { success: true, message: `Moved ${dirName} (no-op: out of bounds)` }
  }

  const targetTile = getTileAt(state.grid, newPos)
  let pushedBlock: { from: Position; to: Position } | undefined
  let neutralizedTrap: Position | undefined

  // Handle block pushing first (before checking passability)
  if (targetTile.type === TileType.BLOCK && !targetTile.isFixed) {
    const pushResult = tryPushBlock(state, newPos, delta)
    if (!pushResult.success) {
      // Can't push block - treat as no-op
      return { success: true, message: `Moved ${dirName} (no-op: ${pushResult.message})` }
    }
    pushedBlock = pushResult.pushedBlock
    neutralizedTrap = pushResult.neutralizedTrap
  }

  // Check if tile is passable (after handling block pushing)
  const finalTile = getTileAt(state.grid, newPos)
  if (!isPassable(finalTile)) {
    // Wall or closed door - treat as no-op (player stays in place)
    return { success: true, message: `Moved ${dirName} (no-op: blocked)` }
  }

  // Move player
  state.playerPosition = newPos

  // Handle tile effects after moving
  let collectedKey: KeyColor | undefined
  if (finalTile.type.startsWith('KEY_')) {
    collectedKey = finalTile.type.split('_')[1] as KeyColor
    if (!state.inventory.keys.includes(collectedKey)) {
      state.inventory.keys.push(collectedKey)
      // Remove key from grid
      state.grid[newPos.y][newPos.x] = { type: TileType.EMPTY }
    }
  }

  // Handle portal teleportation
  let teleported = false
  if (finalTile.type === TileType.PORTAL_A || finalTile.type === TileType.PORTAL_B) {
    const portalDest = findOtherPortal(state, finalTile.type)
    if (portalDest) {
      state.playerPosition = portalDest
      teleported = true
    }
  }

  let message = `Moved ${dirName}`
  if (collectedKey) {
    message = `Collected ${collectedKey.toLowerCase()} key`
  }
  if (teleported) {
    message = 'Teleported through portal!'
  }

  return {
    success: true,
    message,
    collectedKey,
    pushedBlock,
    neutralizedTrap,
    teleported,
  }
}

interface PushResult {
  success: boolean
  message: string
  pushedBlock?: { from: Position; to: Position }
  neutralizedTrap?: Position
}

/**
 * Try to push a block in a direction
 */
function tryPushBlock(state: GameState, blockPos: Position, delta: Position): PushResult {
  const newBlockPos: Position = {
    x: blockPos.x + delta.x,
    y: blockPos.y + delta.y,
  }

  // Check if new position is valid
  if (!isInBounds(state, newBlockPos)) {
    return { success: false, message: 'Cannot push block there' }
  }

  const targetTile = getTileAt(state.grid, newBlockPos)

  // Can push into empty spaces or traps
  if (targetTile.type !== TileType.EMPTY && targetTile.type !== TileType.TRAP) {
    return { success: false, message: 'Cannot push block there' }
  }

  const pushedBlock = { from: { ...blockPos }, to: { ...newBlockPos } }
  let neutralizedTrap: Position | undefined

  // If pushing onto a trap, neutralize the trap (block disappears)
  if (targetTile.type === TileType.TRAP) {
    state.grid[newBlockPos.y][newBlockPos.x] = { type: TileType.EMPTY }
    neutralizedTrap = { ...newBlockPos }
  } else {
    // Normal push into empty space
    state.grid[newBlockPos.y][newBlockPos.x] = { type: TileType.BLOCK }
  }

  // Clear the old position
  state.grid[blockPos.y][blockPos.x] = { type: TileType.EMPTY }

  return { success: true, message: 'Pushed block', pushedBlock, neutralizedTrap }
}

interface InteractResult {
  success: boolean
  message: string
  openedDoor?: Position
}

/**
 * Attempt to interact with adjacent tiles
 */
function tryInteract(state: GameState): InteractResult {
  const pos = state.playerPosition

  // Check adjacent tiles for doors
  const directions = [
    { x: 0, y: -1 }, // up
    { x: 0, y: 1 }, // down
    { x: -1, y: 0 }, // left
    { x: 1, y: 0 }, // right
  ]

  for (const dir of directions) {
    const adjPos = { x: pos.x + dir.x, y: pos.y + dir.y }
    if (!isInBounds(state, adjPos)) continue

    const adjTile = getTileAt(state.grid, adjPos)

    // Try to open door
    if (adjTile.type.startsWith('DOOR_') && !adjTile.isOpen) {
      const doorColor = adjTile.type.split('_')[1] as KeyColor
      if (state.inventory.keys.includes(doorColor)) {
        // Door becomes empty tile when opened
        state.grid[adjPos.y][adjPos.x] = { type: TileType.EMPTY }
        return {
          success: true,
          message: `Opened ${doorColor.toLowerCase()} door`,
          openedDoor: adjPos,
        }
      }
      // Don't have the key - treat as no-op (action succeeds but nothing happens)
      return {
        success: true,
        message: `Interact (no-op: need ${doorColor.toLowerCase()} key)`,
      }
    }
  }

  // No interactable object found - treat as no-op (still a valid action)
  return { success: true, message: 'Interact (no-op: nothing to interact with)' }
}

/**
 * Find the other portal tile
 */
function findOtherPortal(state: GameState, currentPortalType: TileType): Position | null {
  const targetType = currentPortalType === TileType.PORTAL_A ? TileType.PORTAL_B : TileType.PORTAL_A

  for (let y = 0; y < state.gridSize.height; y++) {
    for (let x = 0; x < state.gridSize.width; x++) {
      if (state.grid[y][x].type === targetType) {
        return { x, y }
      }
    }
  }

  return null
}

/**
 * Check if a position is within grid bounds
 */
function isInBounds(state: GameState, pos: Position): boolean {
  return pos.x >= 0 && pos.x < state.gridSize.width && pos.y >= 0 && pos.y < state.gridSize.height
}

/**
 * Check if a tile can be walked through
 */
function isPassable(tile: Tile): boolean {
  // Walls are never passable
  if (tile.type === TileType.WALL) {
    return false
  }

  // Closed doors are not passable
  if (tile.type.startsWith('DOOR_') && !tile.isOpen) {
    return false
  }

  // Regular blocks are not passable (must be pushed)
  if (tile.type === TileType.BLOCK && !tile.isFixed) {
    return false
  }

  // Fixed blocks (neutralized traps) are passable
  if (tile.type === TileType.BLOCK && tile.isFixed) {
    return true
  }

  return true
}

/**
 * Get tile at a specific position
 */
function getTileAt(grid: Grid, pos: Position): Tile {
  return grid[pos.y][pos.x]
}

/**
 * Get direction name from delta
 */
function getDirName(delta: Position): string {
  if (delta.y < 0) return 'up'
  if (delta.y > 0) return 'down'
  if (delta.x < 0) return 'left'
  if (delta.x > 0) return 'right'
  return ''
}

interface NormalizedTileConfig {
  type: TileType
  isFixed?: boolean
}

/**
 * Normalize arbitrary tile values into canonical TileType values
 */
function normalizeTileType(tileType: TileType | string | null | undefined): NormalizedTileConfig {
  if (tileType === null || tileType === undefined) {
    return { type: TileType.EMPTY }
  }

  if (typeof tileType !== 'string') {
    return { type: tileType }
  }

  const trimmed = tileType.trim()
  if (!trimmed) {
    return { type: TileType.EMPTY }
  }

  // Direct match (already a valid TileType)
  if (VALID_TILE_TYPES.has(trimmed as TileType)) {
    return { type: trimmed as TileType }
  }

  // Normalize casing/delimiters
  const canonical = trimmed.replace(/[\s-]+/g, '_').toUpperCase()
  if (VALID_TILE_TYPES.has(canonical as TileType)) {
    return { type: canonical as TileType }
  }

  // Handle keys/doors missing underscores
  const keyMatch = canonical.match(/^KEY[_-]?(RED|BLUE|GREEN|YELLOW)$/)
  if (keyMatch) {
    return { type: `KEY_${keyMatch[1]}` as TileType }
  }

  const doorMatch = canonical.match(/^DOOR[_-]?(RED|BLUE|GREEN|YELLOW)$/)
  if (doorMatch) {
    return { type: `DOOR_${doorMatch[1]}` as TileType }
  }

  if (canonical === 'PORTALA') {
    return { type: TileType.PORTAL_A }
  }
  if (canonical === 'PORTALB') {
    return { type: TileType.PORTAL_B }
  }

  switch (canonical) {
    case '#':
    case 'W':
    case 'WALL':
      return { type: TileType.WALL }
    case '.':
    case '':
    case 'E':
    case 'EMPTY':
    case 'P': // treat player start markers as empty tiles
      return { type: TileType.EMPTY }
    case '!':
    case 'TRAP':
      return { type: TileType.TRAP }
    case 'X':
    case 'BOX':
    case 'CRATE':
      return { type: TileType.BLOCK }
    case 'F':
    case 'FIXED_BLOCK':
      return { type: TileType.BLOCK, isFixed: true }
    case 'PORTAL':
      return { type: TileType.PORTAL_A }
    case 'G':
    case 'GOAL':
      return { type: TileType.GOAL }
  }

  return { type: TileType.EMPTY }
}

/**
 * Undo the last move and return the previous game state
 */
export function undoMove(state: GameState): GameState {
  if (state.moveHistory.length === 0) {
    return state
  }

  const lastMove = state.moveHistory[state.moveHistory.length - 1]

  // Restore previous state
  return {
    ...state,
    playerPosition: lastMove.previousPlayerPos,
    grid: lastMove.previousGrid || state.grid,
    inventory: lastMove.previousInventory || state.inventory,
    moveHistory: state.moveHistory.slice(0, -1),
    turn: state.turn - 1,
    done: false,
    success: false,
    message: undefined,
    endTime: null,
  }
}

/**
 * Reset game to initial state while keeping the same level
 */
export function resetGame(state: GameState): GameState {
  return createGame(state.level)
}

/**
 * Get the key color from a door tile type
 */
export function getKeyColor(tileType: TileType): KeyColor | null {
  if (!tileType.startsWith('KEY_') && !tileType.startsWith('DOOR_')) {
    return null
  }
  return tileType.split('_')[1] as KeyColor
}

/**
 * Check if position matches
 */
export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y
}
