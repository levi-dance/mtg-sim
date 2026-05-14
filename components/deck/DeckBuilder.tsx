'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getArtCropUri, type ScryfallCard } from '@/lib/scryfall/api'
import { CardSearch } from './CardSearch'
import { ArtSelector } from './ArtSelector'
import { saveDeck, deleteDeck } from '@/lib/decks'
import type { Deck, DeckCard } from '@/types/deck'
import type { GameFormat } from '@/types/game'

interface Props {
  initialDeck?: Deck
  ownerToken: string
}

interface ArtSelectorState {
  cardName: string
  currentArtId: string
  zone: 'main' | 'side' | 'commander'
  index: number
}

function cardToDeckCard(card: ScryfallCard): DeckCard {
  return { cardId: card.id, name: card.name, quantity: 1, artId: card.id }
}

export function DeckBuilder({ initialDeck, ownerToken }: Props) {
  const router = useRouter()
  const [deckId, setDeckId] = useState<string | undefined>(initialDeck?.id)
  const [name, setName] = useState(initialDeck?.name ?? 'New Deck')
  const [format, setFormat] = useState<GameFormat>(initialDeck?.format ?? 'commander')
  const [commanderCard, setCommanderCard] = useState<DeckCard | null>(initialDeck?.commanderCard ?? null)
  const [mainDeck, setMainDeck] = useState<DeckCard[]>(initialDeck?.mainDeck ?? [])
  const [sideboard, setSideboard] = useState<DeckCard[]>(initialDeck?.sideboard ?? [])
  const [activeTab, setActiveTab] = useState<'main' | 'side'>('main')
  const [addMode, setAddMode] = useState<'main' | 'side' | 'commander'>('main')
  const [artSelector, setArtSelector] = useState<ArtSelectorState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const mainCount = mainDeck.reduce((s, c) => s + c.quantity, 0)
  const sideCount = sideboard.reduce((s, c) => s + c.quantity, 0)
  const currentList = activeTab === 'main' ? mainDeck : sideboard

  const addCard = useCallback((card: ScryfallCard) => {
    if (addMode === 'commander') {
      setCommanderCard(cardToDeckCard(card))
      setAddMode('main')
      return
    }
    const setter = addMode === 'main' ? setMainDeck : setSideboard
    setter(prev => {
      const existing = prev.findIndex(c => c.cardId === card.id)
      if (existing >= 0) {
        return prev.map((c, i) => i === existing ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, cardToDeckCard(card)]
    })
  }, [addMode])

  const updateQuantity = (zone: 'main' | 'side', index: number, delta: number) => {
    const setter = zone === 'main' ? setMainDeck : setSideboard
    setter(prev =>
      prev
        .map((c, i) => i === index ? { ...c, quantity: c.quantity + delta } : c)
        .filter(c => c.quantity > 0)
    )
  }

  const removeCard = (zone: 'main' | 'side', index: number) => {
    const setter = zone === 'main' ? setMainDeck : setSideboard
    setter(prev => prev.filter((_, i) => i !== index))
  }

  const updateArt = (zone: 'main' | 'side' | 'commander', index: number, artId: string) => {
    if (zone === 'commander') {
      setCommanderCard(prev => prev ? { ...prev, artId } : prev)
      return
    }
    const setter = zone === 'main' ? setMainDeck : setSideboard
    setter(prev => prev.map((c, i) => i === index ? { ...c, artId } : c))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const saved = await saveDeck({ id: deckId, ownerToken, name, format, commanderCard, mainDeck, sideboard })
      setDeckId(saved.id)
      setSaveMessage('Saved!')
      if (!initialDeck) router.replace(`/decks/${saved.id}`)
    } catch {
      setSaveMessage('Save failed — check Supabase connection')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const handleDelete = async () => {
    if (!deckId || !confirm(`Delete "${name}"?`)) return
    await deleteDeck(deckId)
    router.push('/decks')
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto w-full min-h-0 flex-1">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push('/decks')}
          className="text-zinc-400 hover:text-zinc-200 text-sm shrink-0"
        >
          ← Decks
        </button>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 min-w-0 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#d4a843]"
        />
        <select
          value={format}
          onChange={e => setFormat(e.target.value as GameFormat)}
          className="bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none shrink-0"
        >
          <option value="commander">Commander</option>
          <option value="modern">Modern</option>
        </select>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-[#d4a843] text-[#0d1117] font-semibold rounded hover:bg-[#e6b84f] disabled:opacity-50 transition-colors shrink-0"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        {deckId && (
          <button
            onClick={handleDelete}
            className="px-3 py-2 text-red-400 hover:text-red-300 text-sm shrink-0"
          >
            Delete
          </button>
        )}
      </div>
      {saveMessage && (
        <p className={`text-sm -mt-2 ${saveMessage.includes('fail') ? 'text-red-400' : 'text-green-400'}`}>
          {saveMessage}
        </p>
      )}

      {/* Commander slot */}
      {format === 'commander' && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <h2 className="text-[#d4a843] font-semibold text-xs uppercase tracking-wider mb-3">
            Commander
          </h2>
          {commanderCard ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setArtSelector({
                    cardName: commanderCard.name,
                    currentArtId: commanderCard.artId,
                    zone: 'commander',
                    index: 0,
                  })
                }
                className="shrink-0 hover:opacity-80 transition-opacity"
                title="Change art"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getArtCropUri(commanderCard.artId)}
                  alt={commanderCard.name}
                  width={60}
                  height={43}
                  className="rounded"
                />
              </button>
              <span className="text-zinc-200 font-medium">{commanderCard.name}</span>
              <button
                onClick={() => setCommanderCard(null)}
                className="ml-auto text-zinc-500 hover:text-zinc-300 text-sm"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddMode('commander')}
              className={`w-full border-2 border-dashed rounded-lg py-4 text-sm transition-colors ${
                addMode === 'commander'
                  ? 'border-[#d4a843] text-[#d4a843]'
                  : 'border-[#30363d] text-zinc-500 hover:border-zinc-500 hover:text-zinc-400'
              }`}
            >
              {addMode === 'commander' ? 'Search below to set commander' : '+ Set commander'}
            </button>
          )}
        </div>
      )}

      {/* Search area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <span className="text-zinc-500 text-xs mr-1">Add to:</span>
          {(['main', 'side'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setAddMode(mode)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                addMode === mode
                  ? 'bg-[#d4a843] text-[#0d1117]'
                  : 'bg-[#161b22] border border-[#30363d] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode === 'main' ? 'Main Deck' : 'Sideboard'}
            </button>
          ))}
        </div>
        <CardSearch onSelectCard={addCard} />
      </div>

      {/* Deck list */}
      <div className="flex flex-col flex-1 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden min-h-0">
        <div className="flex border-b border-[#30363d] shrink-0">
          {(['main', 'side'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-[#d4a843] border-[#d4a843]'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              {tab === 'main' ? `Main Deck (${mainCount})` : `Sideboard (${sideCount})`}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-[#21262d]">
          {currentList.length === 0 ? (
            <p className="text-zinc-500 text-sm p-4">
              No cards yet — search above to add cards.
            </p>
          ) : (
            currentList.map((card, i) => (
              <div
                key={`${card.cardId}-${i}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[#21262d] group transition-colors"
              >
                <button
                  onClick={() =>
                    setArtSelector({
                      cardName: card.name,
                      currentArtId: card.artId,
                      zone: activeTab,
                      index: i,
                    })
                  }
                  className="shrink-0 hover:opacity-75 transition-opacity"
                  title="Change art"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getArtCropUri(card.artId)}
                    alt={card.name}
                    width={40}
                    height={28}
                    className="rounded"
                  />
                </button>
                <span className="text-zinc-200 text-sm flex-1 truncate">{card.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQuantity(activeTab, i, -1)}
                    className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-[#30363d] rounded text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-zinc-300 text-sm tabular-nums">
                    {card.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(activeTab, i, 1)}
                    className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-[#30363d] rounded text-lg leading-none"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeCard(activeTab, i)}
                    className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-[#30363d] rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    title="Remove card"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {artSelector && (
        <ArtSelector
          cardName={artSelector.cardName}
          currentArtId={artSelector.currentArtId}
          onSelect={artId => updateArt(artSelector.zone, artSelector.index, artId)}
          onClose={() => setArtSelector(null)}
        />
      )}
    </div>
  )
}
