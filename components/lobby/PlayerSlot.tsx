'use client'

import type { LobbyPlayer } from '@/types/session'

interface Props {
  seatIndex: number
  player: LobbyPlayer | null
  isHost: boolean
  isMe: boolean
}

export function PlayerSlot({ seatIndex, player, isHost, isMe }: Props) {
  if (!player) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-[#0d1117] border-2 border-dashed border-[#21262d] rounded-xl">
        <div className="w-8 h-8 rounded-full bg-[#161b22] flex items-center justify-center text-zinc-600 text-xs font-mono font-bold shrink-0">
          {seatIndex + 1}
        </div>
        <span className="text-zinc-600 text-sm italic">Waiting for player...</span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isMe
          ? 'bg-[#1c2433] border-[#d4a843]/40'
          : 'bg-[#161b22] border-[#30363d]'
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-[#21262d] flex items-center justify-center text-zinc-200 text-xs font-bold shrink-0">
        {seatIndex + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-100 font-medium text-sm">{player.displayName}</span>
          {isHost && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#d4a843]/20 text-[#d4a843] font-semibold leading-none">
              HOST
            </span>
          )}
          {isMe && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#30363d] text-zinc-400 leading-none">
              You
            </span>
          )}
        </div>
        <span className={`text-xs ${player.deckId ? 'text-zinc-500' : 'text-zinc-700 italic'}`}>
          {player.deckId ? 'Deck selected' : 'No deck selected'}
        </span>
      </div>

      <div
        className={`w-2 h-2 rounded-full shrink-0 ${player.connected ? 'bg-green-500' : 'bg-zinc-700'}`}
        title={player.connected ? 'Connected' : 'Disconnected'}
      />
    </div>
  )
}
