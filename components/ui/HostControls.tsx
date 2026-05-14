'use client'

import { useState } from 'react'
import type { GameAction } from '@/lib/game/actions'
import type { GameState, Player } from '@/types/game'

interface Props {
  localPlayer: Player
  gameState: GameState
  dispatch: (action: GameAction) => void
}

export function HostControls({ localPlayer, gameState, dispatch }: Props) {
  const [pickingWinner, setPickingWinner] = useState(false)

  if (localPlayer.seatIndex !== 0) return null

  const hasPreviousState = Boolean(gameState.previousState)
  const pendingVote = gameState.pendingVote
  const nonSpectators = Object.values(gameState.players)
    .filter(p => !p.isSpectator)
    .sort((a, b) => a.seatIndex - b.seatIndex)

  function initiateVote(topic: string, actionType: 'TAKE_BACK' | 'GAME_END') {
    dispatch({
      type: 'HOST_VOTE_INITIATE',
      playerId: localPlayer.id,
      voteId: `vote_${Date.now()}`,
      topic,
      actionType,
      timestamp: new Date().toISOString(),
    })
  }

  function handleMatchEnd(winnerId: string) {
    dispatch({
      type: 'MATCH_END',
      playerId: localPlayer.id,
      winnerId,
      timestamp: new Date().toISOString(),
    })
    setPickingWinner(false)
  }

  return (
    <section className="rounded-lg border border-[#d4a843]/30 bg-[#161b22] p-4">
      <h2 className="mb-3 font-serif text-sm font-semibold text-[#d4a843]">Host Controls</h2>
      <div className="grid gap-2">
        <button
          type="button"
          disabled={!hasPreviousState || Boolean(pendingVote)}
          className="rounded border border-[#30363d] px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-[#d4a843]/60 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => initiateVote('Take back last action?', 'TAKE_BACK')}
          title={!hasPreviousState ? 'No action to take back' : pendingVote ? 'Vote already in progress' : undefined}
        >
          Call Take-Back Vote
        </button>

        {pickingWinner ? (
          <div className="grid gap-2 rounded border border-red-700/40 p-3">
            <p className="text-xs text-zinc-400">Who won this game?</p>
            {nonSpectators.map(player => (
              <button
                key={player.id}
                type="button"
                className="rounded border border-[#30363d] px-3 py-2 text-left text-sm text-zinc-200 transition hover:border-[#d4a843]/60"
                onClick={() => handleMatchEnd(player.id)}
              >
                {player.displayName}
              </button>
            ))}
            <button
              type="button"
              className="text-left text-xs text-zinc-600 transition hover:text-zinc-400"
              onClick={() => setPickingWinner(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={Boolean(pendingVote)}
            className="rounded border border-red-700/40 px-3 py-2 text-left text-sm text-red-400 transition hover:border-red-600 hover:bg-red-900/20 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setPickingWinner(true)}
            title={pendingVote ? 'Vote in progress' : undefined}
          >
            End Game
          </button>
        )}
      </div>
    </section>
  )
}
