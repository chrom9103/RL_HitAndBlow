import { useRef, useState, type KeyboardEvent } from 'react'
import { CODE_LENGTH } from '../game/codes'

interface Props {
  value: string
  disabled: boolean
  onDigit: (d: string) => void
  onDelete: () => void
  onSubmit: () => void
  /** 一番上の段で ↑ を押して入力欄へ移るとき */
  onExitUp: () => void
}

/** 画面上の並び順(3 列)。矢印キーの移動もこの並びに沿う。 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'delete', '0', 'submit'] as const
const COLS = 3

/** 矢印キーで移動したときの行き先。端では止まる。 */
function moveIndex(i: number, key: string): number | null {
  switch (key) {
    case 'ArrowLeft':
      return i % COLS === 0 ? i : i - 1
    case 'ArrowRight':
      return i % COLS === COLS - 1 ? i : i + 1
    case 'ArrowUp':
      return i < COLS ? i : i - COLS
    case 'ArrowDown':
      return i + COLS >= KEYS.length ? i : i + COLS
    default:
      return null
  }
}

export function Keypad({ value, disabled, onDigit, onDelete, onSubmit, onExitUp }: Props) {
  // フォーカスを受け持つキー(roving tabindex)。Tab ではテンキー全体で 1 か所だけ止まる
  const [active, setActive] = useState(0)
  const keysRef = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    if (e.key === 'ArrowUp' && active < COLS) {
      e.preventDefault()
      onExitUp()
      return
    }
    const next = moveIndex(active, e.key)
    if (next === null) return
    // GameScreen 側の矢印キー処理(位の移動)に渡さない
    e.preventDefault()
    setActive(next)
    keysRef.current[next]?.focus()
  }

  return (
    <div className="keypad" role="group" aria-label="数字の入力" onKeyDown={onKeyDown}>
      {KEYS.map((k, i) => {
        const common = {
          ref: (el: HTMLButtonElement | null) => {
            keysRef.current[i] = el
          },
          type: 'button' as const,
          tabIndex: i === active ? 0 : -1,
          onFocus: () => setActive(i),
          disabled,
        }
        if (k === 'delete') {
          return (
            <button key={k} {...common} className="key key--action" onClick={onDelete} aria-disabled={value.length === 0}>
              削除
            </button>
          )
        }
        if (k === 'submit') {
          return (
            <button key={k} {...common} className="key key--submit" onClick={onSubmit} aria-disabled={value.length !== CODE_LENGTH}>
              決定
            </button>
          )
        }
        const used = value.includes(k)
        return (
          <button
            key={k}
            {...common}
            className={`key ${used ? 'is-used' : ''}`}
            onClick={() => onDigit(k)}
            aria-label={used ? `${k}(入力済み)` : k}
          >
            {k}
          </button>
        )
      })}
    </div>
  )
}
