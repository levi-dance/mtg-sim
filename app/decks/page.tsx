'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getOrCreateToken } from '@/lib/tokens/identity'
import { listDecks, deleteDeck } from '@/lib/decks'
import { getArtCropUri } from '@/lib/scryfall/api'
import type { DeckSummary } from '@/types/deck'

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    const token = getOrCreateToken()
    listDecks(token)
      .then(setDecks)
      .catch(() => setDecks([]))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (id: string, deckName: string) => {
    if (!confirm(`Delete "${deckName}"?`)) return
    await deleteDeck(id)
    setDecks(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="max-w-3xl mx-auto w-full p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#d4a843]">My Decks</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/decks/import"
            className="px-4 py-2 bg-[#161b22] border border-[#30363d] text-zinc-300 font-semibold rounded hover:border-[#d4a843]/50 hover:text-zinc-100 transition-colors"
          >
            Import Deck
          </Link>
          <Link
            href="/decks/new"
            className="px-4 py-2 bg-[#d4a843] text-[#0d1117] font-semibold rounded hover:bg-[#e6b84f] transition-colors"
          >
            + New Deck
          </Link>
        </div>
      </div>
      {isLoading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : decks.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <p className="text-zinc-500">No decks yet.</p>
          <Link href="/decks/new" className="text-[#d4a843] hover:underline text-sm">
            Create your first deck →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {decks.map(deck => (
            <li
              key={deck.id}
              className="bg-[#161b22] border border-[#30363d] rounded-xl flex items-center gap-3 p-3 hover:border-[#d4a843]/40 transition-colors"
            >
              {deck.commanderCard ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={getArtCropUri(deck.commanderCard.artId)}
                  alt={deck.commanderCard.name}
                  width={56}
                  height={40}
                  className="rounded shrink-0 object-cover"
                />
              ) : (
                <div className="w-14 h-10 rounded bg-[#21262d] shrink-0" />
              )}
              <div className="flex flex-col flex-1 min-w-0">
                <Link
                  href={`/decks/${deck.id}`}
                  className="text-zinc-200 font-medium hover:text-[#d4a843] truncate transition-colors"
                >
                  {deck.name}
                </Link>
                <span className="text-zinc-500 text-xs">
                  {deck.format === 'commander' ? 'Commander' : 'Modern'}
                  {' · '}{deck.cardCount} cards
                  {deck.commanderCard && ` · ${deck.commanderCard.name}`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/decks/${deck.id}`}
                  className="text-sm text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-[#21262d] transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(deck.id, deck.name)}
                  className="text-sm text-zinc-500 hover:text-red-400 px-2 py-1 rounded hover:bg-[#21262d] transition-colors"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
