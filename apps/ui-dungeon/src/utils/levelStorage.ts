/**
 * Level storage utility for saving/loading dungeon levels
 */

import type { DungeonLevel, TileType } from '@src/types'

const STORAGE_KEY = 'dungeon_custom_levels'

/**
 * Get all saved levels from localStorage
 */
export function getSavedLevels(): DungeonLevel[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data)
  } catch {
    console.error('Failed to load saved levels')
    return []
  }
}

/**
 * Save a level to localStorage
 */
export function saveLevel(level: DungeonLevel): void {
  try {
    const levels = getSavedLevels()
    const existingIndex = levels.findIndex((l) => l.id === level.id)

    if (existingIndex >= 0) {
      levels[existingIndex] = level
    } else {
      levels.push(level)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels))
  } catch (e) {
    console.error('Failed to save level', e)
  }
}

/**
 * Load a specific level by ID
 */
export function loadLevel(id: string): DungeonLevel | null {
  const levels = getSavedLevels()
  return levels.find((l) => l.id === id) ?? null
}

/**
 * Delete a level by ID
 */
export function deleteLevel(id: string): void {
  try {
    const levels = getSavedLevels().filter((l) => l.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels))
  } catch (e) {
    console.error('Failed to delete level', e)
  }
}

/**
 * Check if a level with the given name exists
 */
export function levelExists(name: string): boolean {
  return getSavedLevels().some((l) => l.name === name)
}

/**
 * Export a level to JSON string
 */
export function exportToJSON(level: DungeonLevel): string {
  return JSON.stringify(level, null, 2)
}

/**
 * Export all levels to JSON string
 */
export function exportAllToJSON(): string {
  return JSON.stringify(getSavedLevels(), null, 2)
}

/**
 * Import a level from JSON string
 */
export function importFromJSON(json: string): DungeonLevel | null {
  try {
    const data = JSON.parse(json)

    // Validate required fields
    if (!data.id || !data.name || !data.layout || !data.playerStart || !data.gridSize) {
      throw new Error('Invalid level format')
    }

    const level: DungeonLevel = {
      id: data.id,
      name: data.name,
      description: data.description || '',
      gridSize: data.gridSize,
      maxTurns: data.maxTurns || 200,
      objective: data.objective || 'Reach the goal',
      playerStart: data.playerStart,
      layout: data.layout,
    }

    return level
  } catch (e) {
    console.error('Failed to import level', e)
    return null
  }
}

/**
 * Create a new blank level
 */
export function createBlankLevel(
  width: number,
  height: number,
  name = 'Untitled Level',
): DungeonLevel {
  const layout: TileType[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill('EMPTY' as TileType))

  // Add walls around the border
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        layout[y][x] = 'WALL' as TileType
      }
    }
  }

  return {
    id: `custom_${Date.now()}`,
    name,
    description: 'A custom puzzle',
    gridSize: { width, height },
    maxTurns: 200,
    objective: 'Reach the goal',
    playerStart: { x: 1, y: 1 },
    layout,
  }
}

/**
 * Create a simple demo level for testing
 */
export function createDemoLevel(): DungeonLevel {
  const width = 10
  const height = 8

  // Create empty grid with walls around border
  const layout: TileType[][] = Array(height)
    .fill(null)
    .map((_, y) =>
      Array(width)
        .fill(null)
        .map((_, x) => {
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            return 'WALL' as TileType
          }
          return 'EMPTY' as TileType
        }),
    )

  // Add some walls
  layout[3][3] = 'WALL' as TileType
  layout[3][4] = 'WALL' as TileType
  layout[4][3] = 'WALL' as TileType

  // Add a key and door
  layout[2][7] = 'KEY_RED' as TileType
  layout[5][5] = 'DOOR_RED' as TileType

  // Add a trap
  layout[6][3] = 'TRAP' as TileType

  // Add a block
  layout[4][6] = 'BLOCK' as TileType

  // Add the goal
  layout[6][7] = 'GOAL' as TileType

  return {
    id: 'demo_level',
    name: 'Demo Level',
    description: 'A simple demo to test game mechanics',
    gridSize: { width, height },
    maxTurns: 50,
    objective: 'Collect the key, unlock the door, and reach the goal!',
    playerStart: { x: 1, y: 1 },
    layout,
  }
}
