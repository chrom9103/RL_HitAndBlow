import { describe, expect, it } from 'vitest'
import { ALL_CODES, judge, validateGuess } from './codes'

describe('ALL_CODES', () => {
  it('5,040 通りで重複がなく、辞書順', () => {
    expect(ALL_CODES).toHaveLength(5040)
    expect(new Set(ALL_CODES).size).toBe(5040)
    expect(ALL_CODES[0]).toBe('0123')
    expect(ALL_CODES[5039]).toBe('9876')
    expect([...ALL_CODES].sort()).toEqual(ALL_CODES)
    for (const c of ALL_CODES) expect(new Set(c).size).toBe(4)
  })
})

describe('judge', () => {
  it.each([
    ['4071', '4071', 4, 0, 'Hit4(正解)'],
    ['1234', '4321', 0, 4, 'Blow4(すべて逆順)'],
    ['1234', '2143', 0, 4, 'Blow4(ペア入れ替え)'],
    ['1234', '5678', 0, 0, '全不一致'],
    ['1234', '1243', 2, 2, 'Hit2 Blow2'],
    ['1234', '1325', 1, 2, 'Hit1 Blow2'],
    ['1234', '1567', 1, 0, 'Hit1 のみ'],
    ['1234', '5671', 0, 1, 'Blow1 のみ'],
    ['1234', '1235', 3, 0, 'Hit3'],
    ['0123', '3012', 0, 4, '0 を含む Blow4'],
    ['9870', '0789', 0, 4, '端の桁の Blow'],
    ['4071', '1047', 1, 3, 'Hit1 Blow3'],
  ])('%s vs %s → %iH %iB (%s)', (secret, guess, hit, blow) => {
    expect(judge(secret, guess)).toEqual({ hit, blow })
  })

  it('判定は対称で、Hit3 Blow1 は起こらない', () => {
    const seen = new Set<string>()
    for (let i = 0; i < ALL_CODES.length; i += 7) {
      for (let j = 0; j < ALL_CODES.length; j += 11) {
        const a = judge(ALL_CODES[i], ALL_CODES[j])
        expect(judge(ALL_CODES[j], ALL_CODES[i])).toEqual(a)
        seen.add(`${a.hit}${a.blow}`)
      }
    }
    expect(seen.has('31')).toBe(false)
    expect(seen.size).toBe(14)
  })
})

describe('validateGuess', () => {
  it('正しい入力は null', () => {
    expect(validateGuess('0123')).toBeNull()
    expect(validateGuess('9876')).toBeNull()
  })
  it('桁数の不足・超過', () => {
    expect(validateGuess('')).toMatch('4桁')
    expect(validateGuess('123')).toMatch('いま3桁')
    expect(validateGuess('12345')).toMatch('いま5桁')
  })
  it('重複', () => {
    expect(validateGuess('1123')).toMatch('同じ数字')
    expect(validateGuess('0000')).toMatch('同じ数字')
  })
  it('数字以外', () => {
    expect(validateGuess('12a4')).toMatch('数字')
    expect(validateGuess('１２３４')).toMatch('数字')
  })
})
