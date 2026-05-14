'use client'

import { useState, useEffect, use } from 'react'
import { getOrCreateToken } from '@/lib/tokens/identity'
import { getDeck } from '@/lib/decks'
import { DeckBuilder } from '@/components/deck/DeckBuilder'
import type { Deck } from '@/types/deck'

interface Props {
  params: Promise<{ deckId: string }>
}

export default function DeckEditorPage({ params }: Props) {
  const { deckId } = use(params)
  const [ownerToken] = useState(getOrCreateToken)
  const [deck, setDeck] = useState<Deck | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(deckId !== 'new')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (deckId === 'new') return
    getDeck(deckId).then(data => {
      if (!data) setNotFound(true)
      else setDeck(data)
      setIsLoading(false)
    })
  }, [deckId])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-400">Loading deck...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-400">Deck not found.</p>
      </div>
    )
  }

  return <DeckBuilder initialDeck={deck} ownerToken={ownerToken} />
}
