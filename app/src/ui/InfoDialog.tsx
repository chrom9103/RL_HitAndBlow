import { useEffect, useRef } from 'react'
import { RulesList } from './Rules'

interface Props {
  open: boolean
  onClose: () => void
}

const KEYS: [string, string][] = [
  ['0 〜 9', '数字を入力'],
  ['Shift + 1 〜 4', '千の位〜一の位を選ぶ'],
  ['← →', '入力する位を移動'],
  ['Backspace', '1 文字消す'],
  ['Enter', '決定'],
  ['H', 'ヒントを開く・閉じる'],
  ['Esc', '入力を消す'],
]

/** ゲーム中に開く「遊び方」と「キーボード操作」。モーダルの <dialog> で、Esc や背景のクリックで閉じる */
export function InfoDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="info"
      aria-labelledby="info-title"
      onClose={onClose}
      // 背景(dialog 自身)のクリックで閉じる
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="info__body">
        <button type="button" className="info__close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
        <h2 id="info-title" className="info__title">
          遊び方
        </h2>
        <RulesList />
        <section className="info__keys" aria-labelledby="info-keys-title">
          <h2 id="info-keys-title" className="info__title">
            キーボード操作
          </h2>
          <dl className="keys">
            {KEYS.map(([k, v]) => (
              <div key={k} className="keys__row">
                <dt>
                  <kbd className="keycap">{k}</kbd>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </dialog>
  )
}
