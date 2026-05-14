'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { CardImage } from '@/components/cards/CardImage'
import { RadialWheel } from '@/components/cards/RadialWheel'
import { SelectionBox, type SelectionRect } from '@/components/cards/SelectionBox'
import type { GameAction } from '@/lib/game/actions'
import type { BuiltInCounterType, CardCounters, CardInstance, Player, TokenInstance } from '@/types/game'

interface BattlefieldZoneProps {
  player: Player
  tokens: TokenInstance[]
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  groupDrag: { activeId: string; ids: string[]; deltaX: number; deltaY: number } | null
  dispatch: (action: GameAction) => void
  onPreview: (card: CardInstance | null, x?: number, y?: number) => void
}

const CARD_WIDTH = 99.2
const CARD_HEIGHT = 139.2
const MIN_SELECTION_SIZE = 6

type CounterBadge = {
  label: string
  value: number
  className: string
  counterType: BuiltInCounterType | 'custom'
}

type BadgeMenuState =
  | { kind: 'counter'; badge: CounterBadge; x: number; y: number }
  | { kind: 'damage'; value: number; x: number; y: number }

function counterBadges(counters: Partial<CardCounters> | Record<string, never>): CounterBadge[] {
  return [
    { label: '+1/+1', value: counters.plusOne ?? 0, className: 'positive', counterType: 'plusOne' as const },
    { label: '-1/-1', value: counters.minusOne ?? 0, className: 'negative', counterType: 'minusOne' as const },
    { label: 'LOY', value: counters.loyalty ?? 0, className: 'loyalty', counterType: 'loyalty' as const },
    ...(counters.custom ?? []).map(counter => ({
      label: counter.label,
      value: counter.value,
      className: 'custom',
      counterType: 'custom' as const,
    })),
  ].filter(counter => counter.value > 0)
}

