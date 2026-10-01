/**
 * 候補集合から特徴量を作る。training/hitblow/features.py と同じ定義・同じ加算順。
 *
 * 状態特徴(43): log2|C|/log2 5040, 手数/10, |C|==1, 桁×数字の出現割合(4x10)
 * 行動特徴(8): 候補に含まれる, 即正解確率, 期待残り候補率, 判定分布のエントロピー,
 *              最大バケット率, 空でないバケット数, 桁頻度スコア, 期待 log 残り候補数
 */
import { ALL_CODES } from '../game/codes'

export const N_CODES = 5040
export const N_STATE = 43
export const N_ACTION = 8
export const N_FEEDBACK = 25
export const WIN_FEEDBACK = 20

const LOG2_N = Math.log2(N_CODES)
const LOG2_14 = Math.log2(14)

/** DIGITS[i*4 + p] = i 番目のコードの p 桁目 */
export const DIGITS = new Int8Array(N_CODES * 4)
/** 使っている数字の 10 ビットマスク */
const MASKS = new Int32Array(N_CODES)
const CODE_INDEX = new Map<string, number>()
ALL_CODES.forEach((code, i) => {
  let mask = 0
  for (let p = 0; p < 4; p++) {
    const d = code.charCodeAt(p) - 48
    DIGITS[i * 4 + p] = d
    mask |= 1 << d
  }
  MASKS[i] = mask
  CODE_INDEX.set(code, i)
})

export function codeIndex(code: string): number {
  const i = CODE_INDEX.get(code)
  if (i === undefined) throw new Error(`invalid code: ${code}`)
  return i
}

function popcount(x: number): number {
  let n = 0
  while (x) {
    x &= x - 1
    n++
  }
  return n
}

/** 予想 g・秘密 s の判定を hit*5 + blow で返す */
export function feedback(g: number, s: number): number {
  const a = g * 4
  const b = s * 4
  const hit =
    (DIGITS[a] === DIGITS[b] ? 1 : 0) +
    (DIGITS[a + 1] === DIGITS[b + 1] ? 1 : 0) +
    (DIGITS[a + 2] === DIGITS[b + 2] ? 1 : 0) +
    (DIGITS[a + 3] === DIGITS[b + 3] ? 1 : 0)
  return hit * 5 + popcount(MASKS[g] & MASKS[s]) - hit
}

export function posFreq(cands: ArrayLike<number>): Float64Array {
  const m = cands.length
  const counts = new Float64Array(40)
  for (let k = 0; k < m; k++) {
    const i = cands[k] * 4
    for (let p = 0; p < 4; p++) counts[p * 10 + DIGITS[i + p]]++
  }
  for (let j = 0; j < 40; j++) counts[j] = counts[j] / m
  return counts
}

export function stateFeatures(cands: ArrayLike<number>, turn: number, freq = posFreq(cands)): Float64Array {
  const m = cands.length
  const s = new Float64Array(N_STATE)
  s[0] = Math.log2(m) / LOG2_N
  s[1] = turn / 10
  s[2] = m === 1 ? 1 : 0
  s.set(freq, 3)
  return s
}

function actionRow(out: Float64Array, o: number, counts: Float64Array, m: number, inC: number, g: number, freq: Float64Array) {
  let sq = 0
  let plogp = 0
  let plogn = 0
  let max = 0
  let nonEmpty = 0
  for (let r = 0; r < N_FEEDBACK; r++) {
    const c = counts[r]
    const p = c / m
    sq += p * p
    if (c > 0) {
      plogp += p * Math.log2(p)
      plogn += p * Math.log2(c)
      nonEmpty++
    }
    if (c > max) max = c
  }
  const i = g * 4
  out[o] = inC
  out[o + 1] = inC / m
  out[o + 2] = sq
  out[o + 3] = -plogp / LOG2_14
  out[o + 4] = max / m
  out[o + 5] = nonEmpty / 14
  out[o + 6] = (freq[DIGITS[i]] + freq[10 + DIGITS[i + 1]] + freq[20 + DIGITS[i + 2]] + freq[30 + DIGITS[i + 3]]) / 4
  out[o + 7] = plogn / LOG2_N
}

/** 全 5,040 予想の行動特徴(行優先で 5040 x 8) */
export function actionFeatures(cands: ArrayLike<number>, freq = posFreq(cands)): Float64Array {
  const m = cands.length
  const out = new Float64Array(N_CODES * N_ACTION)
  const inC = new Uint8Array(N_CODES)
  for (let k = 0; k < m; k++) inC[cands[k]] = 1
  const counts = new Float64Array(N_FEEDBACK)

  if (m === N_CODES) {
    // 1 手目: 対称性により、どの予想も同じ特徴になる
    for (let s = 0; s < N_CODES; s++) counts[feedback(0, s)]++
    actionRow(out, 0, counts, m, 1, 0, freq)
    for (let g = 1; g < N_CODES; g++) out.copyWithin(g * N_ACTION, 0, N_ACTION)
    return out
  }

  for (let g = 0; g < N_CODES; g++) {
    counts.fill(0)
    for (let k = 0; k < m; k++) counts[feedback(g, cands[k])]++
    actionRow(out, g * N_ACTION, counts, m, inC[g], g, freq)
  }
  return out
}
