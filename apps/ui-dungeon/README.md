# Sokoban UI

A Sokoban puzzle game with human play mode and AI solver integration via OpenRouter.

## Features

- **Human Play Mode**: Use arrow keys to solve puzzles manually
- **AI Solver**: Run LLM models to attempt puzzle solutions with move-by-move execution
- **Two Difficulty Levels**:
  - **Easy (Generated)**: Procedurally generated 8x8 puzzles with 1 box, guaranteed solvable
  - **Medium (Boxoban)**: 10 curated puzzles from [boxoban-levels](https://github.com/google-deepmind/boxoban-levels) (10x10, 4 boxes)

## Getting Started

```bash
# From the monorepo root
bun install

# Run the dev server
bun run dev:sokoban
```

The app runs on `http://localhost:5174`.

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Move player |
| Z / Backspace | Undo last move |
| R | Reset puzzle |
| N | Generate new puzzle (Easy mode only) |

## AI Integration

The AI panel allows you to run LLM models against puzzles:

1. Select a model from the dropdown
2. Configure prompt options (ASCII grid, coordinates, notation guide)
3. Click "Run AI Agent" to start
4. Watch the AI execute moves one-by-one

### Prompt Format

The AI receives the puzzle state and must return a JSON response:

```json
{
  "reasoning": "Step-by-step reasoning here...",
  "moves": ["UP", "RIGHT", "DOWN", "LEFT"]
}
```

### API Key

Set your OpenRouter API key in `.env`:

```
VITE_OPENROUTER_API_KEY=your_key_here
```

## Project Structure

```
src/
├── components/
│   ├── AIPanel.tsx        # AI solver controls and execution
│   ├── ControlPanel.tsx   # Game stats and controls
│   ├── LevelSelector.tsx  # Difficulty and puzzle selection
│   ├── SokobanGrid.tsx    # Puzzle renderer
│   └── SquareLoader.tsx   # Loading animation
├── data/
│   └── mediumLevels.ts    # Embedded boxoban puzzles
├── services/
│   └── llm.ts             # OpenRouter API integration
├── utils/
│   ├── gameEngine.ts      # Move validation and execution
│   ├── levelGenerator.ts  # Procedural puzzle generation
│   ├── levelLoader.ts     # Level loading utilities
│   ├── levelParser.ts     # Boxoban ASCII parser
│   ├── promptGeneration.ts # AI prompt formatting
│   └── solutionValidator.ts # AI response parsing
├── types/
│   └── index.ts           # TypeScript types
├── constants/
│   └── index.ts           # Game constants
└── SokobanGame.tsx        # Main game component
```

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- OpenAI SDK (for OpenRouter)
