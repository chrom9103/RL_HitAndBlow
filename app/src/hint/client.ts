import type { Clue } from '../game/candidates'
import type { Hint } from './minimax'
import type { HintRequest, HintResponse } from './hint.worker'

export interface Hinter {
  hint(clues: Clue[]): Promise<Hint>
  dispose(): void
}

/** プレイヤー向けのヒントを用意する。計算は Web Worker で行い、画面の操作を止めない。 */
export function createHinter(): Hinter {
  const worker = new Worker(new URL('./hint.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, { resolve: (h: Hint) => void; reject: (e: Error) => void }>()
  let nextId = 0

  worker.onmessage = (e: MessageEvent<HintResponse>) => {
    const msg = e.data
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.type === 'hint') p.resolve(msg.hint)
    else p.reject(new Error(msg.message))
  }

  return {
    hint(clues) {
      const id = nextId++
      return new Promise<Hint>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        worker.postMessage({ id, clues } satisfies HintRequest)
      })
    },
    dispose() {
      worker.terminate()
      for (const p of pending.values()) p.reject(new Error('disposed'))
      pending.clear()
    },
  }
}
