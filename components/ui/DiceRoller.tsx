'use client'

import { useState } from 'react'
import type { GameAction } from '@/lib/game/actions'
import type { Player } from '@/types/game'

const STANDARD_DICE = [4, 6, 8, 10, 12, 20]

function rollResult(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

function coinFlipResult(): 'heads' | 'tails' {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

interface Props {
  player: Player
  dispatch: (action: GameAction) => void
}

export function DiceRoller({ player, dispatch }: Props) {
  const [lastRoll, setLastRoll] = useState<{ sides: number; result: number } | null>(null)
  const [lastFlip, setLastFlip] = useState<'heads' | 'tails' | null>(null)
  const [customSides, setCustomSides] = useState('')

  function rollDice(sides: number) {
    const result = rollResult(sides)
    setLastRoll({ sides, result })
    setLastFlip(null)
    dispatch({
      type: 'ROLL_DICE',
      playerId: player.id,
      sides,
      result,
      timestamp: new Date().toISOString(),
    })
  }

  function flipCoin() {
    const result = coinFlipResult()
    setLastFlip(result)
    setLastRoll(null)
    dispatch({
      type: 'FLIP_COIN',
      playerId: player.id,
      result,
      timestamp: new Date().toISOString(),
    })
  }

  function handleCustomRoll() {
    const sides = parseInt(customSides, 10)
    if (sides >= 2) rollDice(sides)
  }

  return (
    <section className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h2 className="mb-3 font-serif text-sm font-semibold text-zinc-100">Dice &amp; Coin</h2>

      {(lastRoll || lastFlip) && (
        <div className="mb-3 rounded bg-[#0d1117] px-3 py-2 text-center">
          {lastRoll && (
            <>
              <span className="block font-mono text-3xl font-bold text-[#d4a843]">{lastRoll.result}</span>
              <span className="text-xs uppercase tracking-wider text-zinc-500">d{lastRoll.sides}</span>
            </>
          )}
          {lastFlip && (
            <>
              <span className={`block font-mono text-2xl font-bold ${lastFlip === 'heads' ? 'text-[#d4a843]' : 'text-zinc-300'}`}>
                {lastFlip === 'heads' ? 'Heads' : 'Tails'}
              </span>
              <span className="text-xs uppercase tracking-wider text-zinc-500">coin flip</span>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {STANDARD_DICE.map(sides => (
          <button
            key={sides}
            type="button"
            className="rounded border border-[#30363d] py-2 text-center font-mono text-sm text-zinc-200 transition hover:border-[#d4a843]/60 hover:text-[#d4a843]"
            onClick={() => rollDice(sides)}
          >
            d{sides}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          type="number"
          min={2}
          value={customSides}
          onChange={event => setCustomSides(event.target.value)}
          placeholder="Custom"
          className="min-w-0 flex-1 rounded border border-[#30363d] bg-[#0d1117] px-2 py-2 font-mono text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#d4a843]/40"
          onKeyDown={event => { if (event.key === 'Enter') handleCustomRoll() }}
        />
        <button
          type="button"
          className="rounded border border-[#30363d] px-3 py-2 font-mono text-sm text-zinc-200 transition hover:border-[#d4a843]/60 disabled:opacity-40"
          onClick={handleCustomRoll}
          disabled={!customSides || parseInt(customSides, 10) < 2}
        >
          Roll
        </button>
      </div>

      <button
        type="button"
        className="mt-2 w-full rounded border border-[#30363d] py-2 text-sm text-zinc-300 transition hover:border-[#d4a843]/60"
        onClick={flipCoin}
      >
        Flip Coin
      </button>
    </section>
  )
}
