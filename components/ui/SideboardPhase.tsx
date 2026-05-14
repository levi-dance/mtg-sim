'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { GameAction } from '@/lib/game/actions'
import type { GameState, Player } from '@/types/game'

interface Props {
  gameState: GameState
  localPlayer: Player
  players: Player[]
  dispatch: (action: GameAction) => void
  onStartNextGame: () => Promise<void>
}

export function SideboardPhase({ gameState, localPlayer, players, dispatch, onStartNextGame }: Props) {
  const [starting, setStarting] = useState(false)

  const nonSpectators = players.filter(p => !p.isSpectator).sort((a, b) => a.seatIndex - b.seatIndex)
  const winsNeeded = Math.ceil(gameState.settings.matchLength / 2)
  const matchWinner = nonSpectators.find(p => (gameState.matchScore[p.id] ?? 0) >= winsNeeded)
  const allReady = nonSpectators.every(p => gameState.sideboardReadyIds.includes(p.id))
  const isHost = localPlayer.seatIndex === 0
  const isReady = gameState.sideboardReadyIds.includes(localPlayer.id)
  const gamesPlayed = Object.values(gameState.matchScore).reduce((a, b) => a + b, 0)
  const nextGameNumber = gamesPlayed + 1

  function handleReady() {
    dispatch({
      type: 'SIDEBOARD_CONFIRM',
      playerId: localPlayer.id,
      timestamp: new Date().toISOString(),
    })
  }

  function handleEndSession() {
    dispatch({
      type: 'GAME_END',
      playerId: localPlayer.id,
      timestamp: new Date().toISOString(),
    })
  }

  async function handleStartNextGame() {
    if (starting) return
    setStarting(true)
    try {
      await onStartNextGame()
    } catch {
      setStarting(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/75 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.section
        className="w-full max-w-2xl rounded-lg border border-[#d4a843]/30 bg-[#161b22] p-8 shadow-2xl"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.06 }}
      >
        {matchWinner ? (
          <>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-[#d4a843]">Match Over</p>
            <h2 className="mt-2 text-center font-serif text-3xl font-semibold text-zinc-100">
              {matchWinner.displayName} wins the match!
            </h2>
            <ScoreGrid players={nonSpectators} matchScore={gameState.matchScore} winsNeeded={winsNeeded} />
            {isHost && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  className="rounded border border-[#30363d] px-5 py-2 text-sm text-zinc-300 transition hover:border-[#d4a843]/60"
                  onClick={handleEndSession}
                >
                  End Session
                </button>
              </div>
            )}
            {!isHost && (
              <p className="mt-6 text-center text-sm text-zinc-600">Waiting for host to end the session.</p>
            )}
          </>
        ) : (
          <>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-[#d4a843]">
              Best of {gameState.settings.matchLength}
            </p>
            <h2 className="mt-2 text-center font-serif text-2xl font-semibold text-zinc-100">
              Sideboard for Game {nextGameNumber}
            </h2>
            <ScoreGrid players={nonSpectators} matchScore={gameState.matchScore} winsNeeded={winsNeeded} />

            <div className="mt-6 grid gap-2">
              {nonSpectators.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded bg-[#0d1117] px-4 py-3"
                >
                  <span className="text-sm text-zinc-300">{p.displayName}</span>
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      gameState.sideboardReadyIds.includes(p.id) ? 'text-green-400' : 'text-zinc-600'
                    }`}
                  >
                    {gameState.sideboardReadyIds.includes(p.id) ? 'Ready' : 'Not ready'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {localPlayer.deckId && (
                <a
                  href={`/decks/${localPlayer.deckId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-[#30363d] px-4 py-2 text-sm text-zinc-300 transition hover:border-[#d4a843]/60"
                >
                  Edit Deck
                </a>
              )}
              {!isReady && !localPlayer.isSpectator && (
                <button
                  type="button"
                  className="rounded border border-green-700 px-4 py-2 text-sm text-green-400 transition hover:bg-green-900/20"
                  onClick={handleReady}
                >
                  Ready
                </button>
              )}
              {isHost && allReady && (
                <button
                  type="button"
                  disabled={starting}
                  className="rounded border border-[#d4a843]/60 bg-[#d4a843]/10 px-4 py-2 text-sm font-semibold text-[#d4a843] transition hover:bg-[#d4a843]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleStartNextGame}
                >
                  {starting ? 'Starting…' : `Start Game ${nextGameNumber}`}
                </button>
              )}
              {isHost && !allReady && (
                <p className="text-sm text-zinc-600">Waiting for all players to ready up.</p>
              )}
            </div>
          </>
        )}
      </motion.section>
    </motion.div>
  )
}

function ScoreGrid({
  players,
  matchScore,
  winsNeeded,
}: {
  players: Player[]
  matchScore: Record<string, number>
  winsNeeded: number
}) {
  return (
    <div className="mt-6 grid gap-2">
      {players.map(p => {
        const wins = matchScore[p.id] ?? 0
        return (
          <div key={p.id} className="flex items-center gap-3 rounded bg-[#0d1117] px-4 py-3">
            <span className="flex-1 truncate text-sm text-zinc-400">{p.displayName}</span>
            <div className="flex gap-1">
              {Array.from({ length: winsNeeded }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full border ${
                    i < wins ? 'border-[#d4a843] bg-[#d4a843]' : 'border-[#30363d] bg-transparent'
                  }`}
                />
              ))}
            </div>
            <span className="w-8 text-right font-mono text-sm text-zinc-100">{wins}</span>
          </div>
        )
      })}
    </div>
  )
}
