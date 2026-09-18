'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'

type VictoryOverlayProps = {
  winner?: string
  subtitle?: string
  label?: string
  onPlayAgain?: () => void | Promise<void>
}

export function VictoryOverlay({
  winner = 'WAIT… YOU ACTUALLY WON?!',
  subtitle = 'Something went terribly wrong.',
  label = 'The student has escaped.',
  onPlayAgain,
}: VictoryOverlayProps) {
  const [isLeaving, setIsLeaving] = useState(false)
  const playAgainButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement
    playAgainButtonRef.current?.focus()

    return () => {
      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus()
      }
    }
  }, [])

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
        <p className="victory-kicker">{label}</p>
        <h2 id="victory-title">{winner}</h2>
        <p className="victory-subtitle">{subtitle}</p>

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
