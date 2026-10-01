import { describe, expect, it } from 'vitest'
import { ALL_CODES, judge } from './codes'
import { consistentCodes, filterCandidates } from './candidates'

describe('candidates', () => {
  it('手がかりなしなら全候補', () => {
    expect(consistentCodes([])).toHaveLength(5040)
  })

  it('最初の判定ごとの候補数(既知の値)', () => {
    const count = (hit: number, blow: number) => filterCandidates(ALL_CODES, { guess: '0123', hit, blow }).length
    expect(count(0, 0)).toBe(360)
    expect(count(0, 1)).toBe(1440)
    expect(count(0, 4)).toBe(9)
    expect(count(4, 0)).toBe(1)
    expect(count(3, 0)).toBe(24)
    expect(count(3, 1)).toBe(0)
  })

  it('秘密の数字は常に候補に残り、候補はすべて手がかりと矛盾しない', () => {
    const secret = '4071'
    const clues = ['0123', '4567', '8901', '4170'].map((guess) => ({ guess, ...judge(secret, guess) }))
    const cands = consistentCodes(clues)
    expect(cands).toContain(secret)
    for (const c of cands) for (const clue of clues) {
      expect(judge(c, clue.guess)).toEqual({ hit: clue.hit, blow: clue.blow })
    }
  })
})
