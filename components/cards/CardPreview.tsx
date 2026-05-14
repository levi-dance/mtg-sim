'use client'

import { useEffect, useRef } from 'react'
import { CardImage } from '@/components/cards/CardImage'
import type { CardInstance } from '@/types/game'

interface CardPreviewProps {
  preview: {
    card: CardInstance
    x: number
    y: number
  } | null
}

export function CardPreview({ preview }: CardPreviewProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || !preview) return

    element.style.setProperty('--preview-x', `${preview.x}px`)
    element.style.setProperty('--preview-y', `${preview.y}px`)
  }, [preview])

  if (!preview) return null

  return (
    <aside ref={ref} className="card-preview" aria-live="polite">
      <CardImage cardId={preview.card.cardId} name={preview.card.name} size="large" variant="preview" />
    </aside>
  )
}
