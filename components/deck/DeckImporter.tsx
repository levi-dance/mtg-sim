'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCardByNameFuzzy, getNormalUri } from '@/lib/scryfall/api'
import { saveDeck } from '@/lib/decks'
import { getOrCreateToken } from '@/lib/tokens/identity'
import type { GameFormat } from '@/types/game'
import type { DeckCard } from '@/types/deck'

type Stage = 'input' | 'validating' | 'done'
type RowStatus = 'pending' | 'validating' | 'found' | 'not_found'
type Zone = 'main' | 'side' | 'commander'

interface CardRow {
  id: string
  rawName: string
  editName: string
  quantity: number
  zone: Zone
  status: RowStatus
  resolvedName: string
  resolvedId: string
}

function parseDecklist(text: string): Array<{ quantity: number; name: string; zone: Zone }> {
  const lines = text.split('\n')
  let currentZone: Zone = 'main'
  const cards: Array<{ quantity: number; name: string; zone: Zone }> = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const lc = line.toLowerCase()

    if (['commander', '// commander', 'commanders', '// commanders'].includes(lc)) {
      currentZone = 'commander'
      continue
    }
    if (['deck', '// deck', 'main', '// main', 'maindeck', '// maindeck', 'mainboard', '// mainboard'].includes(lc)) {
      currentZone = 'main'
      continue
    }
    if (['sideboard', '// sideboard', 'side', '// side', '// sb', 'sb'].includes(lc)) {
      currentZone = 'side'
      continue
    }

    // Skip other comment lines
    if (line.startsWith('//')) continue

    // "4 Lightning Bolt" or "4x Lightning Bolt"
    const match = line.match(/^(\d+)x?\s+(.+)$/)
    if (!match) continue

    const quantity = parseInt(match[1], 10)
    const name = match[2].trim()
    if (quantity > 0 && name) {
      cards.push({ quantity, name, zone: currentZone })
    }
  }

  // Merge duplicate (zone, name) pairs
  const merged = new Map<string, { quantity: number; name: string; zone: Zone }>()
  for (const card of cards) {
    const key = `${card.zone}:${card.name.toLowerCase()}`
    const existing = merged.get(key)
    if (existing) {
      existing.quantity += card.quantity
    } else {
      merged.set(key, { ...card })
    }
  }
  return Array.from(merged.values())
}

