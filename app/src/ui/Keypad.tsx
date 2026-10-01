import { CODE_LENGTH } from '../game/codes'

interface Props {
  value: string
  disabled: boolean
  onDigit: (d: string) => void
  onDelete: () => void
  onSubmit: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ value, disabled, onDigit, onDelete, onSubmit }: Props) {
  return (
    <div className="keypad" role="group" aria-label="数字の入力">
      {DIGITS.map((d) => (
        <DigitKey key={d} d={d} used={value.includes(d)} disabled={disabled} onDigit={onDigit} />
      ))}
      <button type="button" className="key key--action" onClick={onDelete} disabled={disabled || value.length === 0}>
        削除
      </button>
      <DigitKey d="0" used={value.includes('0')} disabled={disabled} onDigit={onDigit} />
      <button
        type="button"
        className="key key--submit"
        onClick={onSubmit}
        disabled={disabled}
        aria-disabled={value.length !== CODE_LENGTH}
      >
        決定
      </button>
    </div>
  )
}

function DigitKey({ d, used, disabled, onDigit }: { d: string; used: boolean; disabled: boolean; onDigit: (d: string) => void }) {
  return (
    <button
      type="button"
      className={`key ${used ? 'is-used' : ''}`}
      onClick={() => onDigit(d)}
      disabled={disabled}
      aria-label={used ? `${d}(入力済み)` : d}
    >
      {d}
    </button>
  )
}
