'use client'

import { useEffect } from 'react'

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Game page error:', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0d1117] p-8">
      <h1 className="font-serif text-2xl text-[#d4a843]">Game failed to load</h1>
      <p className="max-w-lg text-center text-sm text-zinc-400">{error.message}</p>
      {error.digest && (
        <p className="font-mono text-xs text-zinc-600">digest: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded border border-[#30363d] px-4 py-2 text-sm text-zinc-300 hover:border-[#d4a843]/50"
        >
          Try again
        </button>
        <a
          href="/lobby"
          className="rounded border border-[#30363d] px-4 py-2 text-sm text-zinc-300 hover:border-[#d4a843]/50"
        >
          Back to lobby
        </a>
      </div>
    </main>
  )
}
