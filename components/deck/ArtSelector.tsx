'use client'

import { useState, useEffect } from 'react'
import { getCardPrintings, getCardImageUri, getArtCropUri, type ScryfallCard } from '@/lib/scryfall/api'

interface Props {
  cardName: string
  currentArtId: string
  onSelect: (artId: string) => void
  onClose: () => void
}

export function ArtSelector({ cardName, currentArtId, onSelect, onClose }: Props) {
  const [printings, setPrintings] = useState<ScryfallCard[]>([])
  const [previewed, setPreviewed] = useState<ScryfallCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getCardPrintings(cardName)
      .then(data => {
        setPrintings(data)
        // Default preview to whichever printing is currently selected
        setPreviewed(data.find(c => c.id === currentArtId) ?? data[0] ?? null)
      })
      .catch(() => setPrintings([]))
      .finally(() => setIsLoading(false))
  }, [cardName, currentArtId])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-[#d4a843] font-semibold">Select Art — {cardName}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl leading-none">
            ✕
          </button>
        </div>
        {isLoading ? (
          <p className="text-zinc-400 text-sm">Loading printings...</p>
        ) : (
          <div className="flex gap-4 overflow-hidden min-h-0">
            <div className="grid grid-cols-4 gap-2 overflow-y-auto flex-1">
              {printings.map(card => (
                <button
                  key={card.id}
                  onClick={() => { onSelect(card.id); onClose() }}
                  onMouseEnter={() => setPreviewed(card)}
                  className={`relative rounded overflow-hidden border-2 transition-all text-left ${
                    card.id === currentArtId
                      ? 'border-[#d4a843]'
                      : 'border-transparent hover:border-zinc-400'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getArtCropUri(card.id)}
                    alt={`${card.set_name} #${card.collector_number}`}
                    className="w-full block"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-zinc-300 px-1 py-0.5 truncate">
                    {card.set_name}
                  </div>
                </button>
              ))}
            </div>
            {/* Fixed-width preview panel — always rendered so the grid never reflows */}
            <div className="shrink-0 w-36 flex flex-col gap-1">
              {previewed && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getCardImageUri(previewed)}
                    alt={previewed.name}
                    className="rounded-lg shadow-xl w-full"
                  />
                  <p className="text-zinc-400 text-xs text-center">
                    {previewed.set_name} #{previewed.collector_number}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
