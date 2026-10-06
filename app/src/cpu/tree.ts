/**
 * 難易度 Max: 平均回数を最小にする最適戦略の決定木をたどる。木は training/solve_optimal.py が生成する。
 *
 * 形式(max.bin): ノードを前順に並べ、1 ノード 6 バイト(リトルエンディアン)。
 *   uint16 予想のインデックス, uint32 子を持つ判定のビットマスク(ビット r = hit*5 + blow、当たりは含まない)
 * 子はビットの小さい判定から順に、ノードの直後に続く。
 *
 * 毎回同じ予想にならないよう、ゲームごとに「桁の並べ替え × 数字の付け替え」をランダムに 1 つ選び、
 * 木の予想に掛けてから打つ。秘密の数字は一様にランダムなので、どの付け替えでも平均回数は変わらない
 * (判定は両方に同じ付け替えを掛けても変わらない)。
 */
import { ALL_CODES, MAX_TURNS } from '../game/codes'
import { N_FEEDBACK } from './features'
import type { OwnTurn } from './policy'

export interface DecisionTree {
  guess: Uint16Array
  /** child[node * N_FEEDBACK + r] = 判定 r のときの子ノード(なければ -1) */
  child: Int32Array
}

const NODE_BYTES = 6

export function parseTree(buffer: ArrayBuffer): DecisionTree {
  const view = new DataView(buffer)
  const n = buffer.byteLength / NODE_BYTES
  if (!Number.isInteger(n) || n === 0) throw new Error('tree size mismatch')
  const guess = new Uint16Array(n)
  const child = new Int32Array(n * N_FEEDBACK).fill(-1)
  let next = 0
  const read = (): number => {
    if (next >= n) throw new Error('tree truncated')
    const node = next++
    const off = node * NODE_BYTES
    guess[node] = view.getUint16(off, true)
    const mask = view.getUint32(off + 2, true)
    for (let r = 0; r < N_FEEDBACK; r++) if (mask & (1 << r)) child[node * N_FEEDBACK + r] = read()
    return node
  }
  read()
  if (next !== n) throw new Error('tree has trailing nodes')
  return { guess, child }
}

/** 桁の並べ替え pos と数字の付け替え digit。apply(c)[i] = digit[c[pos[i]]] */
export interface Symmetry {
  pos: readonly number[]
  digit: readonly number[]
}

export const IDENTITY: Symmetry = { pos: [0, 1, 2, 3], digit: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }

function shuffled(n: number, rand: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function randomSymmetry(rand: () => number): Symmetry {
  return { pos: shuffled(4, rand), digit: shuffled(10, rand) }
}

export function applySymmetry(sym: Symmetry, code: string): string {
  let out = ''
  for (let i = 0; i < 4; i++) out += sym.digit[code.charCodeAt(sym.pos[i]) - 48]
  return out
}

/** CPU 自身のこれまでの予想と判定から、木をたどって次の予想を返す。 */
export function treeGuess(tree: DecisionTree, turns: readonly OwnTurn[], sym: Symmetry = IDENTITY): string {
  if (turns.length >= MAX_TURNS) throw new Error('no turns left')
  let node = 0
  for (const t of turns) {
    if (applySymmetry(sym, ALL_CODES[tree.guess[node]]) !== t.guess) throw new Error('history does not follow the tree')
    node = tree.child[node * N_FEEDBACK + t.hit * 5 + t.blow]
    if (node < 0) throw new Error('judgement not in the tree')
  }
  return applySymmetry(sym, ALL_CODES[tree.guess[node]])
}