export function BattlefieldZone({ player, tokens = [], selectedIds, setSelectedIds, groupDrag, dispatch, onPreview }: BattlefieldZoneProps) {
  const zoneRef = useRef<HTMLElement | null>(null)
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ id: 'battlefield-drop-zone' })
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
  const [wheelPoint, setWheelPoint] = useState<{ x: number; y: number } | null>(null)
  const [tokenMenu, setTokenMenu] = useState<{ token: TokenInstance; x: number; y: number } | null>(null)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setSelectedIds([])
      setSelectionStart(null)
      setSelectionRect(null)
      setWheelPoint(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSelectedIds])

  function pointInZone(event: ReactPointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function rectFromPoints(start: { x: number; y: number }, end: { x: number; y: number }): SelectionRect {
    return {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    }
  }

  function intersectsSelection(card: CardInstance, rect: SelectionRect) {
    const cardLeft = card.x ?? 0
    const cardTop = card.y ?? 0
    const cardRight = cardLeft + CARD_WIDTH
    const cardBottom = cardTop + CARD_HEIGHT
    return (
      cardLeft < rect.left + rect.width &&
      cardRight > rect.left &&
      cardTop < rect.top + rect.height &&
      cardBottom > rect.top
    )
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.battlefield-card')) return

    const point = pointInZone(event)
    setWheelPoint(null)
    setSelectedIds([])
    setSelectionStart(point)
    setSelectionRect({ left: point.x, top: point.y, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!selectionStart) return

    const rect = rectFromPoints(selectionStart, pointInZone(event))
    setSelectionRect(rect)
    setSelectedIds(
      player.zones.battlefield
        .filter(card => intersectsSelection(card, rect))
        .map(card => card.instanceId)
    )
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (!selectionStart || !selectionRect) return

    if (selectionRect.width < MIN_SELECTION_SIZE && selectionRect.height < MIN_SELECTION_SIZE) {
      setSelectedIds([])
    }
    setSelectionStart(null)
    setSelectionRect(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function openWheel(x: number, y: number, ids = selectedIds) {
    if (ids.length === 0) return
    onPreview(null)
    setSelectedIds(ids)
    setTokenMenu(null)
    setWheelPoint({ x, y })
  }

  function clearSelection() {
    setSelectedIds([])
    setWheelPoint(null)
  }

  return (
    <section
        ref={node => {
          zoneRef.current = node
          setDroppableNodeRef(node)
        }}
        className={`battlefield-zone ${isOver ? 'drop-target' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          setSelectionStart(null)
          setSelectionRect(null)
        }}
        onContextMenu={event => {
          if (selectedIds.length === 0) return
          event.preventDefault()
          openWheel(event.clientX, event.clientY)
        }}
    >
        <div className="battlefield-lane top">
          <span>Other permanents</span>
        </div>
        <div className="battlefield-lane middle">
          <span>Creatures</span>
        </div>
        <div className="battlefield-lane bottom">
          <span>Lands</span>
        </div>

        {player.zones.battlefield.map(card => (
          <DraggablePermanent
            key={card.instanceId}
            card={card}
            selected={selectedSet.has(card.instanceId)}
            selectedCount={selectedIds.length}
            player={player}
            dispatch={dispatch}
            groupDrag={groupDrag}
            onPreview={onPreview}
            onOpenWheel={openWheel}
          />
        ))}
        {tokens.map(token => (
          <DraggableToken
            key={token.instanceId}
            token={token}
            dispatch={dispatch}
            onOpenMenu={(x, y) => {
              onPreview(null)
              setWheelPoint(null)
              setTokenMenu({ token, x, y })
            }}
          />
        ))}
        {selectionRect && <SelectionBox rect={selectionRect} />}
        <AnimatePresence>
          {wheelPoint && selectedIds.length > 0 && (
            <RadialWheel
              key="radial-wheel"
              x={wheelPoint.x}
              y={wheelPoint.y}
              selectedIds={selectedIds}
              player={player}
              dispatch={dispatch}
              onClose={clearSelection}
            />
          )}
        </AnimatePresence>
        {tokenMenu && (
          <TokenPermanentMenu
            token={tokenMenu.token}
            x={tokenMenu.x}
            y={tokenMenu.y}
            player={player}
            dispatch={dispatch}
            onClose={() => setTokenMenu(null)}
          />
        )}
    </section>
  )
}

function DraggablePermanent({
  card,
  selected,
  selectedCount,
  player,
  dispatch,
  groupDrag,
  onPreview,
  onOpenWheel,
}: {
  card: CardInstance
  selected: boolean
  selectedCount: number
  player: Player
  dispatch: (action: GameAction) => void
  groupDrag: { activeId: string; ids: string[]; deltaX: number; deltaY: number } | null
  onPreview: (card: CardInstance | null, x?: number, y?: number) => void
  onOpenWheel: (x: number, y: number, ids?: string[]) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.instanceId,
    data: { source: 'battlefield' },
  })
  const elementRef = useRef<HTMLButtonElement | null>(null)
  const [isPointerHeld, setIsPointerHeld] = useState(false)
  const [badgeMenu, setBadgeMenu] = useState<BadgeMenuState | null>(null)
  const badges = counterBadges(card.counters)

  function previewFromElement(element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    onPreview(card, rect.right, rect.top + rect.height / 2)
  }

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.style.setProperty('--card-x', `${card.x ?? 0}px`)
    element.style.setProperty('--card-y', `${card.y ?? 0}px`)
    const draggedWithGroup = groupDrag && groupDrag.activeId !== card.instanceId && groupDrag.ids.includes(card.instanceId)
    element.style.setProperty('--drag-x', `${draggedWithGroup ? groupDrag.deltaX : (transform?.x ?? 0)}px`)
    element.style.setProperty('--drag-y', `${draggedWithGroup ? groupDrag.deltaY : (transform?.y ?? 0)}px`)
    element.style.setProperty('--card-z', `${card.zIndex ?? 1}`)
  }, [card.instanceId, card.x, card.y, card.zIndex, groupDrag, transform?.x, transform?.y])

  useEffect(() => {
    if (isDragging) onPreview(null)
  }, [isDragging, onPreview])

  function openBadgeMenu(event: ReactPointerEvent<HTMLElement>, menu: BadgeMenuState) {
    event.preventDefault()
    event.stopPropagation()
    onPreview(null)
    setIsPointerHeld(false)
    setBadgeMenu(menu)
  }

  return (
    <>
      <button
        ref={node => {
          elementRef.current = node
          setNodeRef(node)
        }}
        type="button"
        data-instance-id={card.instanceId}
        className={`battlefield-card ${card.tapped ? 'tapped' : ''} ${isDragging ? 'dragging' : ''} ${selected ? 'selected' : ''}`}
        onMouseDown={() => {
          setIsPointerHeld(true)
          onPreview(null)
        }}
        onMouseUp={() => setIsPointerHeld(false)}
        onMouseEnter={event => {
          if (!isPointerHeld && !isDragging) previewFromElement(event.currentTarget)
        }}
        onMouseLeave={() => {
          setIsPointerHeld(false)
          onPreview(null)
        }}
        onFocus={event => {
          if (!isPointerHeld && !isDragging) previewFromElement(event.currentTarget)
        }}
        onBlur={() => onPreview(null)}
        onContextMenu={event => {
          event.preventDefault()
          event.stopPropagation()
          onPreview(null)
          if (selected && selectedCount > 0) {
            onOpenWheel(event.clientX, event.clientY)
            return
          }
          onOpenWheel(event.clientX, event.clientY, [card.instanceId])
        }}
        {...listeners}
        {...attributes}
      >
        <motion.span
          className="battlefield-card-visual"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1, rotate: card.tapped ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        >
          <span className="battlefield-card-frame">
            <CardImage cardId={card.cardId} name={card.name} />
          </span>
          {(badges.length > 0 || card.markedDamage > 0) && (
            <span className="battlefield-card-badges" aria-label="Card counters and damage">
              {badges.map(counter => (
                <span
                  key={`${counter.label}-${counter.className}`}
                  className={`battlefield-card-badge ${counter.className}`}
                  role="button"
                  tabIndex={0}
                  onPointerDown={event => openBadgeMenu(event, { kind: 'counter', badge: counter, x: event.clientX, y: event.clientY })}
                >
                  {counter.label} {counter.value}
                </span>
              ))}
              {card.markedDamage > 0 && (
                <span
                  className="battlefield-card-badge damage"
                  role="button"
                  tabIndex={0}
                  onPointerDown={event => openBadgeMenu(event, { kind: 'damage', value: card.markedDamage, x: event.clientX, y: event.clientY })}
                >
                  DMG {card.markedDamage}
                </span>
              )}
            </span>
          )}
        </motion.span>
      </button>
      {badgeMenu && (
        <CounterBadgeMenu
          card={card}
          menu={badgeMenu}
          player={player}
          dispatch={dispatch}
          onClose={() => setBadgeMenu(null)}
        />
      )}
    </>
  )
}

function CounterBadgeMenu({
  card,
  menu,
  player,
  dispatch,
  onClose,
}: {
  card: CardInstance
  menu: BadgeMenuState
  player: Player
  dispatch: (action: GameAction) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.setProperty('--menu-left', `${Math.min(menu.x, window.innerWidth - 196)}px`)
    element.style.setProperty('--menu-top', `${Math.min(menu.y, window.innerHeight - 220)}px`)
  }, [menu.x, menu.y])

  function runFromPointer(event: ReactPointerEvent<HTMLButtonElement>, run: () => void) {
    event.preventDefault()
    event.stopPropagation()
    run()
    onClose()
  }

  function send(action: { type: GameAction['type'] } & Record<string, unknown>) {
    dispatch({
      ...action,
      playerId: player.id,
      timestamp: new Date().toISOString(),
    } as GameAction)
  }

  const actions = menu.kind === 'counter'
    ? [
        { label: '+1', run: () => send({ type: 'ADD_COUNTER', instanceId: card.instanceId, counterType: menu.badge.counterType, label: menu.badge.counterType === 'custom' ? menu.badge.label : undefined, amount: 1 }) },
        { label: '-1', run: () => send({ type: 'REMOVE_COUNTER', instanceId: card.instanceId, counterType: menu.badge.counterType, label: menu.badge.counterType === 'custom' ? menu.badge.label : undefined, amount: 1 }) },
        { label: 'Double', run: () => send({ type: 'ADD_COUNTER', instanceId: card.instanceId, counterType: menu.badge.counterType, label: menu.badge.counterType === 'custom' ? menu.badge.label : undefined, amount: menu.badge.value }) },
        { label: 'Remove', run: () => send({ type: 'REMOVE_COUNTER', instanceId: card.instanceId, counterType: menu.badge.counterType, label: menu.badge.counterType === 'custom' ? menu.badge.label : undefined, amount: menu.badge.value }) },
      ]
    : [
        { label: '+1', run: () => send({ type: 'MARK_DAMAGE', instanceId: card.instanceId, amount: 1 }) },
        { label: '-1', run: () => send({ type: 'MARK_DAMAGE', instanceId: card.instanceId, amount: -1 }) },
        { label: 'Double', run: () => send({ type: 'MARK_DAMAGE', instanceId: card.instanceId, amount: menu.value }) },
        { label: 'Clear', run: () => send({ type: 'CLEAR_DAMAGE', instanceId: card.instanceId }) },
      ]

  return (
    <div className="fixed inset-0 z-[140]" onMouseDown={onClose}>
      <div ref={ref} className="card-context-menu" role="menu" aria-label={`${card.name} badge actions`} onMouseDown={event => event.stopPropagation()}>
        <div className="border-b border-[#30363d] px-3 py-2">
          <p className="truncate font-serif text-sm font-semibold text-zinc-100">
            {menu.kind === 'counter' ? `${menu.badge.label} ${menu.badge.value}` : `DMG ${menu.value}`}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">{card.name}</p>
        </div>
        <div className="py-1">
          {actions.map(action => (
            <button
              key={action.label}
              type="button"
              className="card-context-menu-item"
              role="menuitem"
              onPointerDown={event => runFromPointer(event, action.run)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function DraggableToken({
  token,
  dispatch,
  onOpenMenu,
}: {
  token: TokenInstance
  dispatch: (action: GameAction) => void
  onOpenMenu: (x: number, y: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: token.instanceId,
    data: { source: 'token' },
  })
  const elementRef = useRef<HTMLButtonElement | null>(null)
  const badges = counterBadges(token.counters)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.style.setProperty('--card-x', `${token.x}px`)
    element.style.setProperty('--card-y', `${token.y}px`)
    element.style.setProperty('--drag-x', `${transform?.x ?? 0}px`)
    element.style.setProperty('--drag-y', `${transform?.y ?? 0}px`)
    element.style.setProperty('--card-z', `${token.zIndex ?? 1}`)
  }, [token.x, token.y, token.zIndex, transform?.x, transform?.y])

  return (
    <button
      ref={node => {
        elementRef.current = node
        setNodeRef(node)
      }}
      type="button"
      data-instance-id={token.instanceId}
      className={`battlefield-card token ${token.tapped ? 'tapped' : ''} ${isDragging ? 'dragging' : ''}`}
      onDoubleClick={() => {
        dispatch({
          type: token.tapped ? 'UNTAP_TOKEN' : 'TAP_TOKEN',
          playerId: token.ownerId,
          instanceId: token.instanceId,
          timestamp: new Date().toISOString(),
        })
      }}
      onContextMenu={event => {
        event.preventDefault()
        event.stopPropagation()
        onOpenMenu(event.clientX, event.clientY)
      }}
      {...listeners}
      {...attributes}
    >
      <span className="battlefield-card-visual">
        <span className="battlefield-card-frame token-frame">
          <CardImage cardId={token.cardId} name={token.name} />
        </span>
        <span className="token-label">{token.name}</span>
        {(badges.length > 0 || token.markedDamage > 0) && (
          <span className="battlefield-card-badges" aria-label="Token counters and damage">
            {badges.map(counter => (
              <span key={`${counter.label}-${counter.className}`} className={`battlefield-card-badge ${counter.className}`}>
                {counter.label} {counter.value}
              </span>
            ))}
            {token.markedDamage > 0 && (
              <span className="battlefield-card-badge damage">DMG {token.markedDamage}</span>
            )}
          </span>
        )}
      </span>
    </button>
  )
}

function TokenPermanentMenu({
  token,
  x,
  y,
  player,
  dispatch,
  onClose,
}: {
  token: TokenInstance
  x: number
  y: number
  player: Player
  dispatch: (action: GameAction) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.setProperty('--menu-left', `${Math.min(x, window.innerWidth - 196)}px`)
    element.style.setProperty('--menu-top', `${Math.min(y, window.innerHeight - 320)}px`)
  }, [x, y])

  function runFromPointer(event: ReactPointerEvent<HTMLButtonElement>, run: () => void) {
    event.preventDefault()
    event.stopPropagation()
    run()
    onClose()
  }

  function send(action: { type: GameAction['type'] } & Record<string, unknown>) {
    dispatch({
      ...action,
      playerId: player.id,
      timestamp: new Date().toISOString(),
    } as GameAction)
  }

  function counter(type: 'ADD_COUNTER' | 'REMOVE_COUNTER', counterType: BuiltInCounterType | 'custom', label?: string) {
    send({ type, instanceId: token.instanceId, counterType, label, amount: 1 })
  }

  function customCounter() {
    const label = window.prompt('Counter name')
    if (!label?.trim()) return
    counter('ADD_COUNTER', 'custom', label.trim())
  }

  return (
    <div className="fixed inset-0 z-[140]" onMouseDown={onClose}>
      <div ref={ref} className="card-context-menu" role="menu" aria-label={`${token.name} token actions`} onMouseDown={event => event.stopPropagation()}>
        <div className="border-b border-[#30363d] px-3 py-2">
          <p className="truncate font-serif text-sm font-semibold text-zinc-100">{token.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">token</p>
        </div>
        <div className="py-1">
          {[
            { label: token.tapped ? 'Untap token' : 'Tap token', run: () => send({ type: token.tapped ? 'UNTAP_TOKEN' : 'TAP_TOKEN', instanceId: token.instanceId }) },
            { label: 'Add +1/+1 counter', run: () => counter('ADD_COUNTER', 'plusOne') },
            { label: 'Remove +1/+1 counter', run: () => counter('REMOVE_COUNTER', 'plusOne') },
            { label: 'Add -1/-1 counter', run: () => counter('ADD_COUNTER', 'minusOne') },
            { label: 'Remove -1/-1 counter', run: () => counter('REMOVE_COUNTER', 'minusOne') },
            { label: 'Add custom counter', run: customCounter },
            ...(token.counters.custom ?? []).map(counterItem => ({
              label: `Remove ${counterItem.label}`,
              run: () => counter('REMOVE_COUNTER', 'custom', counterItem.label),
            })),
            { label: 'Mark 1 damage', run: () => send({ type: 'MARK_DAMAGE', instanceId: token.instanceId, amount: 1 }) },
            { label: 'Remove 1 damage', run: () => send({ type: 'MARK_DAMAGE', instanceId: token.instanceId, amount: -1 }) },
            { label: 'Clear marked damage', run: () => send({ type: 'CLEAR_DAMAGE', instanceId: token.instanceId }) },
            { label: 'Remove token', run: () => send({ type: 'REMOVE_TOKEN', instanceId: token.instanceId }) },
          ].map(action => (
            <button
              key={action.label}
              type="button"
              className="card-context-menu-item"
              role="menuitem"
              onPointerDown={event => runFromPointer(event, action.run)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
