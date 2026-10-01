/**
 * 重みから次の予想を選ぶ。training/hitblow/policy.py と同じ手順。
 * Q(s, a) を全 5,040 予想について計算し、すでに予想した数字を除いて最大のものを選ぶ。
 */
import { ALL_CODES, MAX_TURNS } from '../game/codes'
import { N_ACTION, N_CODES, N_STATE, actionFeatures, codeIndex, feedback, posFreq, stateFeatures } from './features'

export const TIE_EPS = 1e-9

export interface Manifest {
  version: number
  sizes: number[]
  files: Record<string, string>
}

export interface Layer {
  w: Float64Array // (out, in) 行優先
  b: Float64Array
  nIn: number
  nOut: number
}

export function parseWeights(buffer: ArrayBuffer, sizes: number[]): Layer[] {
  const view = new DataView(buffer)
  let off = 0
  const read = (n: number) => {
    const a = new Float64Array(n)
    for (let i = 0; i < n; i++, off += 4) a[i] = view.getFloat32(off, true)
    return a
  }
  const layers: Layer[] = []
  for (let l = 0; l + 1 < sizes.length; l++) {
    const nIn = sizes[l]
    const nOut = sizes[l + 1]
    const w = read(nIn * nOut)
    const b = read(nOut)
    layers.push({ w, b, nIn, nOut })
  }
  if (off !== buffer.byteLength) throw new Error('weights size mismatch')
  return layers
}

/** 状態特徴は全予想で共通なので、1 層目の状態部分を先に計算してから予想ごとの部分を足す。 */
export function qValues(layers: Layer[], state: Float64Array, actions: Float64Array): Float64Array {
  const [l1, ...rest] = layers
  const base = new Float64Array(l1.nOut)
  for (let o = 0; o < l1.nOut; o++) {
    let s = l1.b[o]
    const row = o * l1.nIn
    for (let i = 0; i < N_STATE; i++) s += l1.w[row + i] * state[i]
    base[o] = s
  }
  const q = new Float64Array(N_CODES)
  const bufs = [new Float64Array(l1.nOut), ...rest.map((l) => new Float64Array(l.nOut))]
  for (let g = 0; g < N_CODES; g++) {
    const a = g * N_ACTION
    const h = bufs[0]
    for (let o = 0; o < l1.nOut; o++) {
      let s = base[o]
      const row = o * l1.nIn + N_STATE
      for (let i = 0; i < N_ACTION; i++) s += l1.w[row + i] * actions[a + i]
      h[o] = s > 0 ? s : 0
    }
    for (let l = 0; l < rest.length; l++) {
      const { w, b, nIn, nOut } = rest[l]
      const x = bufs[l]
      const y = bufs[l + 1]
      const last = l === rest.length - 1
      for (let o = 0; o < nOut; o++) {
        let s = b[o]
        const row = o * nIn
        for (let i = 0; i < nIn; i++) s += w[row + i] * x[i]
        y[o] = !last && s < 0 ? 0 : s
      }
    }
    q[g] = bufs[rest.length][0]
  }
  return q
}

/** 同点(最大との差が TIE_EPS 以内)のうち、rand があればランダム、なければ最小インデックスを選ぶ。 */
export function select(q: Float64Array, guessed: readonly number[], rand?: () => number): number {
  const masked = new Uint8Array(N_CODES)
  for (const g of guessed) masked[g] = 1
  let best = -Infinity
  for (let g = 0; g < N_CODES; g++) if (!masked[g] && q[g] > best) best = q[g]
  const ties: number[] = []
  for (let g = 0; g < N_CODES; g++) if (!masked[g] && q[g] >= best - TIE_EPS) ties.push(g)
  return rand ? ties[Math.floor(rand() * ties.length)] : ties[0]
}

export interface OwnTurn {
  guess: string
  hit: number
  blow: number
}

export function candidatesFrom(turns: readonly OwnTurn[]): Int32Array {
  let cands = Int32Array.from({ length: N_CODES }, (_, i) => i)
  for (const t of turns) {
    const g = codeIndex(t.guess)
    const r = t.hit * 5 + t.blow
    cands = cands.filter((c) => feedback(g, c) === r)
  }
  return cands
}

/** CPU 自身のこれまでの予想と判定から、次の予想を返す。 */
export function chooseGuess(layers: Layer[], turns: readonly OwnTurn[], rand?: () => number): string {
  if (turns.length >= MAX_TURNS) throw new Error('no turns left')
  const cands = candidatesFrom(turns)
  const freq = posFreq(cands)
  const q = qValues(layers, stateFeatures(cands, turns.length, freq), actionFeatures(cands, freq))
  return ALL_CODES[select(q, turns.map((t) => codeIndex(t.guess)), rand)]
}
