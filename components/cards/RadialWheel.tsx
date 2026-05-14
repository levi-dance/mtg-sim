'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import type { GameAction } from '@/lib/game/actions'
import type { BuiltInCounterType, Player } from '@/types/game'

interface RadialWheelProps {
  x: number
  y: number
  selectedIds: string[]
  player: Player
  dispatch: (action: GameAction) => void
  onClose: () => void
}

export function RadialWheel({ x, y, selectedIds, player, dispatch, onClose }: RadialWheelProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [menu, setMenu] = useState<'root' | 'counters' | 'damage' | 'move'>('root')
  const selectedCards = player.zones.battlefield.filter(card => selectedIds.includes(card.instanceId))
  const canMoveToCommandZone = selectedCards.length > 0 && selectedCards.every(card => typeof card.commanderCastCount === 'number')

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const menuExtent = 228
    element.style.setProperty('--wheel-left', `${Math.min(Math.max(x, menuExtent), window.innerWidth - menuExtent)}px`)
    element.style.setProperty('--wheel-top', `${Math.min(Math.max(y, menuExtent), window.innerHeight - menuExtent)}px`)
  }, [x, y])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function send(action: Omit<Extract<GameAction, { type: 'MULTI_SELECT_ACTION' }>, 'playerId' | 'timestamp'>) {
    dispatch({
      ...action,
      playerId: player.id,
      timestamp: new Date().toISOString(),
    })
    onClose()
  }

  function counter(operation: 'addCounter' | 'removeCounter', counterType: BuiltInCounterType | 'custom', label?: string) {
    send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation, counterType, label, amount: 1 })
  }

  function addCustomCounter() {
    const label = window.prompt('Counter name')
    if (!label?.trim()) return
    counter('addCounter', 'custom', label.trim())
  }

  const rootActions: RadialAction[] = [
    {
      label: 'Tap',
      position: 'slot0',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'tap' }),
    },
    {
      label: 'Untap',
      position: 'slot1',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'untap' }),
    },
    {
      label: 'Counters',
      position: 'slot2',
      run: () => setMenu('counters'),
    },
    {
      label: 'Damage',
      position: 'slot3',
      run: () => setMenu('damage'),
    },
    {
      label: 'Move',
      position: 'slot4',
      run: () => setMenu('move'),
    },
    {
      label: 'Clear',
      position: 'slot5',
      run: onClose,
    },
  ]

  const counterActions: RadialAction[] = [
    { label: '+1/+1', position: 'slot0', run: () => counter('addCounter', 'plusOne') },
    { label: '-1/-1', position: 'slot1', run: () => counter('addCounter', 'minusOne') },
    { label: 'Loyalty', position: 'slot2', run: () => counter('addCounter', 'loyalty') },
    { label: 'Custom', position: 'slot3', run: addCustomCounter },
  ]

  const damageActions: RadialAction[] = [
    {
      label: 'Damage +1',
      position: 'slot0',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'markDamage', amount: 1 }),
    },
    {
      label: 'Damage -1',
      position: 'slot1',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'markDamage', amount: -1 }),
    },
    {
      label: 'Clear damage',
      position: 'slot2',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'clearDamage' }),
    },
  ]

  const moveActions: RadialAction[] = [
    {
      label: 'Graveyard',
      position: 'slot0',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'move', toZone: 'graveyard' }),
    },
    {
      label: 'Exile',
      position: 'slot1',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'move', toZone: 'exile' }),
    },
    {
      label: 'Hand',
      position: 'slot2',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'move', toZone: 'hand' }),
    },
    {
      label: 'Library',
      position: 'slot3',
      run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'move', toZone: 'library' }),
    },
    ...(canMoveToCommandZone
      ? [{
          label: 'Command',
          position: 'slot4',
          run: () => send({ type: 'MULTI_SELECT_ACTION', instanceIds: selectedIds, operation: 'move', toZone: 'commandZone' }),
        }]
      : []),
  ]

  const actions = menu === 'counters' ? counterActions : menu === 'damage' ? damageActions : menu === 'move' ? moveActions : rootActions
  const menuItems: RadialAction[] = [
    ...actions,
    {
      label: menu === 'root' ? 'Close' : 'Back',
      run: menu === 'root' ? onClose : () => setMenu('root'),
      isClose: true,
    },
  ]

  function runFromPointer(event: ReactPointerEvent<HTMLButtonElement>, run: () => void) {
    event.preventDefault()
    event.stopPropagation()
    run()
  }

  return (
    <div className="fixed inset-0 z-[130]" onPointerDown={onClose}>
      <motion.div
        ref={ref}
        className="radial-wheel"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        onPointerDown={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="radial-wheel-core"
          onPointerDown={event => runFromPointer(event, () => setMenu('root'))}
          aria-label={menu === 'root' ? `${selectedIds.length} selected` : 'Back to radial actions'}
        >
          {menu === 'root' ? selectedIds.length : 'Back'}
        </button>
        {menuItems.map((action, index) => (
          <RadialWheelButton
            key={action.label}
            action={action}
            index={index}
            total={menuItems.length}
            onPointerDown={runFromPointer}
          />
        ))}
      </motion.div>
    </div>
  )
}

type RadialAction = {
  label: string
  run: () => void
  position?: string
  isClose?: boolean
}

function RadialWheelButton({
  action,
  index,
  total,
  onPointerDown,
}: {
  action: RadialAction
  index: number
  total: number
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, run: () => void) => void
}) {
  const ref = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const angle = action.isClose ? 90 : 90 + (360 / total) * (index + 1)
    element.style.setProperty('--item-angle', `${angle}deg`)
  }, [action.isClose, index, total])

  return (
    <button
      ref={ref}
      type="button"
      className={`radial-wheel-item ${action.isClose ? 'close' : ''}`}
      onPointerDown={event => onPointerDown(event, action.run)}
    >
      {action.label}
    </button>
  )
}
