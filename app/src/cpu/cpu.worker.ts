/// <reference lib="webworker" />
import { chooseGuess, parseWeights, type Layer, type OwnTurn } from './policy'
import { parseTree, randomSymmetry, treeGuess, type DecisionTree, type Symmetry } from './tree'

export type WorkerRequest =
  | { type: 'load'; buffer: ArrayBuffer; sizes: number[] }
  | { type: 'loadTree'; buffer: ArrayBuffer }
  | { type: 'guess'; id: number; turns: OwnTurn[] }

export type WorkerResponse = { type: 'guess'; id: number; guess: string } | { type: 'error'; id: number; message: string }

let layers: Layer[] | null = null
let tree: { tree: DecisionTree; sym: Symmetry } | null = null

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'load') {
    layers = parseWeights(msg.buffer, msg.sizes)
    return
  }
  if (msg.type === 'loadTree') {
    // Worker は対戦ごとに作り直すので、付け替えも対戦ごとに選び直される
    tree = { tree: parseTree(msg.buffer), sym: randomSymmetry(Math.random) }
    return
  }
  try {
    let guess: string
    if (tree) guess = treeGuess(tree.tree, msg.turns, tree.sym)
    else if (layers) guess = chooseGuess(layers, msg.turns, Math.random)
    else throw new Error('weights not loaded')
    self.postMessage({ type: 'guess', id: msg.id, guess } satisfies WorkerResponse)
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: String(err) } satisfies WorkerResponse)
  }
}
