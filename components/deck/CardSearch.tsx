'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  autocompleteCardNames,
  getCardByName,
  getCardImageUri,
  type ScryfallCard,
} from '@/lib/scryfall/api'

interface Props {
  onSelectCard: (card: ScryfallCard) => void
  placeholder?: string
}

export function CardSearch({ onSelectCard, placeholder = 'Search for a card...' }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [previewCard, setPreviewCard] = useState<ScryfallCard | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }
    const names = await autocompleteCardNames(q)
    setSuggestions(names.slice(0, 8))
    setIsOpen(names.length > 0)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setHighlightedIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  const handleHover = async (name: string) => {
    try {
      const card = await getCardByName(name)
      setPreviewCard(card)
    } catch {
      setPreviewCard(null)
    }
  }

  const handleSelect = async (name: string) => {
    try {
      const card = await getCardByName(name)
      onSelectCard(card)
    } catch {
      // ignore failed lookups
    }
    setQuery('')
    setSuggestions([])
    setIsOpen(false)
    setPreviewCard(null)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      handleSelect(suggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setPreviewCard(null)
    }
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setPreviewCard(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#d4a843] transition-colors"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden shadow-xl">
          {suggestions.map((name, i) => (
            <li
              key={name}
              onMouseEnter={() => handleHover(name)}
              onMouseLeave={() => setPreviewCard(null)}
              onClick={() => handleSelect(name)}
              className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
                i === highlightedIndex
                  ? 'bg-[#d4a843] text-[#0d1117]'
                  : 'text-zinc-200 hover:bg-[#21262d]'
              }`}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
      {previewCard && (
        <div className="fixed top-4 right-4 z-[100] pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getCardImageUri(previewCard)}
            alt={previewCard.name}
            width={200}
            height={279}
            className="rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}
