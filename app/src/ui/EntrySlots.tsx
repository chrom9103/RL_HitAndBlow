import { useEffect, useRef, type KeyboardEvent } from 'react'
import { CODE_LENGTH } from '../game/codes'
import type { Entry } from '../game/entry'

interface Props {
  entry: Entry
  /** プレイヤーの手番か */
  active: boolean
  onSelect: (i: number) => void
  /** ↓ キーでテンキーへ移るとき */
  onExitDown: () => void
}

const PLACE_LABEL = ['千の位', '百の位', '十の位', '一の位']

export function EntrySlots({ entry, active, onSelect, onExitDown }: Props) {
  const groupRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<(HTMLButtonElement | null)[]>([])
  // Tab で止まる桁(roving tabindex)。全桁埋まっているときは一の位
  const tabStop = Math.min(entry.cursor, CODE_LENGTH - 1)

  // フォーカスが入力欄にある間は、カーソルの桁にフォーカスを追従させる
  useEffect(() => {
    if (entry.cursor >= CODE_LENGTH) return
    if (groupRef.current?.contains(document.activeElement)) slotsRef.current[entry.cursor]?.focus()
  }, [entry.cursor])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    const i = Number((e.target as HTMLElement).dataset.index ?? tabStop)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // GameScreen 側の矢印キー処理に渡さない
      e.preventDefault()
      onSelect(i + (e.key === 'ArrowLeft' ? -1 : 1))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onExitDown()
    }
  }

  return (
    <div ref={groupRef} className={`entry ${active ? '' : 'is-waiting'}`} role="group" aria-label="入力中の数字" onKeyDown={onKeyDown}>
      {entry.digits.map((d, i) => (
        <button
          key={i}
          ref={(el) => {
            slotsRef.current[i] = el
          }}
          type="button"
          data-index={i}
          tabIndex={i === tabStop ? 0 : -1}
          className={`entry__slot ${i === entry.cursor && active ? 'is-cursor' : ''}`}
          // クリックでフォーカスを奪わない(Enter での決定を妨げないため)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(i)}
          disabled={!active}
          aria-label={`${PLACE_LABEL[i]}: ${d || '空欄'}`}
          aria-pressed={i === entry.cursor}
          aria-keyshortcuts={`Shift+${i + 1}`}
        >
          {d}
        </button>
      ))}
    </div>
  )
}
