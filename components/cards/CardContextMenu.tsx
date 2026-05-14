'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { GameAction } from '@/lib/game/actions'
import type { BuiltInCounterType, CardInstance, Player, PlayerZones } from '@/types/game'

type CardZone = keyof PlayerZones

export interface CardContextMenuState {
  card: CardInstance | null
  zone: CardZone | 'libraryStack'
  x: number
  y: number
}

interface CardContextMenuProps {
  menu: CardContextMenuState
  player: Player
  dispatch: (action: GameAction) => void
  onClose: () => void
}

interface MenuAction {
  label: string
  run: () => void
}

const MENU_WIDTH = 184
const MENU_GAP = 12

export function CardContextMenu({ menu, player, dispatch, onClose }: CardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const sourceZone = menu.zone === 'libraryStack' ? 'library' : menu.zone
  const topLibraryCard = player.zones.library[0] ?? null
  const card = menu.card ?? (menu.zone === 'libraryStack' ? topLibraryCard : null)

  const position = useMemo(() => {
    if (typeof window === 'undefined') return { left: menu.x, top: menu.y }
    return {
      left: Math.min(menu.x, window.innerWidth - MENU_WIDTH - MENU_GAP),
      top: Math.min(menu.y, window.innerHeight - 260),
    }
  }, [menu.x, menu.y])

  useEffect(() => {
    const element = menuRef.current
    if (!element) return

    element.style.setProperty('--menu-left', `${position.left}px`)
    element.style.setProperty('--menu-top', `${Math.max(MENU_GAP, position.top)}px`)
  }, [position.left, position.top])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function closeAfter(run: () => void) {
    run()
    onClose()
  }

  function dispatchMove(toZone: CardZone, x = 120, y = 220) {
    if (!card) return
    dispatch({
      type: 'MOVE_CARD',
      playerId: player.id,
      instanceId: card.instanceId,
      fromZone: sourceZone,
      toZone,
      x,
      y,
      timestamp: new Date().toISOString(),
    })
  }

  function dispatchPlay() {
    if (!card) return
    if (sourceZone === 'commandZone' && typeof card.commanderCastCount === 'number') {
      dispatch({
        type: 'CAST_COMMANDER',
        playerId: player.id,
        instanceId: card.instanceId,
        x: 120 + player.zones.battlefield.length * 24,
        y: 220,
        timestamp: new Date().toISOString(),
      })
      return
    }

    dispatch({
      type: 'PLAY_CARD',
      playerId: player.id,
      instanceId: card.instanceId,
      fromZone: sourceZone === 'commandZone' ? 'commandZone' : 'hand',
      x: 120 + player.zones.battlefield.length * 24,
      y: 220,
      subfieldZone: 'other',
      timestamp: new Date().toISOString(),
    })
  }

  function dispatchCounter(type: 'ADD_COUNTER' | 'REMOVE_COUNTER', counterType: BuiltInCounterType | 'custom', label?: string) {
    if (!card) return
    dispatch({
      type,
      playerId: player.id,
      instanceId: card.instanceId,
      counterType,
      label,
      amount: 1,
      timestamp: new Date().toISOString(),
    })
  }

  function dispatchCustomCounter() {
    const label = window.prompt('Counter name')
    if (!label?.trim()) return
    dispatchCounter('ADD_COUNTER', 'custom', label.trim())
  }

  function dispatchDamage(amount: number) {
    if (!card) return
    dispatch({
      type: 'MARK_DAMAGE',
      playerId: player.id,
      instanceId: card.instanceId,
      amount,
      timestamp: new Date().toISOString(),
    })
  }

  const actions: MenuAction[] = []

  if (menu.zone === 'libraryStack') {
    actions.push(
      {
        label: 'Draw top card',
        run: () => dispatch({
          type: 'DRAW_CARD',
          playerId: player.id,
          timestamp: new Date().toISOString(),
        }),
      },
      {
        label: 'Shuffle library',
        run: () => dispatch({
          type: 'SHUFFLE_LIBRARY',
          playerId: player.id,
          timestamp: new Date().toISOString(),
        }),
      }
    )
  }

  if (card) {
    if (sourceZone === 'hand' || sourceZone === 'commandZone') {
      actions.push({
        label: sourceZone === 'commandZone' && typeof card.commanderCastCount === 'number'
          ? 'Cast commander'
          : 'Play to battlefield',
        run: dispatchPlay,
      })
    }

    if (sourceZone === 'battlefield') {
      actions.push({
        label: card.tapped ? 'Untap' : 'Tap',
        run: () => dispatch({
          type: card.tapped ? 'UNTAP_CARD' : 'TAP_CARD',
          playerId: player.id,
          instanceId: card.instanceId,
          timestamp: new Date().toISOString(),
        }),
      })
      actions.push(
        { label: 'Add +1/+1 counter', run: () => dispatchCounter('ADD_COUNTER', 'plusOne') },
        { label: 'Remove +1/+1 counter', run: () => dispatchCounter('REMOVE_COUNTER', 'plusOne') },
        { label: 'Add -1/-1 counter', run: () => dispatchCounter('ADD_COUNTER', 'minusOne') },
        { label: 'Remove -1/-1 counter', run: () => dispatchCounter('REMOVE_COUNTER', 'minusOne') },
        { label: 'Add loyalty counter', run: () => dispatchCounter('ADD_COUNTER', 'loyalty') },
        { label: 'Remove loyalty counter', run: () => dispatchCounter('REMOVE_COUNTER', 'loyalty') },
        { label: 'Add custom counter', run: dispatchCustomCounter },
        ...(card.counters.custom ?? []).map(counter => ({
          label: `Remove ${counter.label}`,
          run: () => dispatchCounter('REMOVE_COUNTER', 'custom', counter.label),
        })),
        { label: 'Mark 1 damage', run: () => dispatchDamage(1) },
        { label: 'Remove 1 damage', run: () => dispatchDamage(-1) },
        {
          label: 'Clear marked damage',
          run: () => dispatch({
            type: 'CLEAR_DAMAGE',
            playerId: player.id,
            instanceId: card.instanceId,
            timestamp: new Date().toISOString(),
          }),
        }
      )
    }

    if (sourceZone !== 'hand') actions.push({ label: 'Move to hand', run: () => dispatchMove('hand') })
    if (sourceZone !== 'graveyard') actions.push({ label: 'Move to graveyard', run: () => dispatchMove('graveyard') })
    if (sourceZone !== 'exile') actions.push({ label: 'Move to exile', run: () => dispatchMove('exile') })
    if (sourceZone !== 'library') actions.push({ label: 'Put into library', run: () => dispatchMove('library') })
    if (sourceZone !== 'battlefield') {
      actions.push({
        label: 'Move to battlefield',
        run: () => dispatchMove('battlefield', 120 + player.zones.battlefield.length * 24, 220),
      })
    }
    if (typeof card.commanderCastCount === 'number' && sourceZone !== 'commandZone') {
      actions.push({ label: 'Move to command zone', run: () => dispatchMove('commandZone') })
    }
  }

  return (
    <div className="fixed inset-0 z-[140]" onMouseDown={onClose}>
      <div
        ref={menuRef}
        className="card-context-menu"
        role="menu"
        aria-label={card ? `${card.name} actions` : 'Library actions'}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="border-b border-[#30363d] px-3 py-2">
          <p className="truncate font-serif text-sm font-semibold text-zinc-100">{card?.name ?? 'Library'}</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">{sourceZone}</p>
        </div>
        <div className="py-1">
          {actions.map(action => (
            <button
              key={action.label}
              type="button"
              className="card-context-menu-item"
              role="menuitem"
              onClick={() => closeAfter(action.run)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
