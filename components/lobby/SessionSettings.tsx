'use client'

import type { SessionSettings as SessionSettingsType } from '@/types/session'
import type { GameMode, GameFormat, MulliganRule } from '@/types/game'

interface Props {
  value: SessionSettingsType
  onChange: (s: SessionSettingsType) => void
}

export function SessionSettingsForm({ value, onChange }: Props) {
  const set = <K extends keyof SessionSettingsType>(key: K, val: SessionSettingsType[K]) =>
    onChange({ ...value, [key]: val })

  return (
    <div className="flex flex-col gap-5">
      {/* Mode */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Mode</span>
        <div className="flex gap-2 flex-wrap">
          {([['1v1', '1v1'], ['2v2', '2v2'], ['4ffa', '4-Player FFA']] as [GameMode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => set('mode', m)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                value.mode === m
                  ? 'bg-[#d4a843] text-[#0d1117]'
                  : 'bg-[#21262d] border border-[#30363d] text-zinc-300 hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Format</span>
        <div className="flex gap-2">
          {([['commander', 'Commander'], ['modern', 'Modern']] as [GameFormat, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => set('format', f)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                value.format === f
                  ? 'bg-[#d4a843] text-[#0d1117]'
                  : 'bg-[#21262d] border border-[#30363d] text-zinc-300 hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Mulligan */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Mulligan Rule</span>
        <div className="flex gap-2 flex-wrap">
          {([['london', 'London'], ['normal', 'Normal'], ['friendly', 'Friendly']] as [MulliganRule, string][]).map(([r, label]) => (
            <button
              key={r}
              onClick={() =>
                onChange({
                  ...value,
                  mulliganRule: r,
                  friendlyMulliganCount: r === 'friendly' ? (value.friendlyMulliganCount ?? 1) : null,
                })
              }
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                value.mulliganRule === r
                  ? 'bg-[#d4a843] text-[#0d1117]'
                  : 'bg-[#21262d] border border-[#30363d] text-zinc-300 hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {value.mulliganRule === 'friendly' && (
          <div className="flex items-center gap-2 text-sm text-zinc-300 mt-1">
            <span className="text-zinc-400">Free mulligans:</span>
            <input
              type="number"
              min={0}
              max={7}
              value={value.friendlyMulliganCount ?? 1}
              onChange={e => set('friendlyMulliganCount', parseInt(e.target.value, 10) || 0)}
              className="w-16 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-center text-zinc-200 focus:outline-none focus:border-[#d4a843]"
            />
          </div>
        )}
      </div>

      {/* Match length */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Match Length</span>
        <div className="flex gap-2">
          {([1, 3, 5] as (1 | 3 | 5)[]).map(n => (
            <button
              key={n}
              onClick={() => set('matchLength', n)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                value.matchLength === n
                  ? 'bg-[#d4a843] text-[#0d1117]'
                  : 'bg-[#21262d] border border-[#30363d] text-zinc-300 hover:text-zinc-100'
              }`}
            >
              {n === 1 ? 'Best of 1' : n === 3 ? 'Best of 3' : 'Best of 5'}
            </button>
          ))}
        </div>
      </div>

      {/* Allow spectators */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => set('allowSpectators', !value.allowSpectators)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
            value.allowSpectators ? 'bg-[#d4a843]' : 'bg-[#30363d]'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              value.allowSpectators ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </div>
        <span className="text-sm text-zinc-300">Allow spectators</span>
      </label>
    </div>
  )
}
