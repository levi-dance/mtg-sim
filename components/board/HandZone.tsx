'use client'

import { useEffect, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { CardImage } from '@/components/cards/CardImage'
import type { CardContextMenuState } from '@/components/cards/CardContextMenu'
import type { GameAction } from '@/lib/game/actions'
import type { CardInstance, Player } from '@/types/game'

interface HandZoneProps {
  player: Player
  dispatch: (action: GameAction) => void
  onPreview: (card: CardInstance | null, x?: number, y?: number) => void
  onContextMenu: (menu: CardContextMenuState) => void
}

export function HandZone({ player, dispatch, onPreview, onContextMenu }: HandZoneProps) {
  function previewFromElement(card: CardInstance, element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    onPreview(card, rect.right, rect.top + rect.height / 2)
  }

  function playCard(card: CardInstance) {
    dispatch({
      type: 'PLAY_CARD',
      playerId: player.id,
      instanceId: card.instanceId,
      fromZone: 'hand',
      x: 120 + player.zones.battlefield.length * 24,
      y: 220,
      subfieldZone: 'other',
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <section className="relative overflow-hidden rounded-lg border border-[#30363d] bg-[#0d1117]/80 px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-sm font-semibold text-zinc-200">Hand</h2>
        <span className="font-mono text-xs text-zinc-500">{player.zones.hand.length} cards</span>
      </div>
      <div className="hand-fan min-h-36 overflow-x-auto overflow-y-hidden pb-5 pt-2">
        {player.zones.hand.map(card => (
          <HandCard
            key={card.instanceId}
            card={card}
            onPlay={playCard}
            onPreview={onPreview}
            onContextMenu={onContextMenu}
            previewFromElement={previewFromElement}
          />
        ))}
        {player.zones.hand.length === 0 && (
          <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-[#30363d] text-sm text-zinc-600">
            Empty hand
          </div>
        )}
      </div>
    </section>
  )
}

function HandCard({
  card,
  onPlay,
  onPreview,
  onContextMenu,
  previewFromElement,
}: {
  card: CardInstance
  onPlay: (card: CardInstance) => void
  onPreview: (card: CardInstance | null, x?: number, y?: number) => void
  onContextMenu: (menu: CardContextMenuState) => void
  previewFromElement: (card: CardInstance, element: HTMLElement) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.instanceId,
    data: { source: 'hand' },
  })
  const ref = useRef<HTMLButtonElement | null>(null)
  const [isPointerHeld, setIsPointerHeld] = useState(false)

  useEffect(() => {
    if (isDragging) onPreview(null)
  }, [isDragging, onPreview])

  return (
    <motion.button
      ref={(node: HTMLButtonElement | null) => {
        ref.current = node
        setNodeRef(node)
      }}
      type="button"
      className={`hand-card ${isDragging ? 'dragging' : ''}`}
      whileHover={isDragging ? {} : { scale: 1.35, y: -8, zIndex: 50 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      onDoubleClick={() => onPlay(card)}
      onMouseDown={() => {
        setIsPointerHeld(true)
        onPreview(null)
      }}
      onMouseUp={() => setIsPointerHeld(false)}
      onMouseEnter={event => {
        if (!isPointerHeld && !isDragging) previewFromElement(card, event.currentTarget)
      }}
      onMouseLeave={() => {
        setIsPointerHeld(false)
        onPreview(null)
      }}
      onFocus={event => {
        if (!isPointerHeld && !isDragging) previewFromElement(card, event.currentTarget)
      }}
      onBlur={() => onPreview(null)}
      onContextMenu={event => {
        event.preventDefault()
        onPreview(null)
        onContextMenu({ card, zone: 'hand', x: event.clientX, y: event.clientY })
      }}
      title="Drag to battlefield or double-click to play"
      {...listeners}
      {...attributes}
    >
      <CardImage cardId={card.cardId} name={card.name} />
    </motion.button>
  )
}
