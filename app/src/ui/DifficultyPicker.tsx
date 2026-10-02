import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { DIFFICULTIES, DIFFICULTY_LABEL, type SelectableDifficulty as Difficulty } from '../game/difficulty'

interface Props {
  value: Difficulty
  onChange: (d: Difficulty) => void
}

/**
 * ロゴと同じ「輪と点」で難易度を表す。点が輪の中心に近いほど難しい。
 * 左から Easy・Normal・Hard の順に並ぶよう、点は輪の左外側(Easy)→ 輪の上(Normal)→ 中心(Hard)へ動く。
 */
const DOT_X: Record<Difficulty, number> = { easy: 40, normal: 76, hard: 120 }
const MIN_X = DOT_X.easy
const MAX_X = DOT_X.hard
/** これより動かしたらクリックではなくドラッグとみなす(viewBox の単位) */
const DRAG_THRESHOLD = 4

function nearest(x: number): Difficulty {
  return DIFFICULTIES.reduce((best, d) => (Math.abs(DOT_X[d] - x) < Math.abs(DOT_X[best] - x) ? d : best))
}

export function DifficultyPicker({ value, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pointerRef = useRef<{ id: number; startX: number; moved: boolean } | null>(null)
  /** ドラッグ中の点の位置。null のときは選択中の難易度の位置に(アニメーション付きで)置く */
  const [dragX, setDragX] = useState<number | null>(null)
  const radiosRef = useRef<(HTMLButtonElement | null)[]>([])

  const toViewBoxX = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * 240
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerRef.current = { id: e.pointerId, startX: toViewBoxX(e.clientX), moved: false }
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = pointerRef.current
    if (!p || p.id !== e.pointerId) return
    const x = toViewBoxX(e.clientX)
    if (!p.moved && Math.abs(x - p.startX) < DRAG_THRESHOLD) return
    p.moved = true
    const clamped = Math.max(MIN_X, Math.min(MAX_X, x))
    setDragX(clamped)
    const d = nearest(clamped)
    if (d !== value) onChange(d)
  }

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const p = pointerRef.current
    if (!p || p.id !== e.pointerId) return
    pointerRef.current = null
    // ドラッグなら最寄りの位置へ吸着、クリックならその位置に近い難易度へ移る
    if (!p.moved) onChange(nearest(p.startX))
    setDragX(null)
  }

  const onPointerCancel = () => {
    pointerRef.current = null
    setDragX(null)
  }

  const onRadioKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = DIFFICULTIES.indexOf(value)
    let next: number
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(DIFFICULTIES.length - 1, i + 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = DIFFICULTIES.length - 1
    else return
    e.preventDefault()
    onChange(DIFFICULTIES[next])
    radiosRef.current[next]?.focus()
  }

  const x = dragX ?? DOT_X[value]

  return (
    <div className="picker">
      {/* 操作はポインター用。キーボードと読み上げは下のボタンで同じことができる */}
      <svg
        ref={svgRef}
        className={`dial ${dragX !== null ? 'is-dragging' : ''}`}
        viewBox="0 0 240 140"
        aria-hidden="true"
        focusable="false"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <circle cx="120" cy="70" r="44" fill="none" stroke="var(--ink)" strokeWidth="12" />
        <circle className="dial__dot" cx="0" cy="70" r="18" fill="var(--accent)" style={{ transform: `translateX(${x}px)` }} />
      </svg>
      <div className="segmented" role="radiogroup" aria-label="難易度" onKeyDown={onRadioKeyDown}>
        {DIFFICULTIES.map((d, i) => (
          <button
            key={d}
            ref={(el) => {
              radiosRef.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={d === value}
            tabIndex={d === value ? 0 : -1}
            className="segmented__item"
            onClick={() => onChange(d)}
          >
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>
    </div>
  )
}
