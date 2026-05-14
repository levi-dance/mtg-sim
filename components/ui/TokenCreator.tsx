'use client'

import { useEffect, useState } from 'react'
import { CardImage } from '@/components/cards/CardImage'
import type { GameAction } from '@/lib/game/actions'
import { searchTokens, type ScryfallCard } from '@/lib/scryfall/api'
import type { Player, SubfieldZone } from '@/types/game'

interface TokenCreatorProps {
  player: Player
  tokenCount: number
  dispatch: (action: GameAction) => void
}

export function TokenCreator({ player, tokenCount, dispatch }: TokenCreatorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ScryfallCard[]>([])
  const [selectedZone, setSelectedZone] = useState<SubfieldZone>('creatures')

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      return
    }

    let active = true
    const timeout = window.setTimeout(() => {
      searchTokens(trimmed)
        .then(cards => {
          if (active) setResults(cards.slice(0, 5))
        })
        .catch(() => {
          if (active) setResults([])
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query])

  function addToken(name: string, cardId: string) {
    const laneY = selectedZone === 'other' ? 80 : selectedZone === 'creatures' ? 240 : 400
    dispatch({
      type: 'ADD_TOKEN',
      playerId: player.id,
      name,
      cardId,
      x: 140 + tokenCount * 18,
      y: laneY,
      subfieldZone: selectedZone,
      timestamp: new Date().toISOString(),
    })
  }

  function addCustomToken() {
    const name = query.trim() || 'Custom Token'
    addToken(name, '')
    setQuery('')
    setResults([])
  }

  const visibleResults = query.trim().length >= 2 ? results : []

  return (
    <section className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-sm font-semibold text-zinc-100">Tokens</h2>
        <span className="font-mono text-xs text-zinc-500">{tokenCount}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['creatures', 'other', 'lands'] as SubfieldZone[]).map(zone => (
          <button
            key={zone}
            type="button"
            className={`rounded border px-2 py-1 text-xs capitalize transition ${
              selectedZone === zone
                ? 'border-[#d4a843]/70 bg-[#d4a843]/10 text-[#d4a843]'
                : 'border-[#30363d] text-zinc-400 hover:border-[#d4a843]/50'
            }`}
            onClick={() => setSelectedZone(zone)}
          >
            {zone}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search token"
        className="mt-3 w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-[#d4a843]/70"
      />

      <div className="mt-3 grid gap-2">
        {visibleResults.map(card => (
          <button
            key={card.id}
            type="button"
            className="grid grid-cols-[2.4rem_minmax(0,1fr)] items-center gap-3 rounded border border-[#30363d] bg-[#0d1117] p-2 text-left transition hover:border-[#d4a843]/60"
            onClick={() => addToken(card.name, card.id)}
          >
            <span className="block h-[3.35rem] overflow-hidden rounded">
              <CardImage cardId={card.id} name={card.name} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-zinc-200">{card.name}</span>
              <span className="block truncate text-xs text-zinc-500">{card.type_line}</span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-[#d4a843]/60"
        onClick={addCustomToken}
      >
        Create Custom Token
      </button>
    </section>
  )
}
