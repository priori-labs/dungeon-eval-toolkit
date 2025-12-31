/**
 * Compact tile palette for the level editor
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
  BLOCK: '#404040',
  TRAP: '#404040',
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
      className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${
        isSelected
          ? 'ring-1 ring-amber-300/80 ring-offset-1 ring-offset-background scale-110'
          : 'hover:scale-110'
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
    <div className="flex items-center gap-4 flex-wrap">
      {/* Player Start */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase">Player</span>
        <button
          type="button"
          onClick={() => {
            onSetPlayerStart(!isSettingPlayerStart)
            if (!isSettingPlayerStart) {
              onSelectTile('player-start')
            }
          }}
          className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${
            isSettingPlayerStart
              ? 'bg-yellow-500/30 text-yellow-400 ring-2 ring-yellow-500 scale-110'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:scale-110'
          }`}
          title="Set Player Start"
        >
          @
        </button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Basic Tiles */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase">Basic</span>
        <div className="flex gap-1.5">
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

      <div className="w-px h-6 bg-border" />

      {/* Keys */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase">Keys</span>
        <div className="flex gap-1.5">
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

      <div className="w-px h-6 bg-border" />

      {/* Doors */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase">Doors</span>
        <div className="flex gap-1.5">
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

      <div className="w-px h-6 bg-border" />

      {/* Objects */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase">Objects</span>
        <div className="flex gap-1.5">
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

      <div className="w-px h-6 bg-border" />

      {/* Portals */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase">Portals</span>
        <div className="flex gap-1.5">
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

      <div className="w-px h-6 bg-border" />

      {/* Remove Tool */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase">Erase</span>
        <button
          type="button"
          onClick={() => {
            onSetPlayerStart(false)
            onSelectTile('remove')
          }}
          className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${
            selectedTile === 'remove'
              ? 'bg-red-500/30 text-red-400 ring-2 ring-red-500 scale-110'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:scale-110'
          }`}
          title="Remove Tile"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
