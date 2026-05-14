'use client'

import { motion } from 'framer-motion'
import type { GameAction } from '@/lib/game/actions'
import type { Player, VoteState } from '@/types/game'

interface Props {
  vote: VoteState
  players: Player[]
  localPlayer: Player
  dispatch: (action: GameAction) => void
}

export function VoteModal({ vote, players, localPlayer, dispatch }: Props) {
  const nonSpectators = players.filter(p => !p.isSpectator)
  const isHost = localPlayer.seatIndex === 0
  const myVote = vote.votes[localPlayer.id]
  const yesCount = Object.values(vote.votes).filter(v => v === 'yes').length
  const noCount = Object.values(vote.votes).filter(v => v === 'no').length
  const majority = Math.floor(nonSpectators.length / 2) + 1

  function castVote(choice: 'yes' | 'no') {
    dispatch({
      type: 'HOST_VOTE_CAST',
      playerId: localPlayer.id,
      voteId: vote.id,
      vote: choice,
      timestamp: new Date().toISOString(),
    })
  }

  function forceResolve() {
    dispatch({
      type: 'HOST_VOTE_RESOLVE',
      playerId: localPlayer.id,
      voteId: vote.id,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.section
        className="w-full max-w-md rounded-lg border border-[#d4a843]/60 bg-[#161b22] shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.05 }}
      >
        <div className="border-b border-[#30363d] px-5 py-4">
          <p className="text-xs uppercase tracking-wider text-[#d4a843]">Host Vote</p>
          <h2 className="mt-1 font-serif text-xl font-semibold text-zinc-100">{vote.topic}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Majority needed: {majority} of {nonSpectators.length}
          </p>
        </div>

        <div className="px-5 py-4">
          <div className="grid gap-2">
            {nonSpectators.map(player => {
              const playerVote = vote.votes[player.id]
              return (
                <div key={player.id} className="flex items-center justify-between rounded bg-[#0d1117] px-3 py-2">
                  <span className="text-sm text-zinc-300">{player.displayName}</span>
                  {playerVote === 'yes' && (
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                      Yes
                    </span>
                  )}
                  {playerVote === 'no' && (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                      No
                    </span>
                  )}
                  {!playerVote && (
                    <span className="text-xs text-zinc-600">Pending…</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex gap-2 text-sm text-zinc-500">
            <span className="text-green-400">{yesCount} yes</span>
            <span>·</span>
            <span className="text-red-400">{noCount} no</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#30363d] px-5 py-4">
          {!myVote && !localPlayer.isSpectator && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded border border-green-700/60 bg-green-900/30 py-2 text-sm font-semibold text-green-300 transition hover:border-green-500 hover:bg-green-900/50"
                onClick={() => castVote('yes')}
              >
                Vote Yes
              </button>
              <button
                type="button"
                className="rounded border border-red-700/60 bg-red-900/30 py-2 text-sm font-semibold text-red-300 transition hover:border-red-500 hover:bg-red-900/50"
                onClick={() => castVote('no')}
              >
                Vote No
              </button>
            </div>
          )}
          {myVote && (
            <p className="text-center text-sm text-zinc-500">
              You voted <span className={myVote === 'yes' ? 'text-green-400' : 'text-red-400'}>{myVote}</span>.
            </p>
          )}
          {isHost && (
            <button
              type="button"
              className="rounded border border-[#d4a843]/40 py-2 text-sm text-[#d4a843] transition hover:border-[#d4a843] hover:bg-[#d4a843]/10"
              onClick={forceResolve}
            >
              Force Resolve
            </button>
          )}
        </div>
      </motion.section>
    </motion.div>
  )
}
