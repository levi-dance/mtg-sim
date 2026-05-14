'use client'

import { CardBack } from '@/components/cards/CardBack'
import { CardImage } from '@/components/cards/CardImage'
import type { GameState, Player, TokenInstance } from '@/types/game'

interface Props {
  gameState: GameState
}

export function SpectatorView({ gameState }: Props) {
  const players = Object.values(gameState.players)
    .filter(p => !p.isSpectator)
    .sort((a, b) => a.seatIndex - b.seatIndex)

  const gridClass =
    players.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 xl:grid-cols-4'

  return (
    <main className="game-table min-h-screen overflow-auto p-4 text-zinc-100">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded border border-[#d4a843]/50 px-2 py-1 text-xs uppercase tracking-wider text-[#d4a843]">
          Spectating
        </span>
        <p className="text-sm text-zinc-500">
          {gameState.format} · {gameState.mode} · Turn {gameState.turn.number} ·{' '}
          {gameState.turn.phase.replaceAll('_', ' ')}
        </p>
      </div>

      <div className={`grid gap-4 ${gridClass}`}>
        {players.map(player => (
          <SpectatorPlayerBoard
            key={player.id}
            player={player}
            tokens={gameState.tokens.filter(t => t.ownerId === player.id)}
            isActive={player.id === gameState.turn.activePlayerId}
          />
        ))}
      </div>
    </main>
  )
}

function SpectatorPlayerBoard({
  player,
  tokens,
  isActive,
}: {
  player: Player
  tokens: TokenInstance[]
  isActive: boolean
}) {
  const handPreview = Math.min(player.zones.hand.length, 7)

  return (
    <section
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        isActive ? 'border-[#d4a843]/60 bg-[#1b2430]' : 'border-[#30363d] bg-[#161b22]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isActive && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#d4a843]" />}
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${player.connected ? 'bg-green-500' : 'bg-zinc-700'}`}
            title={player.connected ? 'Connected' : 'Disconnected'}
          />
          <h2 className="truncate font-serif font-semibold text-zinc-100">{player.displayName}</h2>
          {player.loss && (
            <span className="rounded border border-red-500/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-300">
              Lost
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold leading-none text-zinc-100">
            {player.stats.life}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Life</p>
        </div>
      </div>

      {/* Zone counts */}
      <div className="flex gap-3 text-xs text-zinc-500">
        <span>{player.zones.library.length} library</span>
        <span>{player.zones.graveyard.length} grave</span>
        <span>{player.zones.exile.length} exile</span>
        {player.stats.poisonCounters > 0 && (
          <span className="text-green-400">{player.stats.poisonCounters} poison</span>
        )}
        {player.stats.commanderDamage && Object.values(player.stats.commanderDamage).some(d => d > 0) && (
          <span className="text-orange-400">
            {Math.max(...Object.values(player.stats.commanderDamage))} cmd dmg
          </span>
        )}
      </div>

      {/* Battlefield */}
      <div className="min-h-[5rem] rounded bg-[#0d1117] p-2">
        {player.zones.battlefield.length === 0 && tokens.length === 0 ? (
          <p className="text-xs text-zinc-700">Empty battlefield</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {player.zones.battlefield.map(card => (
              <div
                key={card.instanceId}
                className={`relative h-14 w-10 flex-shrink-0 overflow-hidden rounded transition-transform ${card.tapped ? 'rotate-90' : ''}`}
                title={card.name}
              >
                <CardImage cardId={card.cardId} name={card.name} />
              </div>
            ))}
            {tokens.map(token => (
              <div
                key={token.instanceId}
                className={`relative h-14 w-10 flex-shrink-0 overflow-hidden rounded transition-transform ${token.tapped ? 'rotate-90' : ''}`}
                title={token.name}
              >
                <CardImage cardId={token.cardId} name={token.name} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hand (face-down) */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-zinc-600">Hand:</span>
        {Array.from({ length: handPreview }).map((_, i) => (
          <CardBack key={i} variant="compact" />
        ))}
        {player.zones.hand.length > 7 && (
          <span className="text-xs text-zinc-500">+{player.zones.hand.length - 7}</span>
        )}
        {player.zones.hand.length === 0 && (
          <span className="text-xs text-zinc-700">Empty</span>
        )}
      </div>
    </section>
  )
}
