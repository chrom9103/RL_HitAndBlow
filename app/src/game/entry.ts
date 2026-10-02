import { CODE_LENGTH } from './codes'

/**
 * 入力欄の状態。digits は各桁の数字(空欄は '')、cursor は次に入力する桁。
 * cursor === CODE_LENGTH は「全桁埋まっていて入力先がない」状態。
 */
export interface Entry {
  digits: readonly string[]
  cursor: number
}

export function emptyEntry(): Entry {
  return { digits: Array(CODE_LENGTH).fill(''), cursor: 0 }
}

export function entryFromCode(code: string): Entry {
  return { digits: [...code], cursor: CODE_LENGTH }
}

/** 埋まっている桁を左から連結した文字列。全桁埋まっていれば予想そのもの。 */
export function entryValue(e: Entry): string {
  return e.digits.join('')
}

export function isFull(e: Entry): boolean {
  return e.digits.every((d) => d !== '')
}

/** from の次の空欄を右へ探し、なければ先頭に戻って探す。どこも埋まっていれば CODE_LENGTH。 */
function nextEmpty(digits: readonly string[], from: number): number {
  for (let k = 1; k <= CODE_LENGTH; k++) {
    const i = (from + k) % CODE_LENGTH
    if (digits[i] === '') return i
  }
  return CODE_LENGTH
}

/** カーソルの桁に d を入れ、次の空欄へ進む。重複や入力先なしの判定は呼び出し側で行う。 */
export function typeDigit(e: Entry, d: string): Entry {
  if (e.cursor >= CODE_LENGTH) return e
  const digits = [...e.digits]
  digits[e.cursor] = d
  return { digits, cursor: nextEmpty(digits, e.cursor) }
}

/** カーソルの桁が埋まっていればそれを消す。空欄なら左側で最も近い数字を消し、そこへ移る。 */
export function deleteDigit(e: Entry): Entry {
  const digits = [...e.digits]
  if (e.cursor < CODE_LENGTH && digits[e.cursor] !== '') {
    digits[e.cursor] = ''
    return { digits, cursor: e.cursor }
  }
  for (let i = Math.min(e.cursor, CODE_LENGTH) - 1; i >= 0; i--) {
    if (digits[i] !== '') {
      digits[i] = ''
      return { digits, cursor: i }
    }
  }
  return e
}

export function moveCursor(e: Entry, i: number): Entry {
  return { ...e, cursor: Math.max(0, Math.min(CODE_LENGTH - 1, i)) }
}
