/**
 * プレイヤー向けのヒント。ミニマックス法で次の予想を選ぶ(CPU の対戦相手とは別)。
 *
 * 1. 全 5,040 通りのうち、これまでの予想と判定に矛盾しない候補を残す
 * 2. 考えられるすべての予想(候補以外も含む)について、返ってくる判定ごとに候補を分ける
 * 3. 一番大きいグループが最小になる予想を選ぶ。同じなら候補に含まれる予想(当たる可能性がある)、
 *    それでも同じならグループの大きさの二乗和(期待残り候補数に比例)が小さいもの、最後は辞書順で先のもの
 */
import { ALL_CODES } from '../game/codes'
import type { Clue } from '../game/candidates'
import { N_CODES, N_FEEDBACK, WIN_FEEDBACK, codeIndex, feedback } from '../cpu/features'

export interface Hint {
  /** おすすめの予想 */
  guess: string
  /** いまの候補数 */
  remaining: number
  /** その予想の後に残る候補数の最大(当たって終わる場合は 0) */
  worst: number
  /** おすすめの予想が候補に含まれる(当たる可能性がある) */
  isCandidate: boolean
}

export interface Choice {
  guess: number
  /** 判定ごとのグループの最大(正解のグループも 1 として数える) */
  maxGroup: number
  /** 正解以外のグループの最大 */
  worst: number
  isCandidate: boolean
}

/** これまでの予想と判定に矛盾しない候補(ALL_CODES のインデックス) */
export function candidatesFrom(clues: readonly Clue[]): number[] {
  const fb = clues.map((c) => ({ g: codeIndex(c.guess), r: c.hit * 5 + c.blow }))
  const out: number[] = []
  for (let s = 0; s < N_CODES; s++) {
    if (fb.every(({ g, r }) => feedback(g, s) === r)) out.push(s)
  }
  return out
}

function groups(g: number, cands: readonly number[], counts: Int32Array, limit: number): number {
  counts.fill(0)
  let max = 0
  for (let k = 0; k < cands.length; k++) {
    const n = ++counts[feedback(g, cands[k])]
    if (n > max) {
      max = n
      // 現在の最良より大きくなったら、この予想は選ばれない
      if (max > limit) return max
    }
  }
  return max
}

function sumSquares(counts: Int32Array): number {
  let sq = 0
  for (let r = 0; r < N_FEEDBACK; r++) sq += counts[r] * counts[r]
  return sq
}

function worstOf(counts: Int32Array): number {
  let w = 0
  for (let r = 0; r < N_FEEDBACK; r++) if (r !== WIN_FEEDBACK && counts[r] > w) w = counts[r]
  return w
}

/** ミニマックス法で次の予想を選ぶ。cands は空でないこと。 */
export function bestGuess(cands: readonly number[]): Choice {
  const m = cands.length
  if (m === 0) throw new Error('候補がありません')
  if (m <= 2) return { guess: cands[0], maxGroup: 1, worst: m - 1, isCandidate: true }

  const counts = new Int32Array(N_FEEDBACK)
  if (m === N_CODES) {
    // 1 手目: 対称性により、どの予想も同じ分かれ方になる
    const max = groups(0, cands, counts, Infinity)
    return { guess: 0, maxGroup: max, worst: worstOf(counts), isCandidate: true }
  }

  const inC = new Uint8Array(N_CODES)
  for (const c of cands) inC[c] = 1

  let best = -1
  let bestMax = Infinity
  let bestIn = 0
  let bestSq = Infinity
  for (let g = 0; g < N_CODES; g++) {
    const max = groups(g, cands, counts, bestMax)
    if (max > bestMax || (max === bestMax && inC[g] < bestIn)) continue
    const sq = sumSquares(counts)
    if (max < bestMax || inC[g] > bestIn || sq < bestSq) {
      best = g
      bestMax = max
      bestIn = inC[g]
      bestSq = sq
    }
  }
  groups(best, cands, counts, Infinity)
  return { guess: best, maxGroup: bestMax, worst: worstOf(counts), isCandidate: bestIn === 1 }
}

export function hint(clues: readonly Clue[]): Hint {
  const cands = candidatesFrom(clues)
  const choice = bestGuess(cands)
  return {
    guess: ALL_CODES[choice.guess],
    remaining: cands.length,
    worst: choice.worst,
    isCandidate: choice.isCandidate,
  }
}
