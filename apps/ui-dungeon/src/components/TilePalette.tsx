/**
 * Tile palette for the level editor
 */

import { TILE_CATEGORIES, TILE_EMOJIS, TILE_NAMES } from '@src/constants'
import type { TileType } from '@src/types'
import type { AddMode } from './DungeonGrid'

interface TilePaletteProps {
  selectedTile: AddMode
  onSelectTile: (tile: AddMode) => void
  isSettingPlayerStart: boolean
  onSetPlayerStart: (value: boolean) => void
}

// Color mappings for tile backgrounds in palette
const TILE_COLORS: Record<string, string> = {
  EMPTY: '#404040',
  WALL: '#1a1a1a',
  GOAL: '#a8e6cf',
  KEY_RED: '#ffb3ba',
  KEY_BLUE: '#bae1ff',
  KEY_GREEN: '#baffc9',
  KEY_YELLOW: '#ffffba',
  DOOR_RED: '#ff9aa2',
  DOOR_BLUE: '#9ac9ff',
  DOOR_GREEN: '#9affb3',
  DOOR_YELLOW: '#ffff9a',
  BLOCK: '#d4a574',
  TRAP: '#ffaaa5',
  PORTAL_A: '#c7ceea',
  PORTAL_B: '#e2c7ea',
}

// Map AddMode to TileType for comparison
function addModeToTileType(mode: AddMode): TileType | null {
  if (!mode) return null
  const map: Record<string, TileType> = {
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
  return map[mode] ?? null
}

// Map TileType to AddMode
function tileTypeToAddMode(tileType: TileType): AddMode {
  const map: Record<TileType, AddMode> = {
    WALL: 'wall',
    EMPTY: 'empty',
    GOAL: 'goal',
    BLOCK: 'block',
    TRAP: 'trap',
    KEY_RED: 'key-red',
    KEY_BLUE: 'key-blue',
    KEY_GREEN: 'key-green',
    KEY_YELLOW: 'key-yellow',
    DOOR_RED: 'door-red',
    DOOR_BLUE: 'door-blue',
    DOOR_GREEN: 'door-green',
    DOOR_YELLOW: 'door-yellow',
    PORTAL_A: 'portal-a',
    PORTAL_B: 'portal-b',
  }
  return map[tileType]
}

interface TileButtonProps {
  tileType: TileType
  isSelected: boolean
  onClick: () => void
}

function TileButton({ tileType, isSelected, onClick }: TileButtonProps) {
  const emoji = TILE_EMOJIS[tileType]
  const name = TILE_NAMES[tileType]
  const bgColor = TILE_COLORS[tileType] || '#404040'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-10 h-10 rounded flex items-center justify-center text-lg transition-all ${
        isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-110'
      }`}
      style={{ backgroundColor: bgColor }}
      title={name}
    >
      {emoji || (tileType === 'WALL' ? '#' : tileType === 'EMPTY' ? '.' : '?')}
    </button>
  )
}

export function TilePalette({
  selectedTile,
  onSelectTile,
  isSettingPlayerStart,
  onSetPlayerStart,
}: TilePaletteProps) {
  const selectedTileType = addModeToTileType(selectedTile)

  return (
    <div className="space-y-4">
      {/* Player Start Button */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Player
        </h4>
        <button
          type="button"
          onClick={() => {
            onSetPlayerStart(!isSettingPlayerStart)
            if (!isSettingPlayerStart) {
              onSelectTile('player-start')
            }
          }}
          className={`w-full h-10 rounded flex items-center justify-center gap-2 transition-all ${
            isSettingPlayerStart
              ? 'bg-yellow-500/20 text-yellow-500 ring-2 ring-yellow-500'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground'
          }`}
        >
          <span className="text-lg">@</span>
          <span className="text-sm">Set Start</span>
        </button>
      </div>

      {/* Basic Tiles */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Basic
        </h4>
        <div className="flex gap-2 flex-wrap">
          {TILE_CATEGORIES.basic.map((tileType) => (
            <TileButton
              key={tileType}
              tileType={tileType}
              isSelected={selectedTileType === tileType}
              onClick={() => {
                onSetPlayerStart(false)
                onSelectTile(tileTypeToAddMode(tileType))
              }}
            />
          ))}
        </div>
      </div>

      {/* Keys */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Keys
        </h4>
        <div className="flex gap-2 flex-wrap">
          {TILE_CATEGORIES.keys.map((tileType) => (
            <TileButton
              key={tileType}
              tileType={tileType}
              isSelected={selectedTileType === tileType}
              onClick={() => {
                onSetPlayerStart(false)
                onSelectTile(tileTypeToAddMode(tileType))
              }}
            />
          ))}
        </div>
      </div>

      {/* Doors */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Doors
        </h4>
        <div className="flex gap-2 flex-wrap">
          {TILE_CATEGORIES.doors.map((tileType) => (
            <TileButton
              key={tileType}
              tileType={tileType}
              isSelected={selectedTileType === tileType}
              onClick={() => {
                onSetPlayerStart(false)
                onSelectTile(tileTypeToAddMode(tileType))
              }}
            />
          ))}
        </div>
      </div>

      {/* Objects */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Objects
        </h4>
        <div className="flex gap-2 flex-wrap">
          {TILE_CATEGORIES.objects.map((tileType) => (
            <TileButton
              key={tileType}
              tileType={tileType}
              isSelected={selectedTileType === tileType}
              onClick={() => {
                onSetPlayerStart(false)
                onSelectTile(tileTypeToAddMode(tileType))
              }}
            />
          ))}
        </div>
      </div>

      {/* Portals */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Portals
        </h4>
        <div className="flex gap-2 flex-wrap">
          {TILE_CATEGORIES.portals.map((tileType) => (
            <TileButton
              key={tileType}
              tileType={tileType}
              isSelected={selectedTileType === tileType}
              onClick={() => {
                onSetPlayerStart(false)
                onSelectTile(tileTypeToAddMode(tileType))
              }}
            />
          ))}
        </div>
      </div>

      {/* Remove Tool */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Tools
        </h4>
        <button
          type="button"
          onClick={() => {
            onSetPlayerStart(false)
            onSelectTile('remove')
          }}
          className={`w-full h-10 rounded flex items-center justify-center gap-2 transition-all ${
            selectedTile === 'remove'
              ? 'bg-red-500/20 text-red-500 ring-2 ring-red-500'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground'
          }`}
        >
          <span className="text-lg">X</span>
          <span className="text-sm">Remove</span>
        </button>
      </div>
    </div>
  )
}
