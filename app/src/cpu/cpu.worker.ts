/// <reference lib="webworker" />
import { chooseGuess, parseWeights, type Layer, type OwnTurn } from './policy'

export type WorkerRequest =
  | { type: 'load'; buffer: ArrayBuffer; sizes: number[] }
  | { type: 'guess'; id: number; turns: OwnTurn[] }

export type WorkerResponse = { type: 'guess'; id: number; guess: string } | { type: 'error'; id: number; message: string }

let layers: Layer[] | null = null

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'load') {
    layers = parseWeights(msg.buffer, msg.sizes)
    return
  }
  try {
    if (!layers) throw new Error('weights not loaded')
    const guess = chooseGuess(layers, msg.turns, Math.random)
    self.postMessage({ type: 'guess', id: msg.id, guess } satisfies WorkerResponse)
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: String(err) } satisfies WorkerResponse)
  }
}
