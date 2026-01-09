import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Input } from '@sokoban-eval-toolkit/ui-library/components/input'
import { Label } from '@sokoban-eval-toolkit/ui-library/components/label'
import { Separator } from '@sokoban-eval-toolkit/ui-library/components/separator'
import { toast } from '@sokoban-eval-toolkit/ui-library/components/sonner'
import type { DungeonLevel } from '@src/types'
import {
  createBlankLevel,
  deleteLevel,
  exportAllToJSON,
  getSavedLevels,
  saveLevel,
} from '@src/utils/levelStorage'
import { Download, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface LevelSelectorProps {
  onLevelLoad: (level: DungeonLevel) => void
  currentLevel?: DungeonLevel | null
}

export function LevelSelector({ onLevelLoad, currentLevel }: LevelSelectorProps) {
  const [savedLevels, setSavedLevels] = useState<DungeonLevel[]>([])
  const [newLevelWidth, setNewLevelWidth] = useState(16)
  const [newLevelHeight, setNewLevelHeight] = useState(16)
  const [levelName, setLevelName] = useState('')
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null)

  // Load saved levels on mount
  useEffect(() => {
    setSavedLevels(getSavedLevels())
  }, [])

  // Refresh saved levels
  const refreshSavedLevels = useCallback(() => {
    setSavedLevels(getSavedLevels())
  }, [])

  // Create new level
  const handleNewLevel = useCallback(() => {
    const level = createBlankLevel(newLevelWidth, newLevelHeight, 'New Level')
    onLevelLoad(level)
    setLevelName('New Level')
  }, [newLevelWidth, newLevelHeight, onLevelLoad])

  // Save current level
  const handleSave = useCallback(() => {
    if (!currentLevel) return

    const levelToSave: DungeonLevel = {
      ...currentLevel,
      name: levelName || currentLevel.name,
    }

    saveLevel(levelToSave)
    refreshSavedLevels()
    toast.success('Level saved')
  }, [currentLevel, levelName, refreshSavedLevels])

  // Load a saved level
  const handleLoadSaved = useCallback(
    (level: DungeonLevel) => {
      onLevelLoad(level)
      setLevelName(level.name)
      setSelectedLevelId(level.id)
    },
    [onLevelLoad],
  )

  // Delete a saved level
  const handleDelete = useCallback(
    (levelId: string) => {
      if (!confirm('Delete this level?')) return
      deleteLevel(levelId)
      refreshSavedLevels()
      if (selectedLevelId === levelId) {
        setSelectedLevelId(null)
      }
    },
    [refreshSavedLevels, selectedLevelId],
  )

  // Export all levels
  const handleExportAll = useCallback(() => {
    const json = exportAllToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dungeon-levels.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Check if we're editing a loaded layout
  const isEditingLoadedLayout = selectedLevelId && currentLevel?.id === selectedLevelId

  return (
    <div className="space-y-4">
      {/* New Level Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">New Level</h3>

        <div className="flex gap-2 items-end">
          <div className="w-16">
            <Label htmlFor="width" className="text-xs text-muted-foreground">
              Width
            </Label>
            <Input
              id="width"
              type="number"
              min={5}
              max={20}
              value={newLevelWidth}
              onChange={(e) => setNewLevelWidth(Number(e.target.value))}
              className="h-8"
            />
          </div>
          <div className="w-16">
            <Label htmlFor="height" className="text-xs text-muted-foreground">
              Height
            </Label>
            <Input
              id="height"
              type="number"
              min={5}
              max={20}
              value={newLevelHeight}
              onChange={(e) => setNewLevelHeight(Number(e.target.value))}
              className="h-8"
            />
          </div>
          <Button onClick={handleNewLevel} size="sm" className="flex-1 h-8">
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      <Separator />

      {/* Saved Layouts Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saved Layouts
          </span>
        </div>

        {/* Currently editing indicator */}
        {isEditingLoadedLayout && (
          <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded">
            Editing:{' '}
            <span className="font-medium text-foreground">
              {savedLevels.find((l) => l.id === selectedLevelId)?.name}
            </span>
          </div>
        )}

        {/* Save input and button - single row */}
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Layout name..."
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            className="flex-1 h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            onClick={handleSave}
            disabled={!levelName.trim() || !currentLevel}
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs"
          >
            {isEditingLoadedLayout ? 'Update' : 'Save'}
          </Button>
        </div>

        {/* Export All button */}
        {savedLevels.length > 0 && (
          <Button
            onClick={handleExportAll}
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs gap-1.5"
          >
            <Download className="w-3 h-3" />
            Export All ({savedLevels.length})
          </Button>
        )}

        {/* Saved layouts list */}
        {savedLevels.length > 0 ? (
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {savedLevels.map((level) => {
              const isSelected = selectedLevelId === level.id

              return (
                <div
                  key={level.id}
                  className={`group flex items-center gap-1 px-1.5 py-1.5 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary/15 ring-1 ring-primary/30'
                      : 'bg-muted/40 hover:bg-muted/70'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleLoadSaved(level)}
                    className={`flex-1 min-w-0 text-left flex items-center gap-2 text-[11px] focus:outline-none ${
                      isSelected ? 'text-primary font-medium' : 'text-foreground'
                    }`}
                  >
                    <span className="truncate">{level.name}</span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {level.gridSize.width}×{level.gridSize.height}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(level.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 rounded transition-all hover:bg-red-500/10 flex-shrink-0"
                    title="Delete layout"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground italic py-2">No saved layouts yet</div>
        )}
      </div>
    </div>
  )
}
