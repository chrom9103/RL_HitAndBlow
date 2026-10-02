import type { Difficulty } from '../game/difficulty'
import type { Manifest, OwnTurn } from './policy'
import type { WorkerRequest, WorkerResponse } from './cpu.worker'

export interface Cpu {
  guess(turns: OwnTurn[]): Promise<string>
  dispose(): void
}

let manifestPromise: Promise<Manifest> | null = null
const weightCache = new Map<Difficulty, Promise<ArrayBuffer>>()

const assetUrl = (path: string) => new URL(import.meta.env.BASE_URL + path, document.baseURI).href

function loadManifest(): Promise<Manifest> {
  manifestPromise ??= fetch(assetUrl('weights/manifest.json')).then((r) => {
    if (!r.ok) throw new Error(`manifest: ${r.status}`)
    return r.json() as Promise<Manifest>
  })
  return manifestPromise
}

function loadWeights(difficulty: Difficulty, manifest: Manifest): Promise<ArrayBuffer> {
  let p = weightCache.get(difficulty)
  if (!p) {
    p = fetch(assetUrl(`weights/${manifest.files[difficulty]}`)).then((r) => {
      if (!r.ok) throw new Error(`weights: ${r.status}`)
      return r.arrayBuffer()
    })
    weightCache.set(difficulty, p)
  }
  return p
}

/** 対戦相手を用意する。思考は Web Worker で行い、画面の操作を止めない。 */
export function createCpu(difficulty: Difficulty): Cpu {
  const worker = new Worker(new URL('./cpu.worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, { resolve: (g: string) => void; reject: (e: Error) => void }>()
  let nextId = 0

  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.type === 'guess') p.resolve(msg.guess)
    else p.reject(new Error(msg.message))
  }

  const ready = loadManifest().then(async (manifest) => {
    const buffer = (await loadWeights(difficulty, manifest)).slice(0)
    worker.postMessage({ type: 'load', buffer, sizes: manifest.sizes } satisfies WorkerRequest, [buffer])
  })

  return {
    async guess(turns) {
      await ready
      const id = nextId++
      return new Promise<string>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        worker.postMessage({ type: 'guess', id, turns } satisfies WorkerRequest)
      })
    },
    dispose() {
      worker.terminate()
      for (const p of pending.values()) p.reject(new Error('disposed'))
      pending.clear()
    },
  }
}
