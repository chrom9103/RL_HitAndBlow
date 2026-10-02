/**
 * 難易度 Max の決定木(training/solve_optimal.py が生成)を、秘密の数字 5,040 通りすべてで打たせて確認する。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_CODES, judge } from '../game/codes'
import type { OwnTurn } from './policy'
import { applySymmetry, IDENTITY, parseTree, randomSymmetry, treeGuess, type Symmetry } from './tree'

const weightsDir = fileURLToPath(new URL('../../public/weights/', import.meta.url))
const buf = readFileSync(weightsDir + 'max.bin')
const tree = parseTree(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const summary = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../training/optimal.json', import.meta.url)), 'utf8'),
) as { total_turns: number; max_turns: number }

function play(secret: string, sym: Symmetry): number {
  const turns: OwnTurn[] = []
  for (;;) {
    const guess = treeGuess(tree, turns, sym)
    const j = judge(secret, guess)
    turns.push({ guess, ...j })
    if (j.hit === 4) return turns.length
  }
}

/** 再現できる乱数(mulberry32) */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('難易度 Max の決定木', () => {
  it('1 手目は 0123', () => {
    expect(treeGuess(tree, [])).toBe('0123')
  })

  it('5,040 通りすべてを当て、総手数が最適値と一致する', () => {
    let total = 0
    let worst = 0
    for (const secret of ALL_CODES) {
      const n = play(secret, IDENTITY)
      total += n
      worst = Math.max(worst, n)
    }
    expect(total).toBe(summary.total_turns)
    expect(worst).toBe(summary.max_turns)
    expect(total / ALL_CODES.length).toBeLessThan(5.22)
  })

  it('付け替えをしても判定は変わらず、総手数も同じ', () => {
    const rand = rng(42)
    for (let k = 0; k < 3; k++) {
      const sym = randomSymmetry(rand)
      const secret = ALL_CODES[Math.floor(rand() * ALL_CODES.length)]
      const guess = ALL_CODES[Math.floor(rand() * ALL_CODES.length)]
      expect(judge(applySymmetry(sym, secret), applySymmetry(sym, guess))).toEqual(judge(secret, guess))
      let total = 0
      for (const s of ALL_CODES) total += play(s, sym)
      expect(total).toBe(summary.total_turns)
    }
  })

  it('木から外れた履歴はエラーにする', () => {
    expect(() => treeGuess(tree, [{ guess: '4567', hit: 0, blow: 0 }])).toThrow()
  })
})
