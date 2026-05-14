'use client'

import { createClient } from '@/lib/supabase/client'

const TOKEN_KEY = 'mtg_sim_player_token'

function generateToken(): string {
  return crypto.randomUUID()
}

export function getOrCreateToken(): string {
  let token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    token = generateToken()
    localStorage.setItem(TOKEN_KEY, token)
  }
  return token
}

export async function syncTokenToSupabase(token: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('player_tokens')
    .upsert({ token }, { onConflict: 'token', ignoreDuplicates: true })
}

export async function initPlayerIdentity(): Promise<string> {
  const token = getOrCreateToken()
  await syncTokenToSupabase(token)
  return token
}

const DISPLAY_NAME_KEY = 'mtg_sim_display_name'

export function getDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? ''
}

export function saveDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name)
}

export async function updateDisplayNameInSupabase(token: string, displayName: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('player_tokens').update({ display_name: displayName }).eq('token', token)
}
