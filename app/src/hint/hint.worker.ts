/// <reference lib="webworker" />
import type { Clue } from '../game/candidates'
import { hint, type Hint } from './minimax'

export type HintRequest = { id: number; clues: Clue[] }
export type HintResponse = { type: 'hint'; id: number; hint: Hint } | { type: 'error'; id: number; message: string }

self.onmessage = (e: MessageEvent<HintRequest>) => {
  const { id, clues } = e.data
  try {
    self.postMessage({ type: 'hint', id, hint: hint(clues) } satisfies HintResponse)
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String(err) } satisfies HintResponse)
  }
}
