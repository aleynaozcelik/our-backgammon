'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'

type VictoryCopy = {
  winner: string
  subtitle: string
  label: string
}

type VictoryOverlayProps = {
  winner?: string
  subtitle?: string
  label?: string
  copies?: readonly VictoryCopy[]
  avoidCopyIndex?: number
  onCopyChosen?: (copyIndex: number) => void
  onPlayAgain?: () => void | Promise<void>
}

export function VictoryOverlay({
  winner = 'WAIT… YOU ACTUALLY WON?!',
  subtitle = 'Something went terribly wrong.',
  label = 'The student has escaped.',
  copies,
  avoidCopyIndex,
  onCopyChosen,
  onPlayAgain,
}: VictoryOverlayProps) {
  const [isLeaving, setIsLeaving] = useState(false)
  const [copyIndex] = useState<number | null>(() => {
    if (!copies?.length) return null

    const availableIndexes = Array.from({ length: copies.length }, (_, index) => index)
      .filter((index) => index !== avoidCopyIndex)
    const indexesToChooseFrom = availableIndexes.length > 0 ? availableIndexes : [0]

    return indexesToChooseFrom[Math.floor(Math.random() * indexesToChooseFrom.length)]
  })
  const playAgainButtonRef = useRef<HTMLButtonElement>(null)
  const selectedCopy = copyIndex === null ? null : copies?.[copyIndex]
  const visibleWinner = selectedCopy?.winner ?? winner
  const visibleSubtitle = selectedCopy?.subtitle ?? subtitle
  const visibleLabel = selectedCopy?.label ?? label

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement
    playAgainButtonRef.current?.focus()

    return () => {
      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus()
      }
    }
  }, [])

  useEffect(() => {
    if (copyIndex !== null) onCopyChosen?.(copyIndex)
  }, [copyIndex, onCopyChosen])

  const handlePlayAgain = () => {
    if (isLeaving) return

    setIsLeaving(true)
    window.setTimeout(() => {
      void Promise.resolve()
        .then(() => onPlayAgain?.())
        .finally(() => setIsLeaving(false))
    }, 260)
  }

  return (
    <div
      className={`victory-overlay ${isLeaving ? 'victory-overlay-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
      aria-busy={isLeaving}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          playAgainButtonRef.current?.focus()
        }
      }}
    >
      <div className="victory-atmosphere" aria-hidden="true" />
      <div className="victory-grain" aria-hidden="true" />
      <div className="victory-particles" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>

      <section className="victory-card">
        <div className="victory-card-line" aria-hidden="true" />
        <p className="victory-kicker">{visibleLabel}</p>
        <h2 id="victory-title">{visibleWinner}</h2>
        <p className="victory-subtitle">{visibleSubtitle}</p>

        <button
          ref={playAgainButtonRef}
          className="victory-play-again-button"
          type="button"
          disabled={isLeaving}
          onClick={handlePlayAgain}
        >
          <RotateCcw size={15} strokeWidth={1.7} />
          <span>REMATCH</span>
          <ArrowRight className="victory-play-again-arrow" size={16} strokeWidth={1.7} />
        </button>
      </section>
    </div>
  )
}

export default VictoryOverlay
