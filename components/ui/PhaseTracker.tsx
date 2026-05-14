'use client'

import type { GameAction } from '@/lib/game/actions'
import type { TurnPhase } from '@/types/game'

const PHASES: { id: TurnPhase; label: string }[] = [
  { id: 'untap', label: 'Untap' },
  { id: 'upkeep', label: 'Upkeep' },
  { id: 'draw', label: 'Draw' },
  { id: 'main1', label: 'Main 1' },
  { id: 'combat_begin', label: 'Combat' },
  { id: 'combat_attackers', label: 'Attack' },
  { id: 'combat_blockers', label: 'Block' },
  { id: 'combat_damage', label: 'Damage' },
  { id: 'combat_end', label: 'End Combat' },
  { id: 'main2', label: 'Main 2' },
  { id: 'end', label: 'End' },
  { id: 'cleanup', label: 'Cleanup' },
]

interface PhaseTrackerProps {
  activePlayerId: string
  phase: TurnPhase
  turnNumber: number
  dispatch: (action: GameAction) => void
}

export function PhaseTracker({ activePlayerId, phase, turnNumber, dispatch }: PhaseTrackerProps) {
  const currentIndex = PHASES.findIndex(item => item.id === phase)

  return (
    <section className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold leading-none text-[#d4a843]">{turnNumber}</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Turn</span>
      </div>
      <p className="mb-4 font-serif text-sm font-semibold text-zinc-100">
        {PHASES[currentIndex]?.label ?? phase}
      </p>

      <div className="relative flex items-center py-1.5">
        <div className="absolute inset-x-0 h-px bg-[#30363d]" />
        <div
          className="absolute left-0 h-px bg-[#d4a843]/40 transition-all duration-300"
          style={{ width: currentIndex === 0 ? '0%' : `${(currentIndex / (PHASES.length - 1)) * 100}%` }}
        />
        <div className="relative flex w-full justify-between">
          {PHASES.map((item, index) => {
            const isPast = index < currentIndex
            const isCurrent = index === currentIndex
            return (
              <span
                key={item.id}
                title={item.label}
                className={`h-2 w-2 flex-shrink-0 rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-[#d4a843] shadow-[0_0_5px_2px_rgb(212_168_67_/_0.55)]'
                    : isPast
                    ? 'bg-[#d4a843]/40'
                    : 'bg-[#30363d]'
                }`}
              />
            )
          })}
        </div>
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-md bg-[#d4a843] px-3 py-2 text-sm font-semibold text-[#0d1117] transition hover:bg-[#e5bc5a]"
        onClick={() =>
          dispatch({
            type: 'NEXT_PHASE',
            playerId: activePlayerId,
            timestamp: new Date().toISOString(),
          })
        }
      >
        Next Phase
      </button>
    </section>
  )
}
