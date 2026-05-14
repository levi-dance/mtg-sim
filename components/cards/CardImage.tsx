'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { getCardById, getCardImageUri, type ScryfallCard, type ScryfallImageUris } from '@/lib/scryfall/api'
import { getCached } from '@/lib/scryfall/cache'

interface CardImageProps {
  cardId: string
  name: string
  size?: keyof ScryfallImageUris
  variant?: 'table' | 'preview'
}

export function CardImage({ cardId, name, size = 'normal', variant = 'table' }: CardImageProps) {
  const cachedCard = useMemo(() => getCached(`id:${cardId}`), [cardId])
  const [card, setCard] = useState<ScryfallCard | undefined>(cachedCard)
  const [failedCardId, setFailedCardId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!cardId) {
      return () => {
        active = false
      }
    }

    const cached = getCached(`id:${cardId}`)
    if (cached) {
      Promise.resolve().then(() => {
        if (active) setCard(cached)
      })
      return () => {
        active = false
      }
    }

    getCardById(cardId)
      .then(result => {
        if (active) setCard(result)
      })
      .catch(() => {
        if (active) setFailedCardId(cardId)
      })

    return () => {
      active = false
    }
  }, [cardId])

  const failedImage = failedCardId === cardId
  const imageUri = card?.id === cardId && !failedImage ? getCardImageUri(card, size) : ''

  if (imageUri) {
    return (
      <Image
        className={`card-image ${variant === 'preview' ? 'preview' : ''}`}
        src={imageUri}
        alt={name}
        width={488}
        height={680}
        loading="lazy"
        onError={() => setFailedCardId(cardId)}
      />
    )
  }

  return (
    <div className={`card-image-fallback ${variant === 'preview' ? 'preview' : ''}`}>
      <span>{name}</span>
    </div>
  )
}
