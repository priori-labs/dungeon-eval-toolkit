# Dungeon Eval Toolkit

A web-based Dungeon Crawler puzzle environment for evaluating AI language models on spatial reasoning and planning tasks.

<img width="1728" height="995" alt="Image" src="https://github.com/user-attachments/assets/7cd466af-2d75-4c12-a9ca-fe006d0dab45" />

## Features

- **Level Editor** - Create puzzles with 14+ tile types including keys, doors, pushable blocks, traps, and portals
- **Human Play Mode** - Play levels with session tracking, move counting, and undo/redo
- **AI Evaluation** - Test language models with multiple evaluation modes:
  - Immediate solution (AI provides full move sequence)
  - Move-by-move execution
  - Exploration mode (AI iteratively explores and strategizes)
- **Metrics Dashboard** - Track tokens, cost, reasoning, and execution time

## Setup

1. Install dependencies:
   ```sh
   bun install
   ```

2. Create a `.env` file with your OpenRouter API key:
   ```sh
   OPENROUTER_API_KEY=your_key_here
   ```
   Get an API key at [openrouter.ai](https://openrouter.ai)

3. Start the development server:
   ```sh
   bun dev
   ```

4. Open http://localhost:5173 to play or build levels.

## Game Mechanics

- **Keys & Doors** - Collect colored keys to unlock matching doors
- **Blocks** - Push blocks to solve puzzles (blocks stop at walls/other blocks)
- **Traps** - Avoid or neutralize traps by pushing blocks onto them
- **Portals** - Teleport between linked portal pairs

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Move player |
| Z / Backspace | Undo last move |
| R | Restart level |

# License

MIT