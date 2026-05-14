'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { CardBack } from '@/components/cards/CardBack'
import { CardImage } from '@/components/cards/CardImage'
import type { CardContextMenuState } from '@/components/cards/CardContextMenu'
import type { GameAction } from '@/lib/game/actions'
import type { CardInstance, Player } from '@/types/game'

interface LibraryZoneProps {
  player: Player
  dispatch: (action: GameAction) => void
  onContextMenu: (menu: CardContextMenuState) => void
}

export function LibraryZone({ player, dispatch, onContextMenu }: LibraryZoneProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [count, setCount] = useState(3)
  const [modal, setModal] = useState<'look' | 'scry' | 'tutor' | null>(null)
  const [query, setQuery] = useState('')
  const [scryOrderIds, setScryOrderIds] = useState<string[]>([])
  const [bottomIds, setBottomIds] = useState<string[]>([])

  const clampedCount = Math.max(1, Math.min(20, Math.floor(count)))
  const topCards = player.zones.library.slice(0, clampedCount)
  const tutorCards = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return player.zones.library
    return player.zones.library.filter(card => card.name.toLowerCase().includes(normalized))
  }, [player.zones.library, query])
  const scryCards = scryOrderIds
    .map(id => topCards.find(card => card.instanceId === id))
    .filter(card => Boolean(card)) as CardInstance[]

  function send(type: 'DRAW_CARD' | 'DRAW_X' | 'SHUFFLE_LIBRARY', count?: number) {
    dispatch({
      type,
      playerId: player.id,
      timestamp: new Date().toISOString(),
      ...(count ? { count } : {}),
    })
    setIsOpen(false)
  }

  function sendCounted(type: 'REVEAL_TOP_X' | 'MILL_X') {
    dispatch({
      type,
      playerId: player.id,
      count: clampedCount,
      timestamp: new Date().toISOString(),
    })
    setIsOpen(false)
  }

  function openModal(nextModal: 'look' | 'scry' | 'tutor') {
    setModal(nextModal)
    setScryOrderIds(nextModal === 'scry' ? topCards.map(card => card.instanceId) : [])
    setBottomIds([])
    setQuery('')
    setIsOpen(false)
  }

  function closeModal() {
    setModal(null)
    setBottomIds([])
    setQuery('')
  }

  function confirmScry() {
    dispatch({
      type: 'SCRY_X',
      playerId: player.id,
      count: clampedCount,
      topInstanceIds: scryOrderIds.filter(id => !bottomIds.includes(id)),
      bottomInstanceIds: bottomIds,
      timestamp: new Date().toISOString(),
    })
    closeModal()
  }

  function tutor(card: CardInstance) {
    dispatch({
      type: 'TUTOR',
      playerId: player.id,
      instanceId: card.instanceId,
      toZone: 'hand',
      shuffleAfter: true,
      timestamp: new Date().toISOString(),
    })
    closeModal()
  }

  function toggleBottom(card: CardInstance) {
    setBottomIds(ids =>
      ids.includes(card.instanceId)
        ? ids.filter(id => id !== card.instanceId)
        : [...ids, card.instanceId]
    )
  }

  function moveScryCard(card: CardInstance, direction: -1 | 1) {
    setScryOrderIds(ids => {
      const index = ids.indexOf(card.instanceId)
      const target = index + direction
      if (index === -1 || target < 0 || target >= ids.length) return ids
      const next = [...ids]
      next[index] = ids[target]
      next[target] = card.instanceId
      return next
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="library-stack"
        onClick={() => setIsOpen(open => !open)}
        onContextMenu={event => {
          event.preventDefault()
          setIsOpen(false)
          onContextMenu({ card: player.zones.library[0] ?? null, zone: 'libraryStack', x: event.clientX, y: event.clientY })
        }}
        aria-expanded={isOpen}
        aria-label="Open library actions"
      >
        <CardBack variant="library" count={player.zones.library.length} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-56 overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl">
          <div className="border-b border-[#30363d] bg-[#0d1117] p-3">
            <label className="flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-zinc-500">
              Count
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                className="w-16 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-right font-mono text-sm text-zinc-200"
                onChange={event => setCount(Number(event.target.value))}
              />
            </label>
          </div>
          <button type="button" className="library-menu-item" onClick={() => send('DRAW_CARD')}>
            Draw 1
          </button>
          <button type="button" className="library-menu-item" onClick={() => send('DRAW_X', 7)}>
            Draw 7
          </button>
          <button type="button" className="library-menu-item" onClick={() => send('SHUFFLE_LIBRARY')}>
            Shuffle
          </button>
          <button type="button" className="library-menu-item" onClick={() => openModal('look')}>
            Look top {clampedCount}
          </button>
          <button type="button" className="library-menu-item" onClick={() => sendCounted('REVEAL_TOP_X')}>
            Reveal top {clampedCount}
          </button>
          <button type="button" className="library-menu-item" onClick={() => openModal('scry')}>
            Scry {clampedCount}
          </button>
          <button type="button" className="library-menu-item" onClick={() => sendCounted('MILL_X')}>
            Mill {clampedCount}
          </button>
          <button type="button" className="library-menu-item" onClick={() => openModal('tutor')}>
            Tutor
          </button>
        </div>
      )}
      {modal === 'look' && (
        <LibraryModal title={`Look top ${topCards.length}`} onClose={closeModal}>
          <LibraryGrid cards={topCards} emptyText="No cards to look at." />
        </LibraryModal>
      )}
      {modal === 'scry' && (
        <LibraryModal title={`Scry ${topCards.length}`} onClose={closeModal}>
          <p className="mb-4 text-sm text-zinc-500">Reorder cards kept on top, and select cards to put on the bottom.</p>
          <LibraryGrid
            cards={scryCards}
            emptyText="No cards to scry."
            renderAction={card => (
              <div className="mt-2 grid grid-cols-3 gap-1">
                <button type="button" className="rounded border border-[#30363d] px-2 py-1 text-xs text-zinc-400" onClick={() => moveScryCard(card, -1)}>
                  Up
                </button>
                <button
                  type="button"
                  className={`rounded border px-2 py-1 text-xs ${bottomIds.includes(card.instanceId) ? 'border-[#d4a843] text-[#d4a843]' : 'border-[#30363d] text-zinc-400'}`}
                  onClick={() => toggleBottom(card)}
                >
                  {bottomIds.includes(card.instanceId) ? 'Bottom' : 'Top'}
                </button>
                <button type="button" className="rounded border border-[#30363d] px-2 py-1 text-xs text-zinc-400" onClick={() => moveScryCard(card, 1)}>
                  Down
                </button>
              </div>
            )}
          />
          <button type="button" className="mt-5 rounded-md bg-[#d4a843] px-4 py-2 text-sm font-semibold text-[#0d1117]" onClick={confirmScry}>
            Confirm scry
          </button>
        </LibraryModal>
      )}
      {modal === 'tutor' && (
        <LibraryModal title="Tutor library" onClose={closeModal}>
          <input
            type="search"
            value={query}
            className="mb-4 w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-zinc-200"
            placeholder="Search library"
            onChange={event => setQuery(event.target.value)}
          />
          <LibraryGrid
            cards={tutorCards}
            emptyText="No matching cards."
            renderAction={card => (
              <button type="button" className="mt-2 w-full rounded border border-[#d4a843]/50 px-2 py-1 text-xs text-[#d4a843]" onClick={() => tutor(card)}>
                To hand, shuffle
              </button>
            )}
          />
        </LibraryModal>
      )}
    </div>
  )
}

function LibraryModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-8">
      <section className="max-h-[82vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-4">
          <h2 className="font-serif text-lg font-semibold text-zinc-100">{title}</h2>
          <button type="button" className="rounded border border-[#30363d] px-3 py-1 text-sm text-zinc-300" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  )
}

function LibraryGrid({
  cards,
  emptyText,
  renderAction,
}: {
  cards: CardInstance[]
  emptyText: string
  renderAction?: (card: CardInstance) => ReactNode
}) {
  if (cards.length === 0) return <p className="text-sm text-zinc-600">{emptyText}</p>

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
      {cards.map(card => (
        <div key={card.instanceId}>
          <div className="zone-card">
            <CardImage cardId={card.cardId} name={card.name} />
          </div>
          <p className="mt-1 truncate text-xs text-zinc-400">{card.name}</p>
          {renderAction?.(card)}
        </div>
      ))}
    </div>
  )
}
