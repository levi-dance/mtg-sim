'use client'

import { useEffect, useRef } from 'react'

export interface SelectionRect {
  left: number
  top: number
  width: number
  height: number
}

export function SelectionBox({ rect }: { rect: SelectionRect }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.setProperty('--selection-left', `${rect.left}px`)
    element.style.setProperty('--selection-top', `${rect.top}px`)
    element.style.setProperty('--selection-width', `${rect.width}px`)
    element.style.setProperty('--selection-height', `${rect.height}px`)
  }, [rect.height, rect.left, rect.top, rect.width])

  return <div ref={ref} className="selection-box" aria-hidden="true" />
}
