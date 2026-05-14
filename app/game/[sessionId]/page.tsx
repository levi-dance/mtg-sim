import { GameBoard } from '@/components/board/GameBoard'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function GamePage({ params }: Props) {
  const { sessionId } = await params
  return <GameBoard sessionId={sessionId} />
}
