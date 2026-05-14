import { CreateSession } from '@/components/lobby/CreateSession'
import { LobbyRoom } from '@/components/lobby/LobbyRoom'

export default async function LobbyPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>
}) {
  const { session: sessionId } = await searchParams
  if (!sessionId) return <CreateSession />
  return <LobbyRoom sessionId={sessionId} />
}
