'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SessionSettingsForm } from './SessionSettings'
import { createSession } from '@/lib/sessions'
import { getOrCreateToken, getDisplayName, saveDisplayName } from '@/lib/tokens/identity'
import { listDecks } from '@/lib/decks'
import type { SessionSettings as SessionSettingsType } from '@/types/session'
import type { DeckSummary } from '@/types/deck'

const defaultSettings: SessionSettingsType = {
  mode: '1v1',
  format: 'commander',
  mulliganRule: 'london',
  friendlyMulliganCount: null,
  matchLength: 1,
  allowSpectators: true,
}

export function CreateSession() {
  const router = useRouter()
  const [settings, setSettings] = useState<SessionSettingsType>(defaultSettings)
  const [displayName, setDisplayName] = useState(getDisplayName)
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getOrCreateToken()
    listDecks(token).then(setDecks).catch(() => {})
  }, [])

  const filteredDecks = decks.filter(d => d.format === settings.format)
  const effectiveSelectedDeckId = filteredDecks.some(d => d.id === selectedDeckId) ? selectedDeckId : null

  const handleCreate = async () => {
    if (!displayName.trim()) return
    setIsCreating(true)
    setError(null)
    try {
      const token = getOrCreateToken()
      saveDisplayName(displayName.trim())
      const id = await createSession(settings, token, displayName.trim(), effectiveSelectedDeckId)
      router.push(`/lobby?session=${id}`)
    } catch {
      setError('Failed to create session — check Supabase connection')
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto w-full p-6 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#d4a843]">Create Session</h1>
        <Link href="/decks" className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
          My Decks →
        </Link>
      </div>

      {/* Player identity */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
            Your Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Enter your display name"
            maxLength={24}
            autoFocus
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#d4a843]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
            Your Deck{' '}
            <span className="text-zinc-600 normal-case font-normal">(optional)</span>
          </label>
          {filteredDecks.length > 0 ? (
            <select
              value={selectedDeckId ?? ''}
              onChange={e => setSelectedDeckId(e.target.value || null)}
              className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#d4a843]"
            >
              <option value="">No deck selected</option>
              {filteredDecks.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-zinc-600 text-sm">
              No {settings.format} decks found.{' '}
              <a
                href="/decks/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d4a843] hover:underline"
              >
                Create one →
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Session settings */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <SessionSettingsForm value={settings} onChange={setSettings} />
      </div>

      {error && <p className="text-red-400 text-sm -mt-4">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={!displayName.trim() || isCreating}
        className="w-full py-3 bg-[#d4a843] text-[#0d1117] font-semibold rounded-xl hover:bg-[#e6b84f] disabled:opacity-40 transition-colors text-base"
      >
        {isCreating ? 'Creating...' : 'Create Session'}
      </button>
    </div>
  )
}
