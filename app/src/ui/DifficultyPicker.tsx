import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty, type SelectableDifficulty } from '../game/difficulty'

interface Props {
  value: Difficulty
  onChange: (d: Difficulty) => void
}

/**
 * ロゴと同じ「輪と点」で難易度を表す。点が輪の中心に近いほど難しい。
 * 左から Easy・Normal・Hard の順に並ぶよう、点は輪の左外側(Easy)→ 輪の上(Normal)→ 中心(Hard)へ動く。
 *
 * 隠しモード: ドラッグ中に指を輪の右上の外周まで持っていくと、点がロゴと同じ位置(輪の内側の右上)に収まり、
 * 難易度 Max になる。ボタンやキーボードからは選べない。
 */
const DOT_X: Record<SelectableDifficulty, number> = { easy: 40, normal: 76, hard: 120 }
const MIN_X = DOT_X.easy
const MAX_X = DOT_X.hard
/** 輪の中心と半径(viewBox の単位)。輪の線幅は 12 なので、線は半径 38〜50 */
const RING = { cx: 120, cy: 70, r: 44 }
/** ロゴの点の位置(ロゴは輪の半径 56 に対し中心から (12, -8))を、この輪の大きさに合わせたもの */
const MAX_POS = { x: RING.cx + (12 * RING.r) / 56, y: RING.cy - (8 * RING.r) / 56 }
/** Max に入る範囲: 右上(右から 20〜70 度)で、輪の線の外側半分より外 */
const MAX_ZONE = { minAngle: 20, maxAngle: 70, minR: 42, maxR: 72 }
/** これより動かしたらクリックではなくドラッグとみなす(viewBox の単位) */
const DRAG_THRESHOLD = 4

function nearest(x: number): SelectableDifficulty {
  return DIFFICULTIES.reduce((best, d) => (Math.abs(DOT_X[d] - x) < Math.abs(DOT_X[best] - x) ? d : best))
}

function inMaxZone(x: number, y: number): boolean {
  const dx = x - RING.cx
  const dy = RING.cy - y // 上を正にする
  const r = Math.hypot(dx, dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  return r >= MAX_ZONE.minR && r <= MAX_ZONE.maxR && angle >= MAX_ZONE.minAngle && angle <= MAX_ZONE.maxAngle
}

export function DifficultyPicker({ value, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pointerRef = useRef<{ id: number; startX: number; moved: boolean } | null>(null)
  /** ドラッグ中の点の位置。null のときは選択中の難易度の位置に(アニメーション付きで)置く */
  const [dragX, setDragX] = useState<number | null>(null)
  const radiosRef = useRef<(HTMLButtonElement | null)[]>([])
  const isMax = value === 'max'

  const toViewBox = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: ((clientX - rect.left) / rect.width) * 240, y: ((clientY - rect.top) / rect.height) * 140 }
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerRef.current = { id: e.pointerId, startX: toViewBox(e.clientX, e.clientY).x, moved: false }
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = pointerRef.current
    if (!p || p.id !== e.pointerId) return
    const { x, y } = toViewBox(e.clientX, e.clientY)
    if (!p.moved && Math.abs(x - p.startX) < DRAG_THRESHOLD) return
    p.moved = true
    const clamped = Math.max(MIN_X, Math.min(MAX_X, x))
    setDragX(clamped)
    const d = nearest(clamped)
    if (inMaxZone(x, y)) {
      if (!isMax) onChange('max')
    } else if (isMax) {
      // Max のあいだは、Hard の範囲から出たときだけ通常の選択に戻す(右上の範囲の縁で行ったり来たりしないように)
      if (d !== 'hard') onChange(d)
    } else if (d !== value) {
      onChange(d)
    }
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
    const i = DIFFICULTIES.indexOf(value as SelectableDifficulty)
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

  const pos = isMax ? MAX_POS : { x: dragX ?? DOT_X[value as SelectableDifficulty], y: RING.cy }

  return (
    <div className="picker">
      {/* 操作はポインター用。キーボードと読み上げは下のボタンで同じことができる */}
      <svg
        ref={svgRef}
        className={`dial ${dragX !== null ? 'is-dragging' : ''} ${isMax ? 'is-max' : ''}`}
        viewBox="0 0 240 140"
        aria-hidden="true"
        focusable="false"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke="var(--ink)" strokeWidth="12" />
        <circle
          className="dial__dot"
          cx="0"
          cy="0"
          r="18"
          fill="var(--accent)"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        />
      </svg>
      {isMax ? (
        <p className="max-label" role="status">
          MAX
        </p>
      ) : (
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
      )}
    </div>
  )
}
