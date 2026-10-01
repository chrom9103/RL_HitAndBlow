import { describe, expect, it } from 'vitest'
import { ALL_CODES, judge } from '../game/codes'
import { consistentCodes } from '../game/candidates'
import { N_CODES, N_FEEDBACK, WIN_FEEDBACK, feedback } from '../cpu/features'
import { bestGuess, candidatesFrom, hint } from './minimax'

const clue = (guess: string, hit: number, blow: number) => ({ guess, hit, blow })

describe('minimax hint', () => {
  it('候補は consistentCodes と一致する', () => {
    const secret = '4071'
    const clues = ['0123', '4567', '8901'].map((g) => ({ guess: g, ...judge(secret, g) }))
    expect(candidatesFrom(clues).map((i) => ALL_CODES[i])).toEqual(consistentCodes(clues))
  })

  it('参考の経過: 1234 → 0156 → 0345 → 0457', () => {
    const clues = [clue('1234', 0, 1), clue('0156', 2, 0)]
    expect(candidatesFrom(clues)).toHaveLength(57)
    clues.push(clue('0345', 1, 2))
    const h = hint(clues)
    expect(h.remaining).toBe(6)
    expect(h.isCandidate).toBe(true)
    expect(candidatesFrom(clues).map((i) => ALL_CODES[i])).toContain('0457')
  })

  it('1 手目は最大 1,440 通りに分かれる', () => {
    const h = hint([])
    expect(h).toMatchObject({ remaining: 5040, worst: 1440, isCandidate: true })
  })

  it('候補が 2 つ以下なら候補から選ぶ', () => {
    expect(bestGuess([7, 9])).toMatchObject({ guess: 7, worst: 1, isCandidate: true })
    expect(bestGuess([7])).toMatchObject({ guess: 7, worst: 0, isCandidate: true })
  })

  it('全 5,040 通りの秘密の数字を 7 回以内に当てる', () => {
    const dist = new Array<number>(11).fill(0)
    // 同じ局面は同じ予想になるので、判定ごとに候補を分けて木をたどる
    const walk = (cands: number[], depth: number) => {
      const { guess } = bestGuess(cands)
      const parts: number[][] = Array.from({ length: N_FEEDBACK }, () => [])
      for (const s of cands) parts[feedback(guess, s)].push(s)
      dist[depth] += parts[WIN_FEEDBACK].length
      parts.forEach((p, r) => {
        if (r !== WIN_FEEDBACK && p.length > 0) walk(p, depth + 1)
      })
    }
    walk(Array.from({ length: N_CODES }, (_, i) => i), 1)

    const total = dist.reduce((a, b) => a + b, 0)
    const sum = dist.reduce((a, n, d) => a + n * d, 0)
    console.log(`minimax: 平均 ${(sum / total).toFixed(4)} 回 (${sum}/${total}), 分布`, dist.slice(1).join(' / '))
    expect(total).toBe(N_CODES)
    expect(dist.slice(8).every((n) => n === 0)).toBe(true)
  }, 120_000)
})
