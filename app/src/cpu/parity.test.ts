/**
 * 学習側(Python の参照推論)とアプリ側(TypeScript)の推論が一致することを確認する。
 * フィクスチャは training/export.py が生成する。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { actionFeatures, N_ACTION, posFreq, stateFeatures } from './features'
import { candidatesFrom, chooseGuess, parseWeights, qValues, type Manifest } from './policy'
import parity from './__fixtures__/parity.json'

const weightsDir = fileURLToPath(new URL('../../public/weights/', import.meta.url))
const manifest = JSON.parse(readFileSync(weightsDir + 'manifest.json', 'utf8')) as Manifest
const layers = Object.fromEntries(
  Object.entries(manifest.files).map(([d, file]) => {
    const buf = readFileSync(weightsDir + file)
    return [d, parseWeights(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), manifest.sizes)]
  }),
)

describe('Python と TypeScript の推論一致', () => {
  it('フィクスチャがある', () => {
    expect(parity.cases.length).toBeGreaterThan(30)
  })

  it.each(parity.cases.map((c, i) => [i, c.difficulty, c.turns.length, c] as const))(
    'case %i (%s, %i 手目まで)',
    (_i, difficulty, _n, c) => {
      const cands = candidatesFrom(c.turns)
      expect(cands.length).toBe(c.candidates)

      const freq = posFreq(cands)
      const state = stateFeatures(cands, c.turns.length, freq)
      state.forEach((v, j) => expect(v).toBeCloseTo(c.state[j], 12))

      const actions = actionFeatures(cands, freq)
      const q = qValues(layers[difficulty], state, actions)
      for (const p of c.probes) {
        for (let j = 0; j < N_ACTION; j++) expect(actions[p.index * N_ACTION + j]).toBeCloseTo(p.action[j], 12)
        expect(q[p.index]).toBeCloseTo(p.q, 9)
      }

      expect(chooseGuess(layers[difficulty], c.turns)).toBe(c.expected)
    },
  )
})
