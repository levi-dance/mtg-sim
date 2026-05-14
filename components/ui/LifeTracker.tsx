'use client'

import type { GameAction } from '@/lib/game/actions'
import type { Player } from '@/types/game'

interface LifeTrackerProps {
  player: Player
  dispatch: (action: GameAction) => void
}

export function LifeTracker({ player, dispatch }: LifeTrackerProps) {
  function setLife(life: number) {
    dispatch({
      type: 'SET_LIFE',
      playerId: player.id,
      life,
      timestamp: new Date().toISOString(),
    })
  }

  function setPoison(poisonCounters: number) {
    dispatch({
      type: 'SET_POISON',
      playerId: player.id,
      poisonCounters,
      timestamp: new Date().toISOString(),
    })
  }

  function setEnergy(energyCounters: number) {
    dispatch({
      type: 'SET_ENERGY',
      playerId: player.id,
      energyCounters,
      timestamp: new Date().toISOString(),
    })
  }

  function setExperience(experienceCounters: number) {
    dispatch({
      type: 'SET_EXPERIENCE',
      playerId: player.id,
      experienceCounters,
      timestamp: new Date().toISOString(),
    })
  }

  function concede() {
    dispatch({
      type: 'PLAYER_CONCEDE',
      playerId: player.id,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <section className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <h2 className="mb-3 font-serif text-sm font-semibold text-zinc-100">Player Totals</h2>
      <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-center">
        <p className="font-mono text-5xl font-bold leading-none text-zinc-100">{player.stats.life}</p>
        <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">Life</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[-5, -1, 1, 5].map(delta => (
            <button
              key={delta}
              type="button"
              className="rounded border border-[#30363d] bg-[#161b22] px-2 py-1 font-mono text-sm text-zinc-200 transition hover:border-[#d4a843]/60"
              onClick={() => setLife(player.stats.life + delta)}
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Poison</span>
          <span className="font-mono text-xl font-semibold text-green-400">{player.stats.poisonCounters}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded border border-[#30363d] px-2 py-1 text-sm text-zinc-200 transition hover:border-green-500/60"
            onClick={() => setPoison(Math.max(0, player.stats.poisonCounters - 1))}
          >
            -1
          </button>
          <button
            type="button"
            className="rounded border border-[#30363d] px-2 py-1 text-sm text-zinc-200 transition hover:border-green-500/60"
            onClick={() => setPoison(player.stats.poisonCounters + 1)}
          >
            +1
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <CounterStepper
          label="Energy"
          value={player.stats.energyCounters}
          colorClass="text-cyan-300"
          onChange={setEnergy}
        />
        <CounterStepper
          label="Experience"
          value={player.stats.experienceCounters}
          colorClass="text-[#d4a843]"
          onChange={setExperience}
        />
      </div>

      <button
        type="button"
        className="mt-3 w-full rounded border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400/70"
        onClick={concede}
      >
        Concede
      </button>
    </section>
  )
}

function CounterStepper({
  label,
  value,
  colorClass,
  onChange,
}: {
  label: string
  value: number
  colorClass: string
  onChange: (value: number) => void
}) {
  return (
    <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs uppercase tracking-wider text-zinc-500">{label}</span>
        <span className={`font-mono text-xl font-semibold ${colorClass}`}>{value}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="rounded border border-[#30363d] px-2 py-1 text-sm text-zinc-200 transition hover:border-[#d4a843]/60"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          -1
        </button>
        <button
          type="button"
          className="rounded border border-[#30363d] px-2 py-1 text-sm text-zinc-200 transition hover:border-[#d4a843]/60"
          onClick={() => onChange(value + 1)}
        >
          +1
        </button>
      </div>
    </div>
  )
}
