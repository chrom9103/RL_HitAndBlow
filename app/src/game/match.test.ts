import { describe, expect, it } from 'vitest'
import { applyGuess, createMatch, type Match } from './match'

const SECRET = '4071'
const MISS = '5689' // 全不一致

function play(moves: string[][]): Match {
  // moves[i] = [プレイヤーの予想, CPU の予想]
  let m = createMatch(SECRET)
  for (const [p, c] of moves) {
    m = applyGuess(m, 'player', p)
    if (c !== undefined) m = applyGuess(m, 'cpu', c)
  }
  return m
}

const misses = (n: number) => Array.from({ length: n }, () => [MISS, MISS])

describe('match', () => {
  it('先攻はプレイヤーで、交互に進む', () => {
    let m = createMatch(SECRET)
    expect(m.next).toBe('player')
    expect(() => applyGuess(m, 'cpu', MISS)).toThrow()
    m = applyGuess(m, 'player', MISS)
    expect(m.next).toBe('cpu')
    expect(() => applyGuess(m, 'player', MISS)).toThrow()
    m = applyGuess(m, 'cpu', MISS)
    expect(m.next).toBe('player')
    expect(m.outcome).toBeNull()
  })

  it('プレイヤーが先に当てても、CPU の同じ回の手番まで確定しない', () => {
    let m = play([...misses(2), [SECRET]])
    expect(m.outcome).toBeNull()
    expect(m.next).toBe('cpu')
    m = applyGuess(m, 'cpu', MISS)
    expect(m.outcome).toMatchObject({ result: 'win', playerTurns: 3, cpuTurns: 3, playerSolved: true, cpuSolved: false })
    expect(m.next).toBeNull()
  })

  it('同じ回で双方が当てれば引き分け', () => {
    const m = play([...misses(3), [SECRET, SECRET]])
    expect(m.outcome).toMatchObject({ result: 'draw', playerTurns: 4, cpuTurns: 4 })
  })

  it('CPU だけが当てれば負け', () => {
    const m = play([...misses(1), [MISS, SECRET]])
    expect(m.outcome).toMatchObject({ result: 'lose', playerTurns: 2, cpuTurns: 2, cpuSolved: true })
  })

  it('1 回目で当てた場合も CPU の 1 回目まで進む', () => {
    let m = applyGuess(createMatch(SECRET), 'player', SECRET)
    expect(m.outcome).toBeNull()
    m = applyGuess(m, 'cpu', SECRET)
    expect(m.outcome?.result).toBe('draw')
  })

  it('10 回目に当てれば勝ち', () => {
    const m = play([...misses(9), [SECRET, MISS]])
    expect(m.outcome).toMatchObject({ result: 'win', playerTurns: 10, cpuTurns: 10 })
  })

  it('双方 10 回で当てられなければ引き分け', () => {
    const m = play(misses(10))
    expect(m.outcome).toMatchObject({ result: 'draw', playerSolved: false, cpuSolved: false, playerTurns: 10, cpuTurns: 10 })
  })

  it('終了後は予想できない', () => {
    const m = play(misses(10))
    expect(() => applyGuess(m, 'player', MISS)).toThrow()
  })

  it('判定が履歴に記録される', () => {
    const m = play([['4170', '0123']])
    expect(m.player[0]).toEqual({ guess: '4170', hit: 2, blow: 2 })
    expect(m.cpu[0]).toEqual({ guess: '0123', hit: 0, blow: 2 })
  })
})
