import { MAX_TURNS, isSolved, judge, type Judgement } from './codes'

export type Side = 'player' | 'cpu'
export type Result = 'win' | 'lose' | 'draw'

export interface Turn extends Judgement {
  guess: string
}

export interface Outcome {
  /** プレイヤーから見た結果 */
  result: Result
  playerSolved: boolean
  cpuSolved: boolean
  playerTurns: number
  cpuTurns: number
}

export interface Match {
  secret: string
  player: Turn[]
  cpu: Turn[]
  /** 次に予想する側。終了後は null */
  next: Side | null
  outcome: Outcome | null
}

export function createMatch(secret: string): Match {
  return { secret, player: [], cpu: [], next: 'player', outcome: null }
}

const solvedIn = (turns: readonly Turn[]) => turns.some(isSolved)

/**
 * 手番の予想を適用する。先攻はプレイヤー。
 * 勝敗はラウンド(プレイヤー n 回目 → CPU n 回目)の終わりにだけ確定する。
 * - 片方だけが当てていれば、その側の勝ち
 * - 同じラウンドで双方が当てれば引き分け
 * - 双方が上限 10 回で当てられなければ引き分け
 */
export function applyGuess(match: Match, side: Side, guess: string): Match {
  if (match.outcome) throw new Error('ゲームは終了しています')
  if (match.next !== side) throw new Error(`${side} の手番ではありません`)

  const turn: Turn = { guess, ...judge(match.secret, guess) }
  if (side === 'player') {
    return { ...match, player: [...match.player, turn], next: 'cpu' }
  }

  const next: Match = { ...match, cpu: [...match.cpu, turn] }
  const round = next.cpu.length
  const playerSolved = solvedIn(next.player)
  const cpuSolved = solvedIn(next.cpu)
  if (!playerSolved && !cpuSolved && round < MAX_TURNS) {
    return { ...next, next: 'player' }
  }
  const result: Result = playerSolved === cpuSolved ? 'draw' : playerSolved ? 'win' : 'lose'
  return {
    ...next,
    next: null,
    outcome: {
      result,
      playerSolved,
      cpuSolved,
      playerTurns: next.player.length,
      cpuTurns: next.cpu.length,
    },
  }
}
