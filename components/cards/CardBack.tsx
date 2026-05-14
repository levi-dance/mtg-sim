interface CardBackProps {
  count?: number
  variant?: 'hand' | 'library' | 'compact'
}

export function CardBack({ count, variant = 'hand' }: CardBackProps) {
  return (
    <div className={`card-back ${variant}`}>
      {typeof count === 'number' && <span>{count}</span>}
    </div>
  )
}
