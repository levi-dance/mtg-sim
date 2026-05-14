'use client'

import type { GameState, Player } from '@/types/game'

interface Props {
  gameState: GameState
  players: Player[]
}

export function MatchScoreDisplay({ gameState, players }: Props) {
  const nonSpectators = players.filter(p => !p.isSpectator)
  if (nonSpectators.length === 0) return null

  const winsNeeded = Math.ceil(gameState.settings.matchLength / 2)
  const gamesPlayed = Object.values(gameState.matchScore).reduce((a, b) => a + b, 0)

  return (
    <section className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h2 className="font-serif text-sm font-semibold text-zinc-100">Match Score</h2>
      <p className="mt-0.5 text-xs text-zinc-500">
        Best of {gameState.settings.matchLength} · Game {gamesPlayed + 1}
      </p>
      <div className="mt-3 grid gap-2">
        {nonSpectators.map(player => {
          const wins = gameState.matchScore[player.id] ?? 0
          return (
            <div key={player.id} className="flex items-center gap-3">
              <span className="flex-1 truncate text-sm text-zinc-400">{player.displayName}</span>
              <div className="flex gap-1">
                {Array.from({ length: winsNeeded }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full border ${
                      i < wins ? 'border-[#d4a843] bg-[#d4a843]' : 'border-[#30363d] bg-transparent'
                    }`}
                  />
                ))}
              </div>
              <span className="w-6 text-right font-mono text-sm text-zinc-100">{wins}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
