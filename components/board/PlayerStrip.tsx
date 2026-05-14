import { CardBack } from '@/components/cards/CardBack'
import type { Player } from '@/types/game'

interface PlayerStripProps {
  player: Player
  isActive: boolean
  isMe: boolean
}

export function PlayerStrip({ player, isActive, isMe }: PlayerStripProps) {
  const handPreviewCount = Math.min(player.zones.hand.length, 7)

  return (
    <section
      className={`rounded-lg border px-4 py-3 shadow-2xl ${
        isActive
          ? 'border-[#d4a843]/70 bg-[#1b2430]'
          : 'border-[#30363d] bg-[#161b22]/95'
      }`}
    >
      <div className="mb-2.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isActive && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#d4a843]" />}
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full ${player.connected ? 'bg-green-500' : 'bg-zinc-700'}`}
              title={player.connected ? 'Connected' : 'Disconnected'}
            />
            <h2 className="truncate font-serif text-base font-semibold text-zinc-100">
              {player.displayName}
            </h2>
            {isMe && (
              <span className="rounded border border-[#30363d] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                You
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="rounded bg-[#0d1117] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
              {player.zones.battlefield.length} perms
            </span>
            <span className="rounded bg-[#0d1117] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
              {player.zones.graveyard.length} GY
            </span>
            <span className="rounded bg-[#0d1117] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
              {player.zones.exile.length} Ex
            </span>
            {player.loss && (
              <span className="rounded bg-red-950/70 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-red-300">
                Lost
              </span>
            )}
          </div>
        </div>
        <div className={`rounded-md border px-3 py-1 text-center ${
          isActive ? 'border-[#d4a843]/60 bg-[#0d1117]' : 'border-[#30363d] bg-[#0d1117]'
        }`}>
          <p className={`font-mono text-3xl font-bold leading-none ${isActive ? 'text-[#d4a843]' : 'text-zinc-100'}`}>
            {player.stats.life}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Life</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-end">
          {Array.from({ length: handPreviewCount }).map((_, index) => (
            <CardBack key={index} variant="compact" />
          ))}
          {player.zones.hand.length > handPreviewCount && (
            <span className="ml-2 text-xs text-zinc-500">+{player.zones.hand.length - handPreviewCount}</span>
          )}
        </div>
        <CardBack variant="compact" count={player.zones.library.length} />
      </div>
    </section>
  )
}
