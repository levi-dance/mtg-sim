'use client'

import { useEffect } from 'react'
import { initPlayerIdentity } from '@/lib/tokens/identity'

export function PlayerIdentityInit() {
  useEffect(() => {
    initPlayerIdentity().catch(() => {})
  }, [])
  return null
}