export function DeckImporter() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('input')
  const [text, setText] = useState('')
  const [format, setFormat] = useState<GameFormat>('commander')
  const [deckName, setDeckName] = useState('Imported Deck')
  const [rows, setRows] = useState<CardRow[]>([])
  const [validatedCount, setValidatedCount] = useState(0)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const updateRow = (id: string, patch: Partial<CardRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const handleParseAndValidate = async () => {
    const parsed = parseDecklist(text)
    if (parsed.length === 0) return

    const initialRows: CardRow[] = parsed.map((card, i) => ({
      id: `row-${i}`,
      rawName: card.name,
      editName: card.name,
      quantity: card.quantity,
      zone: card.zone,
      status: 'pending',
      resolvedName: '',
      resolvedId: '',
    }))

    setRows(initialRows)
    setValidatedCount(0)
    setStage('validating')
    abortRef.current = false

    const nameResultCache = new Map<string, { found: boolean; resolvedName: string; resolvedId: string }>()

    for (let i = 0; i < initialRows.length; i++) {
      if (abortRef.current) break
      const row = initialRows[i]
      const key = row.editName.toLowerCase().trim()

      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'validating' } : r))

      if (nameResultCache.has(key)) {
        const result = nameResultCache.get(key)!
        setRows(prev => prev.map(r =>
          r.id === row.id
            ? { ...r, status: result.found ? 'found' : 'not_found', resolvedName: result.resolvedName, resolvedId: result.resolvedId }
            : r
        ))
      } else {
        try {
          const card = await getCardByNameFuzzy(row.editName)
          const result = { found: true, resolvedName: card.name, resolvedId: card.id }
          nameResultCache.set(key, result)
          setRows(prev => prev.map(r =>
            r.id === row.id ? { ...r, status: 'found', resolvedName: card.name, resolvedId: card.id } : r
          ))
        } catch {
          nameResultCache.set(key, { found: false, resolvedName: '', resolvedId: '' })
          setRows(prev => prev.map(r =>
            r.id === row.id ? { ...r, status: 'not_found' } : r
          ))
        }
        await new Promise(r => setTimeout(r, 75))
      }

      setValidatedCount(i + 1)
    }

    if (!abortRef.current) setStage('done')
  }

  const handleRevalidate = async (rowId: string, name: string) => {
    updateRow(rowId, { editName: name, status: 'validating' })
    try {
      const card = await getCardByNameFuzzy(name)
      updateRow(rowId, { status: 'found', resolvedName: card.name, resolvedId: card.id })
    } catch {
      updateRow(rowId, { status: 'not_found' })
    }
  }

  const handleStartOver = () => {
    abortRef.current = true
    setStage('input')
    setRows([])
    setValidatedCount(0)
    setImportError(null)
  }

  const handleImport = async () => {
    setIsImporting(true)
    setImportError(null)
    try {
      const ownerToken = getOrCreateToken()
      const foundRows = rows.filter(r => r.status === 'found')

      const commanderRow = foundRows.find(r => r.zone === 'commander')
      const commanderCard: DeckCard | null = commanderRow
        ? { cardId: commanderRow.resolvedId, name: commanderRow.resolvedName, quantity: 1, artId: commanderRow.resolvedId }
        : null

      const mainMap = new Map<string, DeckCard>()
      for (const row of foundRows.filter(r => r.zone === 'main')) {
        const existing = mainMap.get(row.resolvedId)
        if (existing) {
          existing.quantity += row.quantity
        } else {
          mainMap.set(row.resolvedId, { cardId: row.resolvedId, name: row.resolvedName, quantity: row.quantity, artId: row.resolvedId })
        }
      }

      const sideMap = new Map<string, DeckCard>()
      for (const row of foundRows.filter(r => r.zone === 'side')) {
        const existing = sideMap.get(row.resolvedId)
        if (existing) {
          existing.quantity += row.quantity
        } else {
          sideMap.set(row.resolvedId, { cardId: row.resolvedId, name: row.resolvedName, quantity: row.quantity, artId: row.resolvedId })
        }
      }

      const saved = await saveDeck({
        ownerToken,
        name: deckName,
        format,
        commanderCard,
        mainDeck: Array.from(mainMap.values()),
        sideboard: Array.from(sideMap.values()),
      })

      router.push(`/decks/${saved.id}`)
    } catch {
      setImportError('Import failed — check Supabase connection')
      setIsImporting(false)
    }
  }

  const foundCount = rows.filter(r => r.status === 'found').length
  const notFoundCount = rows.filter(r => r.status === 'not_found').length

  if (stage === 'input') {
    return (
      <div className="max-w-3xl mx-auto w-full p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/decks')}
            className="text-zinc-400 hover:text-zinc-200 text-sm"
          >
            ← Decks
          </button>
          <h1 className="text-2xl font-semibold text-[#d4a843]">Import Deck</h1>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              placeholder="Deck name"
              className="flex-1 min-w-48 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#d4a843]"
            />
            <select
              value={format}
              onChange={e => setFormat(e.target.value as GameFormat)}
              className="bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none"
            >
              <option value="commander">Commander</option>
              <option value="modern">Modern</option>
            </select>
          </div>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Paste your decklist here...\n\nFormats supported:\n  4 Lightning Bolt\n  4x Forest\n\nOptional section headers:\n  // Commander\n  // Deck\n  // Sideboard`}
            rows={16}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 text-zinc-200 placeholder-zinc-600 font-mono text-sm focus:outline-none focus:border-[#d4a843] resize-none leading-relaxed"
          />

          <button
            onClick={handleParseAndValidate}
            disabled={!text.trim()}
            className="self-start px-6 py-2.5 bg-[#d4a843] text-[#0d1117] font-semibold rounded hover:bg-[#e6b84f] disabled:opacity-40 transition-colors"
          >
            Parse & Validate
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto w-full p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleStartOver}
          className="text-zinc-400 hover:text-zinc-200 text-sm shrink-0"
        >
          ← Start over
        </button>
        <input
          type="text"
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          className="flex-1 min-w-0 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#d4a843]"
        />
        <select
          value={format}
          onChange={e => setFormat(e.target.value as GameFormat)}
          className="bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-zinc-200 focus:outline-none shrink-0"
        >
          <option value="commander">Commander</option>
          <option value="modern">Modern</option>
        </select>
        <button
          onClick={handleImport}
          disabled={stage !== 'done' || isImporting || foundCount === 0}
          className="px-4 py-2 bg-[#d4a843] text-[#0d1117] font-semibold rounded hover:bg-[#e6b84f] disabled:opacity-40 transition-colors shrink-0"
        >
          {isImporting ? 'Importing...' : `Import ${foundCount > 0 ? `${foundCount} cards` : 'Deck'}`}
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm">
        {stage === 'validating' ? (
          <span className="text-zinc-400">
            Validating cards... {validatedCount} / {rows.length}
          </span>
        ) : (
          <>
            <span className="text-green-400">{foundCount} found</span>
            {notFoundCount > 0 && (
              <>
                <span className="text-red-400">{notFoundCount} not found</span>
                <span className="text-zinc-600 text-xs">not-found cards will be skipped</span>
              </>
            )}
          </>
        )}
      </div>

      {importError && <p className="text-red-400 text-sm">{importError}</p>}

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="divide-y divide-[#21262d]">
          {rows.map(row => (
            <CardRowItem
              key={`${row.id}-${row.editName}`}
              row={row}
              onRevalidate={(name) => handleRevalidate(row.id, name)}
              onHover={uri => setPreviewUri(uri)}
              onHoverEnd={() => setPreviewUri(null)}
            />
          ))}
        </div>
      </div>

      {previewUri && (
        <div className="fixed top-4 right-4 z-[100] pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUri}
            alt="Card preview"
            width={200}
            height={279}
            className="rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}

interface CardRowItemProps {
  row: CardRow
  onRevalidate: (name: string) => void
  onHover: (uri: string) => void
  onHoverEnd: () => void
}

function CardRowItem({ row, onRevalidate, onHover, onHoverEnd }: CardRowItemProps) {
  const [inputValue, setInputValue] = useState(row.editName)

  const zoneBadge = {
    main: { label: 'MD', className: 'text-zinc-400' },
    side: { label: 'SB', className: 'text-blue-400' },
    commander: { label: 'CMD', className: 'text-[#d4a843]' },
  }[row.zone]

  const statusEl = {
    pending: <span className="w-4 h-4 rounded-full bg-[#30363d] block" />,
    validating: <span className="text-zinc-400 text-base leading-none animate-spin inline-block">↻</span>,
    found: <span className="text-green-400 text-base leading-none">✓</span>,
    not_found: <span className="text-red-400 text-base leading-none">✗</span>,
  }[row.status]

  const canPreview = row.status === 'found' && row.resolvedId

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 hover:bg-[#21262d] transition-colors"
      onMouseEnter={() => canPreview && onHover(getNormalUri(row.resolvedId))}
      onMouseLeave={onHoverEnd}
    >
      <span className={`text-xs font-mono w-8 shrink-0 text-right ${zoneBadge.className}`}>
        {zoneBadge.label}
      </span>
      <span className="text-zinc-500 text-sm w-6 text-right shrink-0 tabular-nums">
        {row.quantity}×
      </span>

      {row.status === 'not_found' ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onRevalidate(inputValue)}
            className="flex-1 min-w-0 bg-[#0d1117] border border-red-800 rounded px-2 py-0.5 text-zinc-200 text-sm focus:outline-none focus:border-[#d4a843]"
          />
          <button
            onClick={() => onRevalidate(inputValue)}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 bg-[#30363d] hover:bg-[#161b22] rounded shrink-0 transition-colors"
          >
            Re-check
          </button>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          {row.status === 'found' && row.resolvedName !== row.rawName ? (
            <span className="text-sm">
              <span className="text-zinc-500 line-through mr-1.5">{row.rawName}</span>
              <span className="text-zinc-200">{row.resolvedName}</span>
            </span>
          ) : (
            <span className="text-zinc-200 text-sm truncate block">
              {row.status === 'found' ? row.resolvedName : row.rawName}
            </span>
          )}
        </div>
      )}

      <span className="shrink-0 w-5 flex items-center justify-center">
        {statusEl}
      </span>
    </div>
  )
}
